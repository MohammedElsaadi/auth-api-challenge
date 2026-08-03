import { buildApp } from "./app.js";
import {
  connectRedis,
  disconnectRedis
} from "./redis.js";

const app = buildApp();

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