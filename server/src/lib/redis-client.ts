import { createClient } from "redis";
import { config } from "../config.js";

let redisClient: ReturnType<typeof createClient> | null = null;
let redisReady = false;

export async function getRedisClient() {
  if (redisClient && redisReady) return redisClient;
  try {
    if (!redisClient) {
      const url = config.REDIS_URL ?? "redis://localhost:6379";

      const redisOptions: Record<string, unknown> = {
        url,
        socket: {
          keepAlive: true,
          connectTimeout: 10000,
        },
      };

      try {
        const parsed = new URL(url);
        if (parsed.password) {
          redisOptions.password = parsed.password;
        }
      } catch {
        // Invalid URL, skip password extraction
      }

      if (url.startsWith("rediss://")) {
        (redisOptions.socket as Record<string, unknown>).tls = true;
      }

      redisClient = createClient(redisOptions as Parameters<typeof createClient>[0]);
      (redisClient as unknown as { commandTimeout: number }).commandTimeout = 5000;
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

export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    redisReady = false;
  }
}

if (config.NODE_ENV !== "test") {
  process.on("SIGTERM", async () => {
    await closeRedisClient();
  });
  process.on("SIGINT", async () => {
    await closeRedisClient();
  });
}

export function isRedisReady(): boolean {
  return redisReady;
}

export async function redisHealthCheck(): Promise<{ status: string; latency?: number }> {
  const client = await getRedisClient();
  if (!client) return { status: "disconnected" };
  try {
    const start = Date.now();
    await client.ping();
    return { status: "ok", latency: Date.now() - start };
  } catch {
    return { status: "error" };
  }
}