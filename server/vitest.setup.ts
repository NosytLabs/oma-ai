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

// Enable development mode for all tests so SURPLUS provider is available
// (SURPLUS_ENABLED requires NODE_ENV === "development" to prevent accidental production use)
process.env.NODE_ENV = 'development';

// Force-clear provider API keys so test env is deterministic. Without this,
// shell env (e.g. VENICE_API_KEY exported in ~/.zshrc) leaks into vitest and
// flips VENICE_CONFIGURED true, breaking the keyless-deploy catalog tests.
delete process.env.VENICE_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.ANTHROPIC_API_KEY;

// Surplus wallet key - required for SURPLUS_ENABLED to be true in tests
if (!process.env.SURPLUS_WALLET_PRIVATE_KEY) {
  process.env.SURPLUS_WALLET_PRIVATE_KEY = '0x' + 'a1'.repeat(31) + 'b1'; // valid hex format for test
}

// Required by config.ts validation. Tests that need different values
// override these per-file via vi.stubEnv().
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
}
if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-min-for-dev'
}

// Required by config.ts: the schema requires a non-empty RPC URL when the
// test environment does not provide one.
if (!process.env.CHAIN_RPC_URL) {
  process.env.CHAIN_RPC_URL = 'https://base-rpc.publicnode.com'
}
