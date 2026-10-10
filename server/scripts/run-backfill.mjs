/**
 * Apply the evm_address backfill for unambiguous users, then verify.
 *
 * The dry-run report is scripts/backfill-evm-address.sql. This executes the
 * UPDATE from its section 3 (single-wallet, primary, unambiguous only) inside
 * a transaction and prints the rows it touched.
 *
 * Defaults to a dry run. --apply explicitly enables the guarded transaction.
 *
 * Usage: node --env-file=.env scripts/run-backfill.mjs [--apply]
 */
import { Client } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
	console.error("DATABASE_URL is not set. Run with --env-file=.env");
	process.exit(1);
}
const dryRun = !process.argv.includes("--apply");
if (process.argv.includes("--apply") && process.argv.includes("--dry-run")) {
	throw new Error("Choose --apply or --dry-run, not both.");
}

const client = new Client({ connectionString: url });
await client.connect();

// Matches the guard in backfill-evm-address.sql section 3: only users with
// exactly one primary wallet_address row can be auto-resolved.
const CANDIDATES = `
	SELECT u.id AS user_id, u.email, w.address, w.chain_id
	FROM "user" u
	JOIN wallet_address w ON w.user_id = u.id
	WHERE u.evm_address IS NULL
		AND w.is_primary
		-- "exactly one primary row", not "no primary row". Without
		-- w2.id <> w.id the subquery matches w ITSELF and NOT EXISTS is
		-- false for every candidate, silently reporting zero backfills.
		AND NOT EXISTS (
			SELECT 1 FROM wallet_address w2
			WHERE w2.user_id = u.id AND w2.is_primary AND w2.id <> w.id
		)
	ORDER BY u.created_at`;

const candidates = await client.query(CANDIDATES);
console.log(`${candidates.rowCount} unambiguous candidate(s):`);
for (const r of candidates.rows) {
	console.log(`  ${r.user_id}  ${r.email}  ->  ${r.address} (chain ${r.chain_id})`);
}

const ambiguous = await client.query(`
	SELECT u.id, u.email, COUNT(*) AS n
	FROM "user" u
	JOIN wallet_address w ON w.user_id = u.id
	WHERE u.evm_address IS NULL
	GROUP BY u.id, u.email
	HAVING COUNT(*) > 1`);
if (ambiguous.rowCount > 0) {
	console.log(`\n${ambiguous.rowCount} AMBIGUOUS user(s) needing manual review (skipped):`);
	for (const r of ambiguous.rows) console.log(`  ${r.id}  ${r.email}  (${r.n} wallets)`);
}

if (dryRun || candidates.rowCount === 0) {
	console.log(dryRun ? "\nDry run - nothing written." : "\nNothing to backfill.");
	await client.end();
	process.exit(0);
}

await client.query("BEGIN");
try {
	const updated = await client.query(`
		UPDATE "user" u
		   SET evm_address = w.address
		  FROM wallet_address w
		 WHERE w.user_id = u.id
		   AND u.evm_address IS NULL
		   AND w.is_primary
		   -- "exactly one primary row", not "no primary row". Without
		   -- w2.id <> w.id the subquery matches w ITSELF and NOT EXISTS is
		   -- false for every candidate, silently backfilling nothing.
		   AND NOT EXISTS (
		         SELECT 1 FROM wallet_address w2
		          WHERE w2.user_id = u.id AND w2.is_primary AND w2.id <> w.id
		   )
		RETURNING u.id, u.email, u.evm_address`);
	await client.query("COMMIT");
	console.log(`\nBackfilled ${updated.rowCount} row(s):`);
	for (const r of updated.rows) console.log(`  ${r.id}  ${r.email}  ->  ${r.evm_address}`);
} catch (err) {
	await client.query("ROLLBACK");
	// 23505 here means two users share a wallet row and idx_user_evm_address_unique
	// refused the write. Do NOT drop the index - resolve the duplicate rows.
	console.error(`Backfill failed and was rolled back: code=${err.code} ${err.message}`);
	process.exitCode = 1;
}

const remaining = await client.query(
	`SELECT id, email FROM "user" WHERE evm_address IS NULL AND id IN (SELECT user_id FROM wallet_address)`,
);
console.log(`\nUsers still wallet-linked but missing evm_address: ${remaining.rowCount}`);
for (const r of remaining.rows) console.log(`  ${r.id}  ${r.email}`);

await client.end();
