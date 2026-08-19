import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { awardHasWinner, getAwardWinner } from "./awardWinner";

const demos = [
  {
    id: "demo-1",
    name: "Rocket App",
    description: "A launch tracker",
    url: "https://example.com",
  },
];

describe("awardHasWinner", () => {
  it("is true for a selected demo or a typed name", () => {
    assert.equal(awardHasWinner({ winnerId: "demo-1", winnerName: null }), true);
    assert.equal(
      awardHasWinner({ winnerId: null, winnerName: "Jane Doe" }),
      true,
    );
    assert.equal(awardHasWinner({ winnerId: null, winnerName: "  " }), false);
    assert.equal(awardHasWinner({ winnerId: null, winnerName: null }), false);
  });
});

describe("getAwardWinner", () => {
  it("prefers the selected demo when present", () => {
    assert.deepEqual(
      getAwardWinner({ winnerId: "demo-1", winnerName: "Ignored" }, demos),
      {
        name: "Rocket App",
        description: "A launch tracker",
        url: "https://example.com",
        demoId: "demo-1",
      },
    );
  });

  it("falls back to a typed-in name", () => {
    assert.deepEqual(
      getAwardWinner({ winnerId: null, winnerName: "  Lucky Draw Winner  " }, demos),
      {
        name: "Lucky Draw Winner",
        description: null,
        url: null,
        demoId: null,
      },
    );
  });

  it("returns null when no winner is set", () => {
    assert.equal(
      getAwardWinner({ winnerId: null, winnerName: null }, demos),
      null,
    );
  });
});
