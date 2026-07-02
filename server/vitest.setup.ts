/**
 * Vitest setup — runs before any test file is loaded.
 *
 * Sets required env vars to test placeholder values so config.ts's zod
 * parse doesn't fail at module load time. These are dev-only placeholders;
 * production uses real secrets in server/.env (gitignored).
 *
 * The .env file is NOT auto-loaded by vitest, and we don't want a hidden
 * dependency on shell env either. This file is the single source of truth
 * for test env defaults.
 */

// Required for config.ts schema parse — has min(1) constraint and tests
// mutate it to "" to exercise the "not configured" code path.
if (!process.env.OPENROUTER_API_KEY) {
  process.env.OPENROUTER_API_KEY = 'sk-or-test-key-for-local-dev-only'
}

// Required by config.ts validation. Tests that need different values
// override these per-file via vi.stubEnv().
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32-chars-long'
}
if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-min-for-dev'
}

// Required by config.ts: z.string().min(1).optional().default("")
// The schema's `.default("")` is still subject to the `.min(1)` constraint, so
// an unset env var (or empty string) fails validation. Set a placeholder here.
// Tests that need the "not configured" code path should mock `../config.js`
// directly (e.g. `vi.mock('../config.js', () => ({ config: { CHAIN_RPC_URL: undefined } }))`)
// — vi.stubEnv with `''` would still trigger the min(1) check.
if (!process.env.CHAIN_RPC_URL) {
  process.env.CHAIN_RPC_URL = 'https://base-rpc.publicnode.com'
}
