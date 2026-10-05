-- One-off backfill: populate user.evm_address from wallet_address.
--
-- WHY THIS IS NEEDED
-- The better-auth SIWE plugin writes a `wallet_address` row during
-- /siwe/verify, but user.evm_address is populated by a SEPARATE `after` hook
-- (server/src/auth.ts, the /siwe/verify branch). Any user whose sign-in
-- succeeded while that hook threw, or who signed in before the hook existed,
-- ends up with a linked wallet and evm_address = NULL.
--
-- The damage is not cosmetic: requireAdmin() reads user.evm_address (never
-- wallet_address) to decide admin rights, and GET /v1/user computes the same
-- predicate for the client-side admin gate. So a wallet-linked admin with a
-- NULL evm_address is a 403 on every admin route even though the address is
-- in ADMIN_WALLET_ADDRESSES.
--
-- USAGE
--   Dry run (always do this first):
--     psql "$DATABASE_URL" -f server/scripts/backfill-evm-address.sql
--   Then apply the UPDATE in section 3 by hand, inside a transaction.
--
-- This file is intentionally a REPORT, not an UPDATE. It is not wired into
-- migrations or CI: a blanket UPDATE against the live user table is not
-- something that should ever run unattended.

-- 1. What WOULD change. Expect this to be small.
SELECT
    u.id                                   AS user_id,
    u.email                                AS email,
    w.address                              AS wallet_address,
    w.chain_id                             AS chain_id,
    u.created_at                           AS user_created_at,
    w.created_at                           AS wallet_linked_at
FROM "user" u
JOIN wallet_address w
    ON w.user_id = u.id
WHERE u.evm_address IS NULL
ORDER BY u.created_at;

-- 2. Sanity: a user with MULTIPLE wallet rows and a NULL evm_address cannot be
-- auto-resolved — "which wallet is primary" is genuinely ambiguous, because
-- uq_wallet_addr_user_chain is (user_id, chain_id) so one wallet may hold rows
-- on more than one chain. Resolve these by hand BEFORE applying section 3.
SELECT
    u.id                                   AS user_id,
    u.email                                AS email,
    COUNT(*)                               AS wallet_count,
    string_agg(w.address || ' (chain ' || w.chain_id || ', primary=' || w.is_primary || ')', ', ')
                                        AS wallets
FROM "user" u
JOIN wallet_address w
    ON w.user_id = u.id
WHERE u.evm_address IS NULL
GROUP BY u.id, u.email
HAVING COUNT(*) > 1;

-- 3. The UPDATE. Apply manually, in a transaction, after reviewing (1) and (2):
--
--      BEGIN;
--      UPDATE "user" u
--         SET evm_address = w.address
--        FROM wallet_address w
--       WHERE w.user_id = u.id
--         AND u.evm_address IS NULL
--         -- Only unambiguous users: exactly one wallet_address row, and it is
--         -- the primary. Multi-wallet users from report (2) are deliberately
--         -- excluded so an ambiguous bind can never be written silently.
--         AND w.is_primary
--         -- "exactly one primary row", NOT "no primary row". Without
--         -- `w2.id <> w.id` the subquery matches w ITSELF, so NOT EXISTS is
--         -- false for every candidate and the UPDATE silently writes nothing.
--         AND NOT EXISTS (
--               SELECT 1 FROM wallet_address w2
--                WHERE w2.user_id = u.id AND w2.is_primary AND w2.id <> w.id
--           );
--    COMMIT;
--
--    Re-run report (1) afterwards — it must return zero rows. If it does not,
--    the COMMIT did not land or an ambiguous user remains.
--
--    scripts/run-backfill.mjs executes exactly this statement (with the same
--    w2.id <> w.id guard) and is the preferred way to apply it.
--
--    Note: idx_user_evm_address_unique (UNIQUE on evm_address WHERE NOT NULL)
--    is a second guard. If two users somehow share a wallet row the UPDATE
--    fails with 23505 rather than silently merging identities — do NOT "fix"
--    that by dropping the index.

-- 4. Post-check: the admin allowlist must resolve to a real user row.
--    Substitute the live ADMIN_WALLET_ADDRESSES value from the deploy env.
-- SELECT u.id, u.email, u.role, u.evm_address
--   FROM "user" u
--  WHERE lower(u.evm_address) =
--        lower('0x19C4c364d1CbB59a876aaD9F8953184a3F1302D4');

SELECT 1;  -- keeps this file runnable as a pure report