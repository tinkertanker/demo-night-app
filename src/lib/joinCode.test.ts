import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  generateJoinCode,
  isValidJoinCode,
  normalizeJoinCode,
} from "./joinCode";

describe("generateJoinCode", () => {
  it("generates valid codes from the unambiguous alphabet", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateJoinCode();
      assert.equal(code.length, JOIN_CODE_LENGTH);
      assert.ok(isValidJoinCode(code), code);
      for (const char of code) {
        assert.ok(JOIN_CODE_ALPHABET.includes(char), char);
      }
    }
  });

  it("covers both ends of the alphabet", () => {
    assert.equal(
      generateJoinCode(() => 0),
      "BBBB",
    );
    assert.equal(
      generateJoinCode(() => 0.9999),
      "9999",
    );
  });
});

describe("normalizeJoinCode", () => {
  it("trims and uppercases", () => {
    assert.equal(normalizeJoinCode("  k7qx "), "K7QX");
  });
});

describe("isValidJoinCode", () => {
  it("accepts four uppercase letters or digits", () => {
    assert.ok(isValidJoinCode("AB12"));
  });

  it("rejects the wrong length, lowercase and symbols", () => {
    assert.ok(!isValidJoinCode("ABC"));
    assert.ok(!isValidJoinCode("ABCDE"));
    assert.ok(!isValidJoinCode("abcd"));
    assert.ok(!isValidJoinCode("AB-1"));
  });

  it("rejects codes that shadow top-level routes", () => {
    assert.ok(!isValidJoinCode("AUTH"));
  });
});
