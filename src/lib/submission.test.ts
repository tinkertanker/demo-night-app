import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { submissionInputSchema, withWebScheme } from "~/lib/submission";

const valid = {
  eventId: "event",
  name: "Demo",
  tagline: "Tagline",
  description: "Description",
  email: "Ada@Example.com",
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

  it("normalises email case so one person cannot submit twice", () => {
    assert.equal(submissionInputSchema.parse(valid).email, "ada@example.com");
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
