/**
 * Vitest setup — runs before any test file is loaded.
 *
 * Sets required env vars to test placeholder values so config.ts's zod
 * parse doesn't fail at module load time. These are test-only placeholders;
 * production uses real secrets in server/.env (gitignored).
 *
 * The .env file is NOT auto-loaded by vitest, and we don't want a hidden
 * dependency on shell env either. This file is the single source of truth
 * for test env defaults.
 */

// Keep database/auth safety guards in test mode. Using development here made
// isolated route tests call process.exit(1) when their mocked DB was imported.
process.env.NODE_ENV = 'test';

// Force-clear provider API keys so test env is deterministic. Without this,
// shell env (e.g. VENICE_API_KEY exported in ~/.zshrc) leaks into vitest and
// flips VENICE_CONFIGURED true, breaking the keyless-deploy catalog tests.
delete process.env.VENICE_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.ANTHROPIC_API_KEY;

// x402 facilitator/tests: pin to mock mode so a shell/.env export of
// FACILITATOR_MODE=live (production-adjacent dev machines) doesn't make
// treasury.ts throw FATAL "SERVER_TREASURY is empty in live mode" at import,
// breaking the whole suite. Tests for live/fail-closed behavior override
// this explicitly via vi.stubEnv().
process.env.FACILITATOR_MODE = 'mock';
delete process.env.TREASURY_BASE_ADDRESS;

// Tests never run as a deployed Neon Function. If NEON_FUNCTION=1 is leaked
// from the shell (e.g. from `neonctl config apply`/deploy tooling), the
// config.ts deployed-function guard throws "must run with NODE_ENV=production"
// and takes the whole suite down. Clear deploy-only env so the local test
// process can't be mistaken for a live function.
delete process.env.NEON_FUNCTION;
delete process.env.ALLOW_DEV_MODE_DEPLOY;

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
