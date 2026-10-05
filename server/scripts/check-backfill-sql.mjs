/**
 * Validate that server/scripts/backfill-evm-address.sql actually parses and
 * runs against the live database.
 *
 * The file is a REPORT of hand-run SQL, which means a typo in it is invisible
 * until an operator runs it in psql during an incident. This executes every
 * uncommented statement in a read-only transaction that is then rolled back,
 * so it proves the SQL is valid without changing a single row.
 *
 * Usage: node --env-file=.env scripts/check-backfill-sql.mjs
 */
import { Client } from "pg";
import { readFileSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) {
	console.error("DATABASE_URL is not set. Run with --env-file=.env");
	process.exit(1);
}

const raw = readFileSync(new URL("./backfill-evm-address.sql", import.meta.url), "utf8");

// Strip line comments, then split on statement terminators. Safe here because
// the file contains no string literals containing a semicolon — the regex
// would need dollar-quoting awareness otherwise, and this is a fixed input.
const stripped = raw
	.split("\n")
	.map((l) => (l.trim().startsWith("--") ? "" : l))
	.join("\n");
const statements = stripped
	.split(";")
	.map((s) => s.trim())
	.filter((s) => s.length > 0);

const client = new Client({ connectionString: url });
await client.connect();

// Read-only transaction: every statement is proven to run, then discarded.
await client.query("BEGIN READ ONLY");
let failed = 0;
for (const stmt of statements) {
	const head = stmt.split("\n")[0].slice(0, 70);
	try {
		const res = await client.query(stmt);
		console.log(`OK   ${head} -> ${res.rowCount} row(s)`);
		for (const row of res.rows.slice(0, 10)) console.log("      ", JSON.stringify(row));
	} catch (err) {
		failed++;
		console.error(`FAIL ${head}`);
		console.error(`     ${err.message}`);
	}
}
await client.query("ROLLBACK");
await client.end();

console.log(`\n${statements.length} statement(s), ${failed} failure(s). Nothing was written (rolled back).`);
process.exit(failed === 0 ? 0 : 1);