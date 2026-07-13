# DEPLOY_STATUS.md

> Captured during the 2026-07 repo audit. Records discrepancies between the
> running production site and this repository, plus security flags that need
> human action.

## 1. Live site vs. repository drift (CRITICAL)

| | Live site (https://oma-ai.com) | This repo (`app/`) |
|---|---|---|
| Product | **MCP Marketplace** — discover/install/pay-per-call MCP tools via x402 | **AI inference gateway** — OpenAI-compatible `/v1/chat/completions`, wallet auth, x402, credits |
| Auth | x402 HTTP 402 pay-per-call | `oma_sk_*` API keys + wallet + x402 |
| Payments | USDC on Base **+ Solana** | USDC on Base (per docs) |
| DB | Supabase (PostgreSQL + Auth + Realtime) | Drizzle ORM + PostgreSQL |
| Catalog | "229+ MCP tools" | `{MODEL_COUNT}` chat models |

**The running site is a different codebase than what is in this repo.** It is
not built from `app/` as committed. Before any deploy, decide which is the
source of truth:

- If `app/` is the intended product, the live site is stale/divergent and a
  deploy is required (and the public docs/landing should reflect the gateway).
- If the MCP marketplace is the intended product, `app/` may be a separate
  work-in-progress that should not be deployed as-is.

Action needed: **confirm with repo owner which artifact is production.**

## 2. Security flags

- ✅ **Quiknode RPC credential in `app/.env.local`** — gitignored, present on
  disk with an embedded token. **Action: rotate the Quiknode token externally**
  (the value persists in the local file until you do). The `.env.local.bak`
  copy has been **purged from disk**.
- ✅ **`server/.env` / `server/.env.bak`** — both gitignored; the `.bak` has
  been **purged from disk**. **`server/.env` remains** — rotate any secrets it
  holds before reusing.
- ✅ `.env*` correctly gitignored (with `!.env.example` carve-out). Confirmed
  zero tracked env files. `.bak` backup files (`*.bak`, `*.backup`, `*.orig`,
  `*.swp`, `*.swo`, `*~`) are explicitly ignored.
- Recommended: run `gitleaks` (or `git log -p --all -- <file>`) to confirm no
  secret has ever been committed historically.

## 3. Refactor completed (this audit)

- `app/src/app/docs/page.tsx` (2158 lines) split into 11 section modules under
  `app/src/app/docs/sections/` + shared `shared.tsx`. `page.tsx` is now a ~190
  line shell (Sidebar + DocsContent + DocsPage). `pnpm typecheck` passes.
- Removed duplicate `--color-success` in `app/src/app/globals.css`.
- Deleted untracked-but-git-indexed `app/public/screenshots-ux/` (8 PNGs, ~2.5 MB);
  added to `.gitignore`.
- Trimmed root `.gitignore` from ~90 stale rules to canonical patterns.
- Added explicit `*.bak`, `*.backup`, `*.orig`, `*.swp`, `*.swo`, `*~` entries
  to `.gitignore` to prevent backup files from ever being tracked.
- Fixed 4 pre-existing lint errors: `compare/page.tsx` (unused Breadcrumb
  import) + `server/src/inference/gonka.ts` (3 unused imports). `pnpm
  typecheck` + `pnpm lint` now pass clean for both `app/` and `server/`.

## 4. Remaining large files (not split this round)

- `server/src/routes/openapi.ts` (~2171 lines)
- `server/src/x402/facilitator.ts` (~1647 lines)

Consider modularizing in a follow-up if they become edit hotspots.

## 5. Repo code UI/UX state

The `app/` codebase is a polished **AI inference gateway** UI (Crypto Terminal
× Editorial design system — emerald on void, Instrument Serif / Geist / Geist
Mono, 4 theme variants emerald/amber/mono/synth). It is *not* the same product
as the live site at oma-ai.com (see §1). Quality of the design system, CSS
tokens, and theme variants in `app/src/app/globals.css` is solid: no duplicate
tokens, all keyframes have consumers, well-organized layer structure. The live
site appears to be a separate, more marketing-heavy codebase ("MCP Marketplace"
landing with synthetic testimonials).
