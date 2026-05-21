import type { Context, Next } from "hono";
import { validateApiKey } from "./api-keys.js";
import { verifySessionToken } from "./siwe.js";
import type { OmaEnv } from "../types.js";

export async function bearerAuth(c: Context<OmaEnv>, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: { message: "Missing or invalid Authorization header", type: "authentication_error" } }, 401);
  }
  const rawKey = authHeader.slice(7);
  const apiKey = await validateApiKey(rawKey);
  if (!apiKey) {
    return c.json({ error: { message: "Invalid API key", type: "authentication_error" } }, 401);
  }
  c.set("apiKey", apiKey);
  c.set("userId", apiKey.userId);
  await next();
}

export async function sessionAuth(c: Context<OmaEnv>, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: { message: "Missing or invalid Authorization header", type: "authentication_error" } }, 401);
  }
  const token = authHeader.slice(7);
  const userId = await verifySessionToken(token);
  if (!userId) {
    return c.json({ error: { message: "Invalid or expired session token", type: "authentication_error" } }, 401);
  }
  c.set("userId", userId);
  await next();
}

export async function optionalAuth(c: Context<OmaEnv>, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const rawKey = authHeader.slice(7);
    const apiKey = await validateApiKey(rawKey);
    if (apiKey) {
      c.set("apiKey", apiKey);
      c.set("userId", apiKey.userId);
    }
  }
  await next();
}
