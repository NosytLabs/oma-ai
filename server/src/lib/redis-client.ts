import { createClient } from "redis";
import { config } from "../config.js";

let redisReady = false;
let connectionFailed = false;
let connectionAttempted = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

function createConfiguredRedisClient(url: string) {
		return createClient({
				url,
				socket: {
						connectTimeout: 2000,
						reconnectStrategy: (retries: number) => {
								if (retries > MAX_RECONNECT_ATTEMPTS) {
										connectionFailed = true;
										reconnectAttempts = retries;
										return false;
								}
								const delay = Math.min(retries * 100, 3000);
								reconnectAttempts = retries;
								return delay;
						},
				},
		});
}

type RedisClient = ReturnType<typeof createConfiguredRedisClient>;

let redisClient: RedisClient | null = null;
let connectionPromise: Promise<RedisClient | null> | null = null;

async function createRedisConnection(): Promise<RedisClient | null> {
		const url = config.REDIS_URL ?? "redis://localhost:6379";
		
		let parsedUrl: URL;
		try {
				parsedUrl = new URL(url);
		} catch {
				connectionFailed = true;
				return null;
		}
		
		try {
				const client = createConfiguredRedisClient(parsedUrl.toString());
				
				client.on("error", (err) => {
						// Only fatal connection-level errors should mark the client as failed.
						// Transient command errors (e.g. a rejected Lua script) must NOT poison
						// the whole client — otherwise one bad EVAL permanently 503s every
						// inference request until restart.
						const msg = String(err?.message ?? err);
						if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|socket closed|Connection is closed|NOAUTH|denied/i.test(msg)) {
								connectionFailed = true;
						}
				});
				client.on("ready", () => {
						redisReady = true;
				});
				
				let timer: ReturnType<typeof setTimeout> | undefined;
				const connectPromise = client.connect();
				// Swallow any late rejection so a timeout win never leaves an
				// unhandledRejection behind (and vice versa for the timer below).
				connectPromise.catch(() => {});
				await Promise.race([
						connectPromise,
						new Promise<never>((_, reject) => {
								timer = setTimeout(() => reject(new Error("timeout")), 2000);
						}),
				]).finally(() => clearTimeout(timer));
				
				return client;
		} catch {
				connectionFailed = true;
				return null;
		}
}

export async function getRedisClient(): Promise<RedisClient | null> {
		if (connectionFailed && connectionAttempted && reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
				return null;
		}
		
		if (redisClient && redisReady) {
				return redisClient;
		}
		
		if (!connectionPromise) {
				connectionAttempted = true;
				connectionPromise = createRedisConnection().then((client) => {
						if (client) {
								redisClient = client;
								redisReady = true;
						}
						return client;
				}).finally(() => {
						connectionPromise = null;
				});
		}
		
		return connectionPromise;
}

export async function closeRedisClient(): Promise<void> {
		if (redisClient) {
				try {
						await redisClient.quit();
				} catch { /* ignore */ }
				redisClient = null;
				redisReady = false;
		}
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