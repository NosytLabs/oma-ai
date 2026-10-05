/**
 * Read-only diagnostic: is the admin wallet actually BOUND to a user row?
 *
 * ADMIN_WALLET_ADDRESSES being set in the env is necessary but not sufficient.
 * requireAdmin() reads user.evm_address from Postgres, so if the wallet never
 * got persisted onto a user row the allowlist never matches and /admin 403s.
 *
 * Usage: node --env-file=.env.neon.prod scripts/check-admin-binding.mjs
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const ADMIN = (process.env.ADMIN_WALLET_ADDRESSES ?? "")
	.split(",")
	.map((a) => a.trim().toLowerCase())
	.filter(Boolean);

console.log("ADMIN_WALLET_ADDRESSES:", ADMIN.join(", ") || "(empty)");

const adminRows = await sql`
	SELECT u.id, u.email, u.name, u.role, u.evm_address, u.is_anonymous, u.suspended, u.created_at
	FROM "user" u
	WHERE lower(u.evm_address) = ANY(${sql.array ? ADMIN : ADMIN})
`;
console.log("\nusers with an admin-wallet evm_address:", adminRows.length);
for (const r of adminRows) console.log(" ", JSON.stringify(r));

const roleAdmins = await sql`
	SELECT id, email, evm_address, role FROM "user" WHERE role = 'admin'
`;
console.log("\nrole=admin users:", roleAdmins.length);
for (const r of roleAdmins) console.log(" ", JSON.stringify(r));

const wallet = await sql`
	SELECT id, user_id, address, chain_id, created_at FROM wallet_address
	WHERE lower(address) = ANY(${ADMIN})
`;
console.log("\nwallet_address rows for admin wallet:", wallet.length);
for (const r of wallet) console.log(" ", JSON.stringify(r));

const orphan = await sql`
	SELECT count(*)::int AS n FROM "user" WHERE evm_address IS NULL
`;
console.log("\nusers with evm_address IS NULL:", orphan[0].n);

const total = await sql`SELECT count(*)::int AS n FROM "user"`;
console.log("total users:", total[0].n);