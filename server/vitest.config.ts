import { defineConfig } from 'vitest/config'

// Bootstrap the test-only env defaults BEFORE any module is loaded.
// config.ts validates these at import time, so the values must be in
// process.env before the first `import "../config.js"` runs. Without
// this, any test that transitively imports polar.ts → config.ts (which
// includes the new polar-usage hook → router → every router test) fails
// with `FATAL: JWT_SECRET must be configured with at least 32 chars`.
process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-must-be-at-least-32-chars-long';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test';
process.env.SURPLUS_WALLET_PRIVATE_KEY = process.env.SURPLUS_WALLET_PRIVATE_KEY ?? ('0x' + 'a1'.repeat(31) + 'b1');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // 2026-07-31: deposit-recovery test re-enabled after fixing two mock
    // bugs: (1) beforeEach used clearAllMocks, which does not drop queued
    // mockResolvedValueOnce values, so each test consumed the previous
    // test's stale getTransaction input ("queue shift"); now uses
    // resetAllMocks. (2) parseAbi was mocked to vi.fn() returning
    // undefined, so TRANSFER_ABI[0] threw inside runRecoveryIteration and
    // the outer catch returned fromBlock; now returns a real ABI shape.
    exclude: ['dist/**', 'node_modules/**'],
    setupFiles: ['./vitest.setup.ts'],
  },
})
