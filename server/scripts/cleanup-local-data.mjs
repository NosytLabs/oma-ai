/** Dry-run by default; --apply saves a full local backup before removing old fixtures. */
import { mkdir, chmod, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { localTestContext } from "./local-test-context.mjs";

const { databaseUrl } = localTestContext();
const apply = process.argv.includes("--apply");
const oldEmails = ["admin@example.com", "audit-1786824811@oma-ai.com", "authflow+test@nosytlabs.com",
	"devtest@oma-ai.local", "fresh+test@nosytlabs.com", "oma.qa.hermes@example.com",
	"oma.qa.hermes2@example.com", "tyson+test@nosytlabs.com", "tyson@oma-test.dev"];
const pool = new pg.Pool({ connectionString: databaseUrl.toString() });
const client = await pool.connect();
try {
	await client.query("BEGIN");
	const candidates = await client.query('SELECT id, email FROM "user" WHERE email = ANY($1) FOR UPDATE', [oldEmails]);
	const ids = candidates.rows.map(u => u.id);
	const protectedRows = await client.query(`SELECT
	 (SELECT count(*) FROM deposits WHERE user_id=ANY($1)) AS deposits,
	 (SELECT count(*) FROM settlements) AS settlements,
	 (SELECT count(*) FROM payment_credit_claims WHERE credited_user_id=ANY($1)) AS payment_claims`, [ids]);
	if (Object.values(protectedRows.rows[0]).some(n => Number(n)>0)) throw new Error("Historical test identities have financial records; refusing automatic cleanup.");
	const cutoff = new Date();
	const expired = (await client.query(`SELECT
	 (SELECT count(*) FROM session WHERE expires_at<$1) AS sessions,
	 (SELECT count(*) FROM verification WHERE expires_at<$1) AS verifications`, [cutoff])).rows[0];
	console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", candidates: candidates.rows.map(u=>u.email), expired }, null, 2));
	if (!apply) { await client.query("ROLLBACK"); }
	else {
		const backupDir = fileURLToPath(new URL("../../.artifacts/database-backups/", import.meta.url));
		await mkdir(backupDir, { recursive: true, mode: 0o700 });
		await chmod(backupDir, 0o700);
		const backup = `${backupDir}local-${Date.now()}.dump`;
		const dump = spawnSync("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--file", backup], {
			env: { ...process.env, PGHOST: databaseUrl.hostname.replace(/^\[|\]$/g, ""), PGPORT: databaseUrl.port || "5432",
				PGDATABASE: decodeURIComponent(databaseUrl.pathname.slice(1)), PGUSER: decodeURIComponent(databaseUrl.username),
				PGPASSWORD: decodeURIComponent(databaseUrl.password) }, encoding: "utf8",
		});
		if (dump.status !== 0 || !(await stat(backup)).size) throw new Error("Full local database backup failed; no cleanup was committed.");
		await chmod(backup, 0o600);
		const users = await client.query('DELETE FROM "user" WHERE id=ANY($1) AND email=ANY($2)', [ids, oldEmails]);
		const sessions = await client.query('DELETE FROM session WHERE expires_at<$1', [cutoff]);
		const verifications = await client.query('DELETE FROM verification WHERE expires_at<$1', [cutoff]);
		await client.query("COMMIT");
		console.log(JSON.stringify({ removed: { users: users.rowCount, sessions: sessions.rowCount, verifications: verifications.rowCount }, backup }));
	}
} catch (error) { await client.query("ROLLBACK"); throw error; }
finally { client.release(); await pool.end(); }
