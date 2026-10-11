import crypto from "node:crypto";
import pg from "pg";
import { localTestContext } from "./local-test-context.mjs";

const { databaseUrl, appOrigin } = localTestContext();
const pool = new pg.Pool({ connectionString: databaseUrl.toString() });
const credits = process.env.OMA_TEST_AUTH_CREDITS ?? "10000";
const identities = [
	{
		email: process.env.OMA_TEST_USER_EMAIL ?? "oma-test-user@local.test",
		name: "OMA Test User",
		role: "user",
	},
	{
		email: process.env.OMA_TEST_ADMIN_EMAIL ?? "oma-test-admin@local.test",
		name: "OMA Test Admin",
		role: "admin",
	},
];

try {
	for (const identity of identities) {
		const userResult = await pool.query(
			`INSERT INTO "user" (id, name, email, email_verified, role, banned, suspended)
			 VALUES ($1, $2, $3, true, $4, false, false)
			 ON CONFLICT (email) DO UPDATE SET
			   name = EXCLUDED.name,
			   email_verified = true,
			   role = EXCLUDED.role,
			   banned = false,
			   suspended = false,
			   updated_at = NOW()
			 RETURNING id, email, role`,
			[crypto.randomBytes(16).toString("hex"), identity.name, identity.email, identity.role],
		);
		const user = userResult.rows[0];

		await pool.query(
			`INSERT INTO credit_balances (user_id, balance_cents, total_deposited_cents, total_used_cents)
			 VALUES ($1, $2, $2, 0)
			 ON CONFLICT (user_id) DO NOTHING`,
			[user.id, credits],
		);

		const token = crypto.randomBytes(24).toString("base64url");
		// Match the magicLink plugin's storeToken: "hashed" setting. The raw
		// token belongs only in the one-time URL, never in the verification row.
		const tokenHash = crypto.createHash("sha256").update(token).digest("base64url");
		await pool.query(
			`INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, NOW(), NOW())`,
			[
				crypto.randomBytes(16).toString("hex"),
				`magic-link:${tokenHash}`,
				JSON.stringify({ type: "magic-link", email: identity.email, name: identity.name }),
				new Date(Date.now() + 10 * 60 * 1000),
			],
		);

		const verifyUrl = new URL("/api/auth/magic-link/verify", appOrigin);
		verifyUrl.searchParams.set("token", token);
		verifyUrl.searchParams.set("callbackURL", identity.role === "admin" ? "/admin" : "/dashboard");
		console.log(`${user.role}: ${user.email}`);
		console.log(`  magic link: ${verifyUrl.toString()}`);
	}
} finally {
	await pool.end();
}
