import Fastify, { type FastifyInstance } from "fastify";

import { redisClient } from "./redis.js";
import { userRoutes } from "./routes/users.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: false,

    ajv: {
      customOptions: {
        coerceTypes: false,
        removeAdditional: false
      }
    }
  });

  app.get("/health", async () => {
    const redisResponse = await redisClient.ping();

    return {
      status: "ok",
      redis: redisResponse
    };
  });

  app.register(userRoutes);

  return app;
}