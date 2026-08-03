import assert from "node:assert/strict";
import {
  after,
  before,
  beforeEach,
  describe,
  it
} from "node:test";
import * as argon2 from "argon2";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../src/app.js";
import {
  connectRedis,
  disconnectRedis,
  redisClient
} from "../src/redis.js";

let app: FastifyInstance;

const testKeys = [
  "user:test-user",
  "user:case-user",
  "user:race-user",
  "user:sam"
];

const validPassword = "a unique example passphrase";

async function clearTestUsers(): Promise<void> {
  await Promise.all(
    testKeys.map((key) => redisClient.del(key))
  );
}

async function createTestUser(
  username = "test-user",
  password = validPassword
) {
  return app.inject({
    method: "POST",
    url: "/users",
    payload: {
      username,
      password
    }
  });
}

before(async () => {
  await connectRedis();

  app = buildApp();
  await app.ready();
});

beforeEach(async () => {
  await clearTestUsers();
});

after(async () => {
  await clearTestUsers();
  await app.close();
  await disconnectRedis();
});

describe("GET /health", () => {
  it("reports a successful Redis connection", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    assert.equal(response.statusCode, 200);

    assert.deepEqual(response.json(), {
      status: "ok",
      redis: "PONG"
    });
  });
});

describe("POST /users", () => {
  it("creates a valid user", async () => {
    const response = await createTestUser();

    assert.equal(response.statusCode, 200);

    const body = response.json();

    assert.equal(body.username, "test-user");
    assert.equal(typeof body.createdAt, "string");
  });

  it("does not return the password or password hash", async () => {
    const response = await createTestUser();
    const body = response.json();

    assert.equal("password" in body, false);
    assert.equal("passwordHash" in body, false);
  });

  it("stores an Argon2 hash instead of the original password", async () => {
    await createTestUser();

    const storedValue = await redisClient.get(
      "user:test-user"
    );

    assert.notEqual(storedValue, null);

    const storedUser = JSON.parse(storedValue!);

    assert.notEqual(
      storedUser.passwordHash,
      validPassword
    );

    assert.equal(
      storedUser.passwordHash.startsWith("$argon2id$"),
      true
    );

    assert.equal(
      await argon2.verify(
        storedUser.passwordHash,
        validPassword
      ),
      true
    );
  });

  it("returns 409 when the username already exists", async () => {
    await createTestUser();

    const secondResponse = await createTestUser();

    assert.equal(secondResponse.statusCode, 409);

    assert.deepEqual(secondResponse.json(), {
      error: "Username already exists."
    });
  });

  it("rejects a missing username", async () => {
    const response = await app.inject({
        method: "POST",
        url: "/users",
        payload: {
        password: validPassword
        }
    });

    assert.equal(response.statusCode, 400);
  });

  it("rejects a missing password", async () => {
    const response = await app.inject({
        method: "POST",
        url: "/users",
        payload: {
        username: "test-user"
        }
    });

    assert.equal(response.statusCode, 400);
  });

  it("rejects a username supplied as a number", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/users",
    payload: {
      username: 12345,
      password: validPassword
    }
  });

  assert.equal(response.statusCode, 400);
});

it("rejects a password supplied as a number", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/users",
    payload: {
      username: "test-user",
      password: 123456789012345
    }
  });

  assert.equal(response.statusCode, 400);
});

  it("treats usernames as case-insensitive", async () => {
    const firstResponse = await createTestUser(
      "Case-User"
    );

    const secondResponse = await createTestUser(
      "case-user"
    );

    assert.equal(firstResponse.statusCode, 200);
    assert.equal(secondResponse.statusCode, 409);
  });

  it("allows only one of two simultaneous username creations", async () => {
    const payload = {
      username: "race-user",
      password: validPassword
    };

    const responses = await Promise.all([
      app.inject({
        method: "POST",
        url: "/users",
        payload
      }),
      app.inject({
        method: "POST",
        url: "/users",
        payload
      })
    ]);

    const statuses = responses
      .map((response) => response.statusCode)
      .sort();

    assert.deepEqual(statuses, [200, 409]);
  });

  it("rejects usernames shorter than three characters", async () => {
    const response = await createTestUser(
      "ab"
    );

    assert.equal(response.statusCode, 400);
  });

  it("rejects usernames longer than eighteen characters", async () => {
    const response = await createTestUser(
      "a".repeat(19)
    );

    assert.equal(response.statusCode, 400);
  });

  it("rejects unsupported username characters", async () => {
    const response = await createTestUser(
      "invalid user"
    );

    assert.equal(response.statusCode, 400);
  });

  it("rejects passwords shorter than fifteen characters", async () => {
    const response = await createTestUser(
      "test-user",
      "too short"
    );

    assert.equal(response.statusCode, 400);
  });

  it("rejects passwords longer than 128 characters", async () => {
    const response = await createTestUser(
      "test-user",
      "a".repeat(129)
    );

    assert.equal(response.statusCode, 400);
  });

  it("rejects blocked passwords", async () => {
    const response = await createTestUser(
      "test-user",
      "passwordpassword"
    );

    assert.equal(response.statusCode, 400);

    assert.deepEqual(response.json(), {
      error: "Password is too common."
    });
  });

  it("rejects passwords containing the username", async () => {
    const response = await createTestUser(
      "test-user",
      "my test-user password"
    );

    assert.equal(response.statusCode, 400);

    assert.deepEqual(response.json(), {
      error: "Password must not contain the username."
    });
  });

  it("rejects unexpected request properties", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/users",
      payload: {
        username: "test-user",
        password: validPassword,
        administrator: true
      }
    });

    assert.equal(response.statusCode, 400);
  });
});

describe("POST /authenticate", () => {
  it("authenticates valid credentials", async () => {
    await createTestUser();

    const response = await app.inject({
      method: "POST",
      url: "/authenticate",
      payload: {
        username: "test-user",
        password: validPassword
      }
    });

    assert.equal(response.statusCode, 200);

    assert.deepEqual(response.json(), {
      authenticated: true
    });
  });

  it("authenticates usernames case-insensitively", async () => {
    await createTestUser("Case-User");

    const response = await app.inject({
      method: "POST",
      url: "/authenticate",
      payload: {
        username: "CASE-USER",
        password: validPassword
      }
    });

    assert.equal(response.statusCode, 200);
  });

  it("returns 401 for an incorrect password", async () => {
    await createTestUser();

    const response = await app.inject({
      method: "POST",
      url: "/authenticate",
      payload: {
        username: "test-user",
        password: "an incorrect password"
      }
    });

    assert.equal(response.statusCode, 401);

    assert.deepEqual(response.json(), {
      error: "Invalid username or password."
    });
  });

  it("returns the same 401 response for an unknown username", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/authenticate",
      payload: {
        username: "test-user",
        password: "an incorrect password"
      }
    });

    assert.equal(response.statusCode, 401);

    assert.deepEqual(response.json(), {
      error: "Invalid username or password."
    });
  });

  it("returns identical responses for unknown users and wrong passwords", async () => {
    await createTestUser();

    const wrongPasswordResponse = await app.inject({
      method: "POST",
      url: "/authenticate",
      payload: {
        username: "test-user",
        password: "an incorrect password"
      }
    });

    const unknownUserResponse = await app.inject({
      method: "POST",
      url: "/authenticate",
      payload: {
        username: "case-user",
        password: "an incorrect password"
      }
    });

    assert.equal(
      wrongPasswordResponse.statusCode,
      unknownUserResponse.statusCode
    );

    assert.deepEqual(
      wrongPasswordResponse.json(),
      unknownUserResponse.json()
    );
  });

  it("rejects a missing password", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/authenticate",
      payload: {
        username: "test-user"
      }
    });

    assert.equal(response.statusCode, 400);
  });

  it("rejects a missing username", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/authenticate",
    payload: {
      password: validPassword
    }
  });

  assert.equal(response.statusCode, 400);
});

it("rejects a username supplied as a number", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/authenticate",
    payload: {
      username: 12345,
      password: validPassword
    }
  });

  assert.equal(response.statusCode, 400);
});

it("rejects a password supplied as a number", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/authenticate",
    payload: {
      username: "test-user",
      password: 123456789012345
    }
  });

  assert.equal(response.statusCode, 400);
});

  it("rejects unexpected request properties", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/authenticate",
      payload: {
        username: "test-user",
        password: validPassword,
        extra: true
      }
    });

    assert.equal(response.statusCode, 400);
  });
});
describe("malformed JSON requests", () => {
  it("returns a JSON error response for malformed JSON", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/users",
      headers: {
        "content-type": "application/json"
      },
      payload: `{
        "username": "test-user",
        "password":
      }`
    });

    assert.equal(response.statusCode, 400);

    assert.match(
      String(response.headers["content-type"]),
      /^application\/json/
    );

    const body = response.json();

    assert.equal(
      typeof body.error,
      "string"
    );
  });
});