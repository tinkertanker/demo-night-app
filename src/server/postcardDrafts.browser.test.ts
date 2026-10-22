import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { it } from "node:test";
import { setTimeout } from "node:timers/promises";

import { db } from "~/server/db";

// Requires the local app and agent-browser. Never create fixtures remotely.
const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
for (const url of [baseUrl, process.env.DATABASE_URL!]) {
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname));
}

it("preserves a newer postcard across an old save, phase remount and reload", async () => {
  const id = `draft-test-${crypto.randomUUID()}`;
  const attendeeId = `${id}-attendee`;
  const demoId = `${id}-demo`;
  const session = `draft-${id.slice(-8)}`;
  const joinCode = id.slice(-4).toUpperCase();
  const draftKey = `feedback-drafts:${id}:${attendeeId}`;
  const likedSelector = 'textarea[aria-label="I liked…"]';
  const oldText = "Earlier saved snapshot A";
  const newText = "Newer unsaved postcard B";
  const browser = (...args: string[]) => {
    const output = execFileSync(
      "agent-browser",
      ["--session", session, "--restore", "--json", ...args],
      { encoding: "utf8", timeout: 60_000 },
    );
    const response = JSON.parse(output);
    assert.equal(response.success, true, output);
    return response.data.result;
  };
  const text = () =>
    browser("eval", `document.querySelector('${likedSelector}').value`);
  const draft = () =>
    browser("eval", `JSON.parse(localStorage.getItem('${draftKey}'))`);

  try {
    await db.event.create({
      data: {
        id,
        name: "Demo draft race validation",
        date: new Date(),
        url: "",
        joinCode,
        config: { isPitchNight: true },
        livePhase: 1,
        demos: { create: { id: demoId, name: "Story Spark", index: 0 } },
        awards: {
          create: {
            name: "First place",
            index: 0,
            winnerRank: 1,
            description: "",
            votable: true,
          },
        },
        liveEvent: {
          create: {
            name: "Demo draft race validation",
            phase: 1,
            isPitchNight: true,
            currentDemoId: demoId,
          },
        },
      },
    });
    const attendee = await db.attendee.create({
      data: {
        id: attendeeId,
        name: "Demo Race Tester",
        events: { connect: { id } },
      },
    });
    browser("open", baseUrl);
    browser(
      "eval",
      `localStorage.setItem('attendee', JSON.stringify(${JSON.stringify(attendee)}))`,
    );
    browser("open", `${baseUrl}/${joinCode}`);
    browser("wait", likedSelector);
    // Delay only postcard writes; release A through the real API/database later.
    browser(
      "eval",
      `(() => {
      window.heldSaves = [];
      const originalFetch = window.fetch.bind(window);
      window.fetch = (...args) => String(args[0]).includes('feedback.upsert')
        ? new Promise((resolve, reject) => window.heldSaves.push({
            release: async () => {
              try {
                const response = await originalFetch(...args);
                await response.clone().text();
                resolve(response);
                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
              } catch (error) { reject(error); throw error; }
            }
          }))
        : originalFetch(...args);
    })()`,
    );
    browser("fill", likedSelector, oldText);
    browser("wait", "--fn", "window.heldSaves.length > 0");
    await db.event.update({ where: { id }, data: { livePhase: 2 } });
    await db.liveEvent.update({ where: { eventId: id }, data: { phase: 2 } });
    browser("wait", "--text", "Feedback postcards");
    browser("find", "role", "button", "click", "--name", "Feedback postcards");
    // Wait for the exiting Demos workspace to unmount, not an arbitrary sleep.
    browser(
      "wait",
      "--fn",
      `document.querySelectorAll('${likedSelector}').length === 1`,
    );
    browser("fill", likedSelector, newText);
    assert.equal(draft()[demoId].liked, newText);
    browser("eval", "window.heldSaves[0].release().then(() => true)");
    assert.equal(text(), newText);
    assert.equal(
      draft()[demoId]?.liked,
      newText,
      "old completion must not erase the newer persisted draft",
    );
    assert.equal(
      (await db.feedback.findFirstOrThrow({ where: { eventId: id } })).liked,
      oldText,
    );
    browser("reload");
    browser("wait", "--text", "Feedback postcards");
    browser("find", "role", "button", "click", "--name", "Feedback postcards");
    browser("wait", likedSelector);
    assert.equal(
      text(),
      newText,
      "reload must restore B rather than the older saved A",
    );
    // Reload removes the fetch delay, so the restored postcard should save normally.
    let saved = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      saved =
        (await db.feedback.findFirst({ where: { eventId: id } }))?.liked ===
        newText;
      if (saved) break;
      await setTimeout(250);
    }
    assert.ok(
      saved,
      "restored newer postcard must persist to the real database",
    );
    browser("wait", "--text", "Saved!");
    assert.deepEqual(draft(), {}, "the matching saved draft should be cleared");
    browser("reload");
    browser("wait", "--text", "Feedback postcards");
    browser("find", "role", "button", "click", "--name", "Feedback postcards");
    browser("wait", likedSelector);
    assert.equal(text(), newText);
    browser("wait", "--text", "Saved!");
    // Existing server records include metadata and can have a different key order.
    browser("fill", likedSelector, "Final postcard C");
    browser("wait", "--text", "Saved!");
    assert.deepEqual(
      draft(),
      {},
      "an edited server record must also clear on save",
    );
    assert.equal(
      (await db.feedback.findFirstOrThrow({ where: { eventId: id } })).liked,
      "Final postcard C",
    );
  } finally {
    try {
      browser("close");
    } finally {
      await db.event.deleteMany({ where: { id } });
      await db.attendee.deleteMany({ where: { id: attendeeId } });
      await db.$disconnect();
    }
  }
});
