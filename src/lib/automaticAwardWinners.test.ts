import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { rankAutomaticAwardWinners } from "./automaticAwardWinners";

const demos = [
  { id: "demo-1", index: 0, votable: true },
  { id: "demo-2", index: 1, votable: true },
  { id: "demo-3", index: 2, votable: true },
  { id: "demo-hidden", index: 3, votable: false },
];

describe("rankAutomaticAwardWinners", () => {
  it("ranks pitch-night demos by their total funding", () => {
    const winners = rankAutomaticAwardWinners(
      demos,
      [
        { demoId: "demo-1", amount: 10_000 },
        { demoId: "demo-2", amount: 20_000 },
        { demoId: "demo-1", amount: 25_000 },
        { demoId: "demo-3", amount: 30_000 },
        { demoId: "demo-hidden", amount: 100_000 },
      ],
      true,
    );

    assert.deepEqual(winners, ["demo-1", "demo-3", "demo-2"]);
  });

  it("ranks demo-night demos by vote count", () => {
    const winners = rankAutomaticAwardWinners(
      demos,
      [
        { demoId: "demo-1", amount: null },
        { demoId: "demo-2", amount: null },
        { demoId: "demo-2", amount: null },
        { demoId: "demo-3", amount: null },
        { demoId: "demo-3", amount: null },
        { demoId: "demo-3", amount: null },
      ],
      false,
    );

    assert.deepEqual(winners, ["demo-3", "demo-2", "demo-1"]);
  });

  it("uses demo order to break ties and excludes non-votable demos", () => {
    const winners = rankAutomaticAwardWinners(
      demos,
      [{ demoId: "demo-hidden", amount: 100_000 }],
      true,
    );

    assert.deepEqual(winners, ["demo-1", "demo-2", "demo-3"]);
  });
});
