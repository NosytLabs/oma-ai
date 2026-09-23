# OMA-AI Platform Research (Sep 2026) — Neon vs Supabase vs Lovable

Decision context: $200 Neon credits + $300 Supabase credits + 3mo Lovable Pro.

## Bottom line
**Stay on Neon for the core app.** The oma-ai server DB layer is Neon-native
(`@neondatabase/serverless`, `@neon/config`, `isNeonUrl()` in `server/src/db/client.ts`).
Supabase would be a rewrite, not a config swap. Lovable Pro is the wrong tool for this
codebase. Details below.

## Neon (current — app is built on it)
- Server runs on **Neon Functions** (Hono, `@neon/config`), Postgres via
  `@neondatabase/serverless` HTTP driver (pgbouncer pool), Better Auth self-hosted,
  own WebSocket server (no Neon realtime needed).
- **$200 credits** → covers Launch-tier (pay-as-you-go, $0.106/CU-hr, 0.5–∞ GB,
  $0.025/Capacity-Hr functions, $0.60/M), likely free-to-cheap for a small app.
- Free plan alone: 100 CU-hrs/project, 0.5GB storage, 60k MAU auth, Functions 1M inv.
- **Zero migration, zero rewrite — lowest dev cost path by far.**

## Supabase ($300 credits) — "unlimited API requests" nuance
- Supabase's "unlimited API requests" refers to **Row-Level-Security-gated table access
  via PostgREST + the anon/public key** — a different *architecture* than oma-ai's.
  oma-ai **does not use PostgREST/RLS**: it queries Postgres from a Hono server with
  Better Auth + app-level authorization. Those "unlimited API requests" are the client-side
  REST+RLS model; the app would have to be rearchitected to use it.
- Supabase value (Realtime WebSockets, Storage, Auth) overlaps what the app already has
  (own WS server, own auth). Migrating = rewrite DB client + auth + realtime → high dev cost.
- **Hold the $300 credit for a future satellite service** (e.g. realtime presence, file
  storage for generated media), not a risky core migration.

## Lovable Pro (3mo free)
- AI web-app builder (React/Tailwind → Supabase backend). For non-devs prototyping MVPs.
- **Wrong tool for oma-ai:** ~10-screen complexity ceiling, credits burn on debug loops,
  generated code accrues technical debt. oma-ai is hand-written NextJS/Hono with 300+ tests.
- Useful only for a throwaway landing page / internal tool experiment, not this codebase.

## Where the real cost goes (must stay minimal)
- Vercel: 1 production deploy (Hobby). Neon: serverless (scale-to-zero, only pay active).
- AI inference: free models via AntSeed `glm-5-3-flash`/`deepseek-v4-flash` + QuickNode
  free tier (10M credits/mo) as Base RPC.
- Settlement: self-hosted coinbase-cdp, gas ~$0.0001/tx (needs treasury funding to go live).
