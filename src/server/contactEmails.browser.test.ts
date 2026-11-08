import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { it } from "node:test";

import { db } from "~/server/db";

const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
for (const url of [baseUrl, process.env.DATABASE_URL!]) {
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname));
}

it("cleans legacy contacts across browser drafts and submits without an email", async () => {
  const id = `contact-browser-${crypto.randomUUID()}`;
  const session = `contact-${id.slice(-8)}`;
  const key = `submissionDraft:${id}`;
  const draft = {
    name: "Restored project",
    pocName: "Ada",
    tagline: "Kept tagline",
    description: "Kept description",
    url: "example.com",
    demoUrl: "",
    email: "legacy@example.com",
  };
  const browser = (...args: string[]) => {
    const output = execFileSync(
      "agent-browser",
      ["--session", session, "--json", ...args],
      { encoding: "utf8", timeout: 60_000 },
    );
    const response = JSON.parse(output) as {
      success: boolean;
      data: { result: unknown };
    };
    assert.equal(response.success, true, output);
    return response.data.result;
  };
  try {
    await db.event.create({
      data: {
        id,
        name: "Contact-free submission",
        date: new Date(Date.now() + 14 * 86_400_000),
        url: "https://example.com",
      },
    });
    browser("open", `${baseUrl}/privacy`);
    browser("set", "viewport", "1280", "900", "2");
    browser(
      "eval",
      `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(JSON.stringify(draft))});
      localStorage.setItem('submissionDraft:other-event', JSON.stringify({name:'Other project',email:'other@example.com'}));
      localStorage.setItem('attendee:old-event', JSON.stringify({id:'attendee-kept',name:'Grace',email:'old@example.com'}));
      localStorage.setItem('attendee', JSON.stringify({id:'legacy-kept',name:'Lin',email:'legacy@example.com'}));
      localStorage.setItem('unrelated', JSON.stringify({email:'untouched@example.com'}));`,
    );
    browser("reload");
    browser(
      "wait",
      "--fn",
      `!JSON.parse(localStorage.getItem(${JSON.stringify(key)})).email`,
    );
    assert.deepEqual(
      browser(
        "eval",
        `JSON.parse(localStorage.getItem('submissionDraft:other-event'))`,
      ),
      { name: "Other project" },
    );
    assert.deepEqual(
      browser("eval", `JSON.parse(localStorage.getItem('attendee:old-event'))`),
      { id: "attendee-kept", name: "Grace" },
    );
    assert.deepEqual(
      browser("eval", `JSON.parse(localStorage.getItem('attendee'))`),
      { id: "legacy-kept", name: "Lin" },
    );
    assert.deepEqual(
      browser("eval", `JSON.parse(localStorage.getItem('unrelated'))`),
      { email: "untouched@example.com" },
    );
    browser("open", `${baseUrl}/${id}/submit`);
    browser(
      "wait",
      "--fn",
      `document.querySelector('input[name="name"]')?.value === 'Restored project'`,
    );
    assert.equal(
      browser(
        "eval",
        `document.querySelectorAll('input[type="email"],input[name="email"]').length`,
      ),
      0,
    );
    const token = browser(
      "eval",
      `JSON.parse(localStorage.getItem(${JSON.stringify(key)})).id`,
    );
    assert.equal(typeof token, "string");
    browser("reload");
    browser(
      "wait",
      "--fn",
      `document.querySelector('input[name="pocName"]')?.value === 'Ada'`,
    );
    assert.equal(
      browser(
        "eval",
        `JSON.parse(localStorage.getItem(${JSON.stringify(key)})).id`,
      ),
      token,
    );
    browser("fill", 'input[name="name"]', "Contact-free project");
    browser(
      "find",
      "role",
      "button",
      "click",
      "--name",
      "Submit Demo",
      "--exact",
    );
    browser("wait", "--url", "**success=true");
    const saved = await db.submission.findUniqueOrThrow({
      where: { id: String(token) },
    });
    assert.equal(saved.name, "Contact-free project");
    assert.equal(saved.pocName, "Ada");
    assert.equal("email" in saved, false);
    assert.equal(
      browser("eval", `localStorage.getItem(${JSON.stringify(key)})`),
      null,
    );
    assert.equal(await db.submission.count({ where: { eventId: id } }), 1);

    // A lost response leaves the original draft on the device. Retrying must
    // acknowledge receipt without inserting again or overwriting the proposal.
    browser("open", `${baseUrl}/privacy`);
    browser(
      "eval",
      `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(JSON.stringify({ ...draft, id: token, name: "Changed retry" }))})`,
    );
    browser("open", `${baseUrl}/${id}/submit`);
    browser("wait", 'input[name="name"]');
    browser(
      "find",
      "role",
      "button",
      "click",
      "--name",
      "Submit Demo",
      "--exact",
    );
    browser("wait", "--url", "**success=true");
    assert.equal(await db.submission.count({ where: { eventId: id } }), 1);
    assert.equal(
      (await db.submission.findUniqueOrThrow({ where: { id: String(token) } }))
        .name,
      "Contact-free project",
    );
    assert.equal(
      browser("eval", `localStorage.getItem(${JSON.stringify(key)})`),
      null,
    );
  } finally {
    try {
      browser("close");
    } catch {
      // The session may already have ended; still remove database fixtures.
    }
    await db.event.deleteMany({ where: { id } });
    await db.$disconnect();
  }
});
