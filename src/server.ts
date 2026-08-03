import Fastify from "fastify";

import {
  connectRedis,
  disconnectRedis,
  redisClient
} from "./redis.js";

import { userRoutes } from "./routes/users.js";

const app = Fastify({
  logger: true,

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

app.addHook("onClose", async () => {
  await disconnectRedis();
});

async function start(): Promise<void> {
  try {
    await connectRedis();

    app.log.info("Connected to Redis");

    await app.listen({
      host: "127.0.0.1",
      port: 3000
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

await start();