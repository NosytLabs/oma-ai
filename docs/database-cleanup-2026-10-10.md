# Database cleanup receipt — October 10, 2026

Production target: Neon project `empty-bar-94645349`, branch `br-sweet-rain-b40o54xa`.

Read-only inventory found 6 expired sessions, 14 expired verification records, and these unused test identities:

| Identity | ID | Dependencies |
|---|---|---|
| oma-test-user@local.test | c75ff9959f60158fad1fefa31eac2430 | No active sessions, deposits, usage, payment claims, credit batches or API keys |
| oma-test-admin@local.test | 1d2f19d0afe6b098222a885fb2f0a8e0 | No active sessions, deposits, usage, payment claims or credit batches; one active `operator-debug` API key, last used October 5 |

The user selected **“Remove expired auth records only”**. The transaction deleted 6 expired sessions and 14 expired verification records using the fixed cutoff `2026-10-10T22:40:00Z`. A read-only follow-up confirmed zero expired records before that cutoff. Both test identities and the active `operator-debug` key are preserved, along with real accounts, financial records, audit history, signup-grant anti-abuse records, durable payment claims, indexes and tables.

The Neon MCP's `run_sql_transaction` explicitly says: “NEVER run destructive SQL autonomously; always ask the user first.” The user authorized only the expired authentication records; no production identity was deleted.

Local development cleanup uses `server/scripts/cleanup-local-data.mjs`. It defaults to a dry run, only accepts loopback database hosts in development/test, backs up the full local database before applying, and only removes a fixed list of historical test emails. Current `oma-test-*` fixtures and the founder account remain available for browser checks. The script refuses to remove a candidate with payment or settlement records.

Local execution removed 9 historical test identities and 27 expired sessions (13 through account cascades and 14 directly). No verification records were expired. The full pre-cleanup backup is `.artifacts/database-backups/local-1791672109352.dump`, outside Git and restricted to its owner. The current user/admin fixtures remain. Missing local recovery tables were brought up to date with migrations 0002 and 0003; no production migration or financial cleanup was needed.
