/**
 * @deprecated Import from `@/lib/api` (the directory barrel) instead.
 *
 * This file is a thin re-export shim that preserves the historical
 * `app/src/lib/api.ts` import path. The implementation has been split into
 * per-resource modules under `app/src/lib/api/`:
 *
 *   - `./api/client.ts`   — `request()`, `ApiError`, `BackendUnavailableError`, cache helpers
 *   - `./api/types.ts`    — all response/request interfaces
 *   - `./api/auth.ts`     — `api.auth.*` (SIWE, Solana, sessions, keys)
 *   - `./api/deposit.ts`  — `api.deposit.*` (USDC, OMA, Houdini, status)
 *   - `./api/resources.ts`— `api.balance`, `api.usage`, `api.models`
 *   - `./api/inference.ts`— `api.inference`, `api.x402`, `api.health`
 *   - `./api/admin.ts`    — `api.admin.*`
 *   - `./api/webhooks.ts` — `api.webhooks`, `api.recoveries`
 *   - `./api/index.ts`    — composite `api` object + barrel re-exports
 *
 * All existing `import { api, type Foo } from '@/lib/api'` call sites
 * continue to work unchanged.
 */
export * from './api/index';
