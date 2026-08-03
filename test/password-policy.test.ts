import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validatePasswordPolicy
} from "../src/services/password-policy.js";

describe("password policy", () => {
  it("accepts a valid long passphrase", () => {
    const result = validatePasswordPolicy(
      "a unique example passphrase",
      "example-user"
    );

    assert.equal(result.valid, true);
  });

  it("rejects a blocked password", () => {
    const result = validatePasswordPolicy(
      "passwordpassword",
      "example-user"
    );

    assert.equal(result.valid, false);
    assert.equal(result.reason, "Password is too common.");
  });

  it("rejects a password equal to the username", () => {
    const result = validatePasswordPolicy(
      "longusername123",
      "longusername123"
    );

    assert.equal(result.valid, false);
    assert.equal(
      result.reason,
      "Password must not match the username."
    );
  });

  it("rejects a password containing a username of five or more characters", () => {
    const result = validatePasswordPolicy(
      "my example-user password",
      "example-user"
    );

    assert.equal(result.valid, false);
    assert.equal(
      result.reason,
      "Password must not contain the username."
    );
  });

  it("does not apply the contains rule to usernames shorter than five characters", () => {
    const result = validatePasswordPolicy(
      "sample phrase with enough length",
      "sam"
    );

    assert.equal(result.valid, true);
  });

  it("performs blocked-password checks case-insensitively", () => {
    const result = validatePasswordPolicy(
      "PASSWORDPASSWORD",
      "example-user"
    );

    assert.equal(result.valid, false);
  });
});