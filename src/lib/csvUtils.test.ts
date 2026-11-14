import assert from "node:assert/strict";
import { it } from "node:test";

import { escapeCsvField } from "./csvUtils";

it("exports untrusted spreadsheet cells as text without changing ordinary feedback", () => {
  for (const input of ["=1+1", "+SUM(A1:A2)", "-2+3", "@SUM(A1)", " \t=1+1"]) {
    assert.equal(escapeCsvField(input), `'${input.trim()}`);
  }
  assert.equal(
    escapeCsvField('Clear "story"\nwith examples'),
    "Clear 'story' with examples",
  );
  assert.equal(escapeCsvField(null), "");
});
