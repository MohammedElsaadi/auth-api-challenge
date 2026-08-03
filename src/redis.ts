import "dotenv/config";
import { createClient } from "redis";

const redisPassword = process.env.REDIS_PASSWORD;

if (!redisPassword) {
  throw new Error("REDIS_PASSWORD is not configured.");
}

const redisPort = Number(process.env.REDIS_PORT ?? "6379");

if (
  !Number.isInteger(redisPort) ||
  redisPort < 1 ||
  redisPort > 65535
) {
  throw new Error("REDIS_PORT must be a valid port number.");
}

export const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST ?? "127.0.0.1",
    port: redisPort
  },
  password: redisPassword
});

redisClient.on("error", (error: Error) => {
  console.error("Redis client error:", error.message);
});

export async function connectRedis(): Promise<void> {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient.isOpen) {
    await redisClient.close();
  }
}