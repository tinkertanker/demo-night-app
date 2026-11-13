import { type Feedback } from "@prisma/client";
import assert from "node:assert/strict";
import { it } from "node:test";
import { z } from "zod";

import { feedbackScore, formatFeedbackForCopy } from "./feedback";
import { postcardFields, postcardProgress } from "./postcards";
import { DEFAULT_EVENT_CONFIG, votingSettings } from "./types/eventConfig";

it("defaults new events to Pitching with money; missing fields retain legacy mechanics", () => {
  assert.equal(votingSettings(DEFAULT_EVENT_CONFIG).unit, "dollars");
  assert.equal(votingSettings(DEFAULT_EVENT_CONFIG).template, "pitching");
  assert.equal(votingSettings({ template: "categories" }).mode, "awards");
  assert.equal(
    votingSettings({ template: "noLeaderboard" }).showResults,
    false,
  );
  assert.equal(votingSettings({ isPitchNight: true }).format(25000), "$25k");
  assert.equal(votingSettings({}).mode, "awards");
  assert.equal(votingSettings({}).showResults, true);
  for (const [unit, symbol] of [
    ["thumbs", "👍"],
    ["stars", "★"],
    ["points", "●"],
    ["dollars", "$"],
  ]) {
    const settings = votingSettings({
      votingMode: "allocation",
      votingUnit: unit,
    });
    assert.equal(settings.budget, 100000);
    assert.equal(settings.step, 1000);
    assert.ok(settings.format(5000).startsWith(symbol!));
    assert.equal(settings.financial, unit === "dollars");
  }
  assert.equal(votingSettings({ votingMode: "stickers" }).budget, 5);
});

it("counts distinct projects with meaningful postcards, including legacy comments and badges", () => {
  assert.equal(
    postcardProgress([
      { demoId: "a", comment: "Old comment" },
      { demoId: "a", liked: "Updated feedback" },
      { demoId: "b", badges: ["Made me smile"] },
      { demoId: "c", wonder: "   " },
      { demoId: "d", tryNext: "Try a larger font" },
    ]),
    3,
  );
  const schema = z.object(postcardFields);
  assert.ok(schema.safeParse({ wonder: "What next?" }).success);
  assert.ok(
    !schema.safeParse({ badges: ["Made me smile", "Made me smile"] }).success,
  );
  assert.ok(!schema.safeParse({ badges: ["Extra vote"] }).success);
});

it("orders prompt-only and badge-only postcards with meaningful feedback, not empty reactions", () => {
  const empty: Feedback = {
    id: "feedback",
    eventId: "event",
    attendeeId: "attendee",
    demoId: "demo",
    createdAt: new Date(0),
    updatedAt: new Date(0),
    rating: null,
    claps: 0,
    cheers: 0,
    confetti: 0,
    comment: null,
    liked: null,
    wonder: null,
    tryNext: null,
    badges: [],
  };
  const reaction = { ...empty, claps: 8, cheers: 3, rating: 5 };
  for (const postcard of [
    { liked: "A clear explanation" },
    { wonder: "Could this work offline?" },
    { tryNext: "Try larger labels" },
    { badges: ["Made me smile"] },
    { comment: "A preserved comment" },
  ]) {
    assert.ok(
      feedbackScore({ ...empty, ...postcard }) > feedbackScore(reaction),
    );
  }
  assert.equal(
    feedbackScore({ ...empty, liked: "   ", comment: "\n" }),
    feedbackScore(empty),
  );
});

it("copies a presenter's postcards as plain text, counting reaction-only entries only in the summary", () => {
  const base: Feedback = {
    id: "feedback",
    eventId: "event",
    attendeeId: "attendee",
    demoId: "demo",
    createdAt: new Date(0),
    updatedAt: new Date(0),
    rating: null,
    claps: 0,
    cheers: 0,
    confetti: 0,
    comment: null,
    liked: null,
    wonder: null,
    tryNext: null,
    badges: [],
  };
  const text = formatFeedbackForCopy("Chloe", [
    {
      ...base,
      liked: "Joining the queue virtually ",
      wonder: "1. How is the queue live?\n2. What about walk-ins?",
      attendee: { name: "zshoepph", type: null },
    },
    {
      ...base,
      rating: 4,
      claps: 2,
      tryNext: "Bigger labels",
      badges: ["Made me smile"],
      attendee: { name: " ", type: "Engineer" },
    },
    {
      ...base,
      rating: 1,
      cheers: 3,
      confetti: 1,
      attendee: { name: "Reaction only", type: null },
    },
  ]);
  assert.equal(
    text,
    `Feedback for Chloe

3 responses · Average rating 2.5 · 👏 2 · 🥳 3 · 🎉 1

zshoepph
I liked… Joining the queue virtually
I wonder… 1. How is the queue live?
2. What about walk-ins?

Anonymous (Engineer) · Rating 4
You could try… Bigger labels
Badges: Made me smile`,
  );
});
