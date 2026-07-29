import { auth } from "../src/auth.js";
import { config } from "../src/config.js";
import { db } from "../src/db/client.js";
import * as schema from "../src/db/schema.js";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

const email = process.argv[2] ?? "admin@oma-ai.com";
const name = process.argv[3] ?? "OMA Admin";

let [user] = await db
  .select()
  .from(schema.user)
  .where(eq(schema.user.email, email))
  .limit(1);
if (!user) {
  [user] = await db
    .insert(schema.user)
    .values({ id: `usr_${nanoid(24)}`, name, email, emailVerified: true, role: "admin" })
    .returning();
} else if (user.role !== "admin") {
  [user] = await db
    .update(schema.user)
    .set({ role: "admin" })
    .where(eq(schema.user.id, user.id))
    .returning();
}

const ctx = await (auth as any).$context;
const adapter = ctx.internalAdapter ?? ctx.adapter;
const session = await adapter.createSession(user.id);
const token = session.token;

const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(config.BETTER_AUTH_SECRET),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"],
);
const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token));
const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));

console.log(
  JSON.stringify(
    {
      userId: user.id,
      email,
      role: user.role,
      cookie: `oma.session_token=${token}.${signature}`,
    },
    null,
    2,
  ),
);
process.exit(0);
