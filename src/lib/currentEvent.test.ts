import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { storedCurrentEventDate } from "./currentEventDate";

describe("storedCurrentEventDate", () => {
  it("returns a parsed date when KV stored one", () => {
    const date = storedCurrentEventDate({
      date: "2026-08-21T00:00:00.000+08:00",
    });

    assert.ok(date);
    assert.equal(
      date.toISOString(),
      new Date("2026-08-21T00:00:00.000+08:00").toISOString(),
    );
  });

  it("returns null when no date is stored", () => {
    assert.equal(storedCurrentEventDate({}), null);
  });

  it("returns null for an invalid stored date", () => {
    assert.equal(storedCurrentEventDate({ date: "not-a-date" }), null);
  });
});
