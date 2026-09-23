import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  attendeeNameSchema,
  duplicateVoterIds,
  investmentParticipation,
} from "./voters";

describe("voter names", () => {
  it("rejects whitespace but accepts single-word and non-Latin names", () => {
    for (const name of [null, "", "  \t\n"])
      assert.equal(attendeeNameSchema.safeParse(name).success, false);
    assert.equal(attendeeNameSchema.parse("  陈伟  "), "陈伟");
    assert.equal(attendeeNameSchema.parse("Cher"), "Cher");
  });

  it("flags every matching name, ignoring case and spacing, but not blank or merely similar names", () => {
    assert.deepEqual(
      duplicateVoterIds([
        { id: "one", name: "Ada Lovelace" },
        { id: "two", name: " ada   LOVELACE " },
        { id: "three", name: "Ada Love" },
        { id: "four", name: null },
        { id: "five", name: "  " },
        { id: "six", name: "José" },
        { id: "seven", name: "Jose\u0301" },
      ]),
      new Set(["one", "two", "six", "seven"]),
    );
  });
});

describe("investment participation", () => {
  it("counts one investor across multiple pitches, ignoring cleared or zero allocations", () => {
    assert.deepEqual(
      investmentParticipation([
        { attendeeId: "one", demoId: "a", amount: 25_000 },
        { attendeeId: "one", demoId: "b", amount: 75_000 },
        { attendeeId: "two", demoId: "b", amount: 10_000 },
        { attendeeId: "three", demoId: "a", amount: 0 },
        { attendeeId: "four", demoId: null, amount: 50_000 },
        { attendeeId: "five", demoId: "b", amount: null },
      ]),
      { investors: 2, allocations: 3 },
    );
    assert.deepEqual(investmentParticipation([]), {
      investors: 0,
      allocations: 0,
    });
  });
});
