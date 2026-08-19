import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addSingaporeDays,
  formatDateDDMMYYYY,
  formatEventDate,
  getDaysAgoLabel,
  isPastEventDay,
  parseDateDDMMYYYY,
  singaporeCalendarDaysBetween,
  singaporeDateKey,
  singaporeMidnight,
  singaporeWeekday,
  toSingaporeMidnight,
} from "./singaporeDate";

const SGT_MIDNIGHT_19 = new Date("2026-08-18T16:00:00.000Z");
const UTC_MIDNIGHT_13 = new Date("2026-08-13T00:00:00.000Z");
const WED_1359_SGT = new Date("2026-08-19T05:59:00.000Z");

describe("singaporeDate", () => {
  it("labels mixed stored timestamps on Singapore calendar days", () => {
    assert.equal(formatEventDate(SGT_MIDNIGHT_19), "Wed, Aug 19, 2026");
    assert.equal(getDaysAgoLabel(SGT_MIDNIGHT_19, WED_1359_SGT), "today");
    assert.equal(singaporeDateKey(SGT_MIDNIGHT_19), "2026-08-19");

    assert.equal(formatEventDate(UTC_MIDNIGHT_13), "Thu, Aug 13, 2026");
    assert.equal(getDaysAgoLabel(UTC_MIDNIGHT_13, WED_1359_SGT), "6 days ago");
  });

  it("parses and formats dd/mm/yyyy as Singapore midnight", () => {
    const parsed = parseDateDDMMYYYY("19/08/2026");
    assert.deepEqual(parsed, SGT_MIDNIGHT_19);
    assert.equal(formatDateDDMMYYYY(parsed!), "19/08/2026");
    assert.equal(parseDateDDMMYYYY("31/02/2026"), null);
    assert.equal(parseDateDDMMYYYY("19-08-2026"), null);
  });

  it("rejects invalid Singapore date keys instead of rolling over", () => {
    assert.throws(() => singaporeMidnight("2026-02-30"));
    assert.throws(() => singaporeMidnight("not-a-date"));
  });

  it("preserves the calendar day when normalising UTC-midnight rows", () => {
    const normalised = toSingaporeMidnight(UTC_MIDNIGHT_13);
    assert.equal(singaporeDateKey(normalised), "2026-08-13");
    assert.equal(normalised.toISOString(), "2026-08-12T16:00:00.000Z");
  });

  it("keeps a two-day current-event window in Singapore", () => {
    const eventDay = SGT_MIDNIGHT_19;
    assert.equal(
      singaporeCalendarDaysBetween(
        eventDay,
        new Date("2026-08-19T15:59:59.999Z"),
      ),
      0,
    );
    assert.equal(
      singaporeCalendarDaysBetween(
        eventDay,
        new Date("2026-08-20T15:59:59.999Z"),
      ),
      1,
    );
    assert.ok(
      singaporeCalendarDaysBetween(
        eventDay,
        new Date("2026-08-20T16:00:00.000Z"),
      ) >= 2,
    );
  });

  it("treats the event day itself as not yet past", () => {
    assert.equal(isPastEventDay(SGT_MIDNIGHT_19, WED_1359_SGT), false);
    assert.equal(
      isPastEventDay(SGT_MIDNIGHT_19, new Date("2026-08-20T16:00:00.000Z")),
      true,
    );
  });

  it("derives weekdays from the Singapore calendar date", () => {
    assert.equal(singaporeWeekday(SGT_MIDNIGHT_19), 3);
    assert.equal(singaporeWeekday(UTC_MIDNIGHT_13), 4);
    assert.equal(
      singaporeDateKey(
        addSingaporeDays(
          SGT_MIDNIGHT_19,
          -(singaporeWeekday(SGT_MIDNIGHT_19) + 1),
        ),
      ),
      "2026-08-15",
    );
  });
});
