import { defineConfig } from 'vitest/config'

// Bootstrap test-only env defaults before any module is loaded.
// config.ts validates these at import time, so the values must be in
// process.env before the first config import runs.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    maxWorkers: 4,
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    setupFiles: ['./vitest.setup.ts'],
  },
})
