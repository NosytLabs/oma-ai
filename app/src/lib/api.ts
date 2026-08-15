/**
	* Backward-compatible re-export shim.
	*
	* The implementation has been split into per-resource modules under
	* `app/src/lib/api/`:
	*
	*   - `./api/client.ts`   — `request()`, `ApiError`, `BackendUnavailableError`, cache helpers
	*   - `./api/types.ts`    — all response/request interfaces
	*   - `./api/auth.ts`     — `api.auth.*` (SIWE, magic-link, sessions, keys)
	*   - `./api/deposit.ts`  — `api.deposit.*` (USDC on Base, status)
	*   - `./api/resources.ts`— `api.balance`, `api.usage`, `api.models`
	*   - `./api/inference.ts`— `api.health`
	*   - `./api/index.ts`    — composite `api` object + barrel re-exports
	*
	* All `import { api, type Foo } from '@/lib/api'` call sites continue to
	* work unchanged via this re-export.
	*/
export * from "./api/index";
