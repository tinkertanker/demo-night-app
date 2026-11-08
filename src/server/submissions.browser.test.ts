import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";

import { AUTH_SESSION_COOKIE } from "~/lib/auth-cookies";
import { db } from "~/server/db";

// Requires the local app and agent-browser. Never create fixtures remotely.
const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
for (const url of [baseUrl, process.env.DATABASE_URL!]) {
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname));
}

it("lets an authenticated admin open and edit submissions without a share secret", async () => {
  const id = `submissions-test-${crypto.randomUUID()}`;
  const email = `${id}@example.com`;
  const sessionToken = crypto.randomUUID();
  const session = `sub-${id.slice(-8)}`;
  const csvDirectory = await mkdtemp(join(tmpdir(), "submissions-csv-"));
  const browser = (...args: string[]) => {
    const output = execFileSync(
      "agent-browser",
      ["--session", session, "--restore", "--json", ...args],
      { encoding: "utf8", timeout: 60_000 },
    );
    const response = JSON.parse(output) as {
      success: boolean;
      data: { result: unknown };
    };
    assert.equal(response.success, true, output);
    return response.data.result;
  };
  const waitForDashboard = () => browser("wait", "--text", "Submissions (1)");

  try {
    await db.admin.create({ data: { email } });
    await db.user.create({
      data: {
        id,
        email,
        sessions: {
          create: { sessionToken, expires: new Date(Date.now() + 3_600_000) },
        },
      },
    });
    const event = await db.event.create({
      data: {
        id,
        name: "Submissions regression fixture",
        date: new Date(),
        url: "",
        submissions: {
          create: {
            id,
            name: "Regression project",
            tagline: "A local fixture",
            description: "Submission browser regression fixture",
            url: "https://example.com",
            pocName: "Local Tester",
          },
        },
      },
    });
    browser("open");
    browser(
      "cookies",
      "set",
      AUTH_SESSION_COOKIE,
      sessionToken,
      "--url",
      baseUrl,
    );
    browser("open", `${baseUrl}/admin/${id}/submissions`);
    browser("set", "viewport", "1280", "900", "2");
    waitForDashboard();
    browser("find", "text", "Regression project", "click");
    browser("wait", 'input[name="name"]');
    assert.equal(
      browser(
        "eval",
        "document.querySelector('input[name=\"name\"]').disabled",
      ),
      false,
    );
    browser("fill", 'input[name="name"]', "Updated regression project");
    browser(
      "wait",
      "--fn",
      "document.querySelector('tbody').innerText.includes('Updated regression project')",
    );
    assert.equal(
      (await db.submission.findUniqueOrThrow({ where: { id } })).name,
      "Updated regression project",
    );
    browser("reload");
    waitForDashboard();
    browser("find", "text", "Updated regression project", "click");
    browser("wait", 'input[name="name"]');
    assert.equal(
      browser("eval", "document.querySelector('input[name=\"name\"]').value"),
      "Updated regression project",
    );

    const invalidCsv = join(csvDirectory, "missing-columns.csv");
    await writeFile(invalidCsv, "url\nhttps://example.com\n");
    browser("find", "role", "button", "click", "--name", "CSV", "--exact");
    browser("upload", 'input[type="file"]', invalidCsv);
    browser("wait", "--text", "CSV must include");
    assert.equal(await db.submission.count({ where: { eventId: id } }), 1);
    assert.equal(
      (await db.submission.findUniqueOrThrow({ where: { id } })).name,
      "Updated regression project",
    );

    const validCsv = join(csvDirectory, "explicit-empty-cells.csv");
    await writeFile(
      validCsv,
      `id,name,tagline,description,url,pocName\n${id},Updated regression project,,,https://example.com,\n`,
    );
    browser("reload");
    waitForDashboard();
    browser("find", "role", "button", "click", "--name", "CSV", "--exact");
    browser("upload", 'input[type="file"]', validCsv);
    browser("wait", "--text", "Submissions updated!");
    const imported = await db.submission.findUniqueOrThrow({ where: { id } });
    assert.equal(imported.tagline, "");
    assert.equal(imported.description, "");
    assert.equal(imported.pocName, "");

    browser("set", "viewport", "640", "900", "2");
    browser("reload");
    waitForDashboard();

    browser("cookies", "clear");
    browser("open", `${baseUrl}/admin/${id}/submissions`);
    browser("wait", "--url", "**/404?type=invalid-secret");
    browser(
      "open",
      `${baseUrl}/admin/${id}/submissions?secret=${event.secret}`,
    );
    waitForDashboard();
    browser("find", "text", "Updated regression project", "click");
    browser("wait", 'input[name="name"]');
    assert.equal(
      browser(
        "eval",
        "document.querySelector('input[name=\"name\"]').disabled",
      ),
      true,
    );
    assert.equal(
      browser("eval", "document.body.innerText.includes('Convert to demo')"),
      false,
    );
  } finally {
    try {
      browser("close");
    } catch {
      // The session may already have ended; still remove database fixtures.
    }
    await db.event.deleteMany({ where: { id } });
    await db.user.deleteMany({ where: { id } });
    await db.admin.deleteMany({ where: { email } });
    await db.$disconnect();
    await rm(csvDirectory, { recursive: true, force: true });
  }
});
