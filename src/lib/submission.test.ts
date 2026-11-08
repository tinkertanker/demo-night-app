import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DESCRIPTION_MAX_LENGTH,
  submissionInputSchema,
  withWebScheme,
} from "~/lib/submission";

const valid = {
  id: "2d57357a-55d0-4e81-8437-254c7fe81885",
  eventId: "event",
  name: "Demo",
  tagline: "Tagline",
  description: "Description",
  url: "https://example.com",
  pocName: "Ada",
};

describe("submission input", () => {
  it("rejects whitespace-only text and non-web links that would render as hrefs", () => {
    for (const field of ["name", "tagline", "description", "pocName"])
      assert.equal(
        submissionInputSchema.safeParse({ ...valid, [field]: "   " }).success,
        false,
        field,
      );
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,x",
      "https://demo",
      "example.com",
    ])
      assert.equal(
        submissionInputSchema.safeParse({ ...valid, url }).success,
        false,
        url,
      );
  });

  it("needs no contact address and strips legacy contact input", () => {
    assert.deepEqual(submissionInputSchema.parse(valid), valid);
    assert.deepEqual(
      submissionInputSchema.parse({ ...valid, email: "Ada@Example.com" }),
      valid,
    );
    assert.equal(
      submissionInputSchema.safeParse({ ...valid, id: "person@example.com" })
        .success,
      false,
    );
  });

  it("caps descriptions at the limit the form counts, after trimming", () => {
    const parse = (description: string) =>
      submissionInputSchema.safeParse({ ...valid, description }).success;
    assert.equal(parse("x".repeat(DESCRIPTION_MAX_LENGTH)), true);
    assert.equal(parse(` ${"x".repeat(DESCRIPTION_MAX_LENGTH)}\n`), true);
    assert.equal(parse("x".repeat(DESCRIPTION_MAX_LENGTH + 1)), false);
  });

  it("adds https:// to bare domains but leaves explicit schemes for validation", () => {
    assert.equal(withWebScheme(" example.com "), "https://example.com");
    assert.equal(
      withWebScheme("example.com:8080/x"),
      "https://example.com:8080/x",
    );
    assert.equal(withWebScheme("http://example.com"), "http://example.com");
    assert.equal(withWebScheme("javascript:alert(1)"), "javascript:alert(1)");
    assert.equal(withWebScheme(""), "");
  });
});
