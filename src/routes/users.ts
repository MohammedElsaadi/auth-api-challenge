import * as argon2 from "argon2";
import type { FastifyInstance } from "fastify";
import { validatePasswordPolicy } from "../services/password-policy.js";

import { redisClient } from "../redis.js";

interface CreateUserBody {
  username: string;
  password: string;
}

interface StoredUser {
  username: string;
  passwordHash: string;
  createdAt: string;
}

const createUserSchema = {
  body: {
    type: "object",
    required: ["username", "password"],
    additionalProperties: false,

    properties: {
      username: {
        type: "string",
        minLength: 3,
        maxLength: 18,
        pattern: "^[a-zA-Z0-9._-]+$"
      },

      password: {
        type: "string",
        minLength: 15,
        maxLength: 128 
      }
    }
  },

    response: {
    201: {
        type: "object",
        required: ["username", "createdAt"],
        additionalProperties: false,
        properties: {
        username: {
            type: "string"
        },
        createdAt: {
            type: "string"
        }
        }
    },

    400: {
        type: "object",
        required: ["error"],
        additionalProperties: false,
        properties: {
            error: {
                type: "string"
            }
        }
    },

    409: {
            type: "object",
            required: ["error"],
            additionalProperties: false,
            properties: {
                error: {
                    type: "string"
                }
            }
        }   
    }
} as const;

export async function userRoutes(
  app: FastifyInstance
): Promise<void> {
  app.post<{ Body: CreateUserBody }>(
    "/users",
    {
      schema: createUserSchema
    },
    async (request, reply) => {
    const username = request.body.username.toLowerCase();
    const password = request.body.password;

    const passwordValidation = validatePasswordPolicy(password, username);

    if (!passwordValidation.valid) {
        return reply.code(400).send({
            error: passwordValidation.reason
        });
    }

    const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id
      });

    const createdAt = new Date().toISOString();

    const user: StoredUser = {
        username,
        passwordHash,
        createdAt
    };

    const redisKey = `user:${username}`;

    const result = await redisClient.set(
        redisKey,
        JSON.stringify(user),
        {
          NX: true
        }
      );

      if (result === null) {
        return reply.code(409).send({
          error: "Username already exists."
        });
      }

      return reply.code(201).send({
        username,
        createdAt
      });
    }
  );
}