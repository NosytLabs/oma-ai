import { createClient } from "redis";
import { config } from "../config.js";

let redisClient: ReturnType<typeof createClient> | null = null;
let redisReady = false;

export async function getRedisClient() {
  if (redisClient && redisReady) return redisClient;
  try {
    if (!redisClient) {
      redisClient = createClient({ url: config.REDIS_URL ?? "redis://localhost:6379" });
      redisClient.on("error", () => { redisReady = false; });
      redisClient.on("ready", () => { redisReady = true; });
      await redisClient.connect();
      redisReady = true;
    }
    return redisClient;
  } catch {
    redisReady = false;
    return null;
  }
}

export function isRedisReady(): boolean {
  return redisReady;
}