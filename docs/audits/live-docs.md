# OMA-AI live site + docs coherence audit (2026-09-27, read-only)

## High severity

### [D-1] deploy/STATUS.md:52-55 contradicts docs/DEPLOYMENT.md:44-46 — DEPLOYMENT is correct.
STATUS claims "Authenticated proxy handlers translate the HttpOnly application session into the authorization expected by the backend". DEPLOYMENT (correctly) says no such translation exists. Code proxy-handler.ts:26-35 forwards method/headers/body/cookies verbatim + x-oma-proxy-secret. STATUS.md is stale prose.
Fix: rewrite STATUS.md to describe what proxy-handler actually does.
Severity: HIGH
Status: OPEN

### [D-2] INTERNAL_PROXY_SECRET not documented anywhere
server/neon.ts: required for boot (comment: "made the function boot-fail on the production guard, because fnEnv() only forwards the vars listed here"). Read by app/src/lib/api/proxy-headers.ts:44, enforced server/src/config.ts:465-471. Appears in zero .md + zero .env.example.
Fix: add to PLATFORM.md §Required operator configuration + coolify/README.md + both .env.example files.
Severity: HIGH (live-billing safety relevant)
Status: OPEN

### [D-3] app/.env.example:54 recommends the forbidden host
Suggests BETTER_AUTH_URL=https://api.oma-ai.com. DEPLOYMENT.md:15 and PLATFORM.md:201 both state api.oma-ai.com is NXDOMAIN and must never exist. Also wrong on its own terms (line 52-53 says it must reach the Next app).
Fix: change to https://oma-ai.com.
Severity: MEDIUM-HIGH
Status: OPEN

### [D-4] LITELLM_API_KEY / LITELLM_API_URL undocumented
Read by server/src/config.ts, used at provider-route.ts:62-77 for the NVIDIA upstream, in APP_VARS. In zero docs. Commit 07c0ab42 added the upstream; docs not updated.
Fix: add to PLATFORM.md inference-provider block + server/.env.example.
Severity: MEDIUM
Status: OPEN

### [D-5] Live /ready failing — DEPLOYMENT.md:134 tells operators to curl exactly that
/ready → 503, "redis:{ok:false,status:degraded}". /health 200, /v1/models 200. DEPLOYMENT.md:137-139 instructs: "require a successful readiness response" — currently RED.
Not a doc bug — this is prod Redis degraded. Flag to operator. Needs Neon console / Upstash check.
Severity: HIGH (ops)
Status: OPEN

## Medium

### [D-6] scripts/dev/screenshot-audit.mjs:10 audits /models/kimi-k2-6 → 404 live. Catalog has kimi-k3 (app/src/lib/models-data.ts:602).
Fix: update the audit route or derive dynamically.
Status: OPEN

### [D-7] app/e2e/README.md:6,28 — /tmp/oma-audit is POSIX-path in a Windows-primary repo
screenshot-audit.mjs:5 hardcodes const DIR = "/tmp/oma-audit". Works in git-bash but won't match Hermes TMPDIR.
Fix: use TMPDIR-fallback or a relative path.
Status: OPEN

### [D-8] README.md:141-166 project structure wrong
docker-compose*.yml described as the production deploy path. DEPLOYMENT.md:154-159 + STATUS.md:63-67 both call them unused self-host. server/neon.ts omitted despite being the IaC manifest.
Fix: correct the tree comment, add server/neon.ts.
Status: OPEN

### [D-9] Endpoint docs incomplete
DEPLOYMENT.md:23-30 + PLATFORM.md:13-36 list 6 endpoints; live OpenAPI serves 12. Missing in .md: /v1/search /v1/usage /v1/usage/today /v1/balance /v1/keys /v1/keys/{id} /v1/credits/balance /v1/deposit/status /v1/site-settings /api/v1/privacy. The /docs page inside the app documents all of them — the repo docs and the product docs disagree.
Fix: add missing endpoints to DEPLOYMENT.md + PLATFORM.md.
Status: OPEN

### [D-10] POST /api/v1/checkout mentioned only parenthetically at PLATFORM.md:66 while the Polar card rail gates real revenue
Fix: promote to a first-class table row.
Status: OPEN

### [D-11] PLATFORM.md:190 says FREE_SIGNUP_CENTS optional/0 disables; .env.example:81 ships FREE_SIGNUP_CENTS=100.
Fix: one clarifying clause that example ships 100, doc shows 0 disabled.
Status: OPEN

### [D-12] BRAND.md:46 says og-image.png; actual file is og-image.png.
Fix: update BRAND.md.
Status: OPEN

## Low / cosmetic
- README.md:4 badge "2.1.0" — accurate.
- BRAND.md:_ADMIN_NOT_SURFACE confirmed correct (NavbarMobileMenu.tsx:119 uses /admin only for active-state highlighting).
- BRAND.md:169 + :175 verified accurate.
- scripts/README.md:7-11 omits scripts/ops/check-launch-env.sh which STATUS.md:42 references.
- deploy/STATUS.md:3 / DEPLOYMENT.md:7 dates slightly behind (Sep 25/26 vs latest commit Sep 27).
- opencode.jsonc's AGENTS.md reference points to a root file that doesn't exist (only app/AGENTS.md).
- app/.env.example:83 documents NEXT_PUBLIC_BUILD_DATE, which next.config.ts:48-53 explicitly says was removed. Stale.
- .env.example (root) and server/.env.example diverged — root missing Surplus / Gonka aliases / MODELS_CONFIG_PATH / MODEL_OVERRIDES_PATH / PRIMARY_DOMAIN / RECEIPT_HMAC_SECRET_PREVIOUS / LOG_LEVEL + carries real Polar org UUIDs that server/.env.example leaves blank. RECOMMENDATION: delete the root copy; single source of truth at server/.env.example.
- PLATFORM.md:137 says ENCRYPTION_KEY "at least 40 chars" but config.ts:97 enforces min(32). Align docs to min(32).

## Live-site UX notes (curl-level only)
- 18 public routes → 200. Apex 308s to www. /swap 308s to /deposit. api.oma-ai.com unresolvable. Canonical host story holds.
- /status renders "3/21 models available" while /pricing markets "21 models" and /api/v1/models returns 21. The tension is real live-availability-vs-catalog-size; PLATFORM.md:114 + BRAND.md:195 already warn about it in prose.
- Sitemap serves 66 URLs (21 model pages). All resolve except /models/kimi-k2-6 (the route in D-6).

## Proposed docs/ reorg (not executed)
Consolidate, then reorganize.
  docs/README.md index
  docs/platform.md, docs/deployment.md (stay at docs root)
  docs/operations/settlement-runbook.md, docs/operations/launch-checklist.md (reduced from STATUS.md)
  docs/reference/brand.md, security.md
  self-host/coolify/README.md
Delete deploy/STATUS.md prose; keep only actionable preflight + invariants. Delete root .env.example and point README at server/.env.example.
Real fix order: D-1..D-5 (small self-contained edits), then the move as a single no-content-change commit, then the .env.example consolidation.
