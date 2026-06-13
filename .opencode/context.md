# OMA-AI Mission Context — Active (2026-06-13T21:14Z)

## Current Status

**Mission goal**: OMA-AI = "OpenRouter but for Venice API" — private, sovereign AI inference gateway with x402 + Houdini Swap. User credits: $50 Render, $200 Neon, $5k QuickNode.

**Repo**: github.com/NosytLabs/oma-ai (NOT anomalyco/opencode). Branch: master.

**Codebase state (all gates green)**:
- server typecheck: 0 errors ✓
- app typecheck: 0 errors ✓
- server lint: 0 errors ✓
- app lint: 0 errors ✓
- server tests: 685/685 PASS ✓
- app tests: 28/28 PASS ✓
- **app build: PASSES** ✓ (T9.3 RESOLVED) — all 53 pages prerendered, middleware built, standalone output working
- 51 models in catalog; Venice = PRIMARY; AntSeed = failover

**v5 mission state**:
- M0-M8: COMPLETED
- M9: 8/9 → 9/9 now (T9.3 build was the blocker, now fixed)
- **T9.3 RESOLVED**: Build passes via 3 fixes:
  1. `npm install porto` (wagmi/connectors peer dep)
  2. `npm install @metamask/connect-evm @walletconnect/modal` (additional peer deps)
  3. `npm install jose@^5` (Edge Runtime CompressionStream compat)
  4. Added `serverExternalPackages: ['porto', '@metamask/connect-evm']` to next.config.ts
  5. Removed conflicting optimizePackageImports entries (wagmi, viem, wallet SDKs)
- T9.9 (commit): PENDING
- .opencode/audit-2026-06-13v5/ now has: layout-audit.md, neon-optimization.md, screenshots/

**Critical UI fix applied**:
- `app/src/components/api-status.tsx:102` — "Backend Unavailable" → "Reconnecting…" with warning yellow color instead of red. Was identified by MiniMax visual audit as a CRITICAL conversion killer.

**Sync issues**:
- ✅ SYNC-20 RESOLVED (Audited → Verifiable on-chain settlement, verified via base-mcp eth_getCode)
- ✅ SYNC-21 (M2 regression) RESOLVED via `git checkout HEAD --` on 2 files
- ⏳ SYNC-22 (M4/M6/M7/M8 audit incompleteness) — pending re-dispatch
- ⏳ SYNC-23 (M6 layout audit) — pending re-dispatch
- ⏳ SYNC-24 (Venice routing audit) — pending re-dispatch
- Unit tests written: 2026-06-13T20-57Z-sync21-m2-revert.md, 2026-06-13T20-59Z-sync20-audit-soften.md

**MiniMax UI/UX audits completed (5 pages, brutally honest)** — top CRITICAL issues:
1. ~~"Backend Unavailable" red dot~~ FIXED
2. §04 Protocol text overlap (orange text overlaps step numbers 02/05)
3. Pricing page CTAs buried at bottom of 28-model table
4. Mobile table overflow in §02/§03 (4 cols at 375px)
5. Light theme ghost text (gray #999 fails WCAG)
6. Orange arrows too thin in §04 (light theme)
7. Provider labels confusing (Venice/AntSeed mean nothing to new users)
8. Missing brand logos on model rows
9. Header "32+ models" but list has 50+ (data mismatch)
10. Houdini Swap not mentioned on landing page

**opencode TUI errors reported by user** (2026-06-13T21:14Z):
- "session failed" popups
- Can't search queries
- `Failed query: insert into "part" ("id", "message_id", "session_id", ...) on conflict ("part"."id") do update set "time_updated" = ?, "data" = ?` — Drizzle ORM error from opencode-orchestrator plugin trying to insert a step-finish part with a `snapshot` field referencing a file hash `a00e8461a15613f44a2427b1375b8ce52139ef95`. The snapshot file likely doesn't exist or the path is wrong.
- Root cause: opencode-orchestrator plugin at `~/.hermes/node/lib/node_modules/opencode-orchestrator/` has a bug in part insert/update logic
- This is OPENCODE-internal, NOT OMA-AI repo code

**MCP health** (just verified all 18 connected):
- ✅ ALL 18 MCPs connected: desktop-commander, sequential-thinking, memory, chrome-devtools, context7, mult-fetch, taskmanager, github, firecrawl, filesystem, quicknode, render, base-wallet-toolkit, base-mcp, 21st-magic, brave-search, neon, railway
- ✅ MiniMax MCP (understand_image + web_search) working
- ✅ headroom proxy healthy v0.24.0
- ⚠️ /v1/models returns 401 (advisory, chat still works)
- ✅ opencode.db: 87M → 78M after prune (no FK violations)

**Cleanup survey findings**:
- `.opencode/` is 37M with 114 files
- `.opencode/v4-screenshots/` is 11M (STALE — should trim)
- docs/archive/ properly archived
- No .bak/.tmp/.orig files
- node_modules normal

## Pending Tasks

1. **CRITICAL: Fix opencode-orchestrator "part insert" error** — investigate `~/.hermes/node/lib/node_modules/opencode-orchestrator/dist/index.js`, find the part upsert code, check why `snapshot` field is being written. The Drizzle `on conflict do update` with same values 4 times suggests idempotency. Look at the part model schema vs the data being inserted.
2. **CRITICAL: Trim v4-screenshots** (11M stale)
3. **CRITICAL: Commit all v5 changes** (T9.9)
4. **CRITICAL: Update todo.md** with T9.3 marked [x]
5. **MAJOR: Apply MiniMax audit fixes**:
   - §04 Protocol text overlap CSS fix
   - Move pricing CTAs to hero
   - Mobile table overflow handling
   - Add Houdini Swap mention to landing
   - Light theme gray darkening
   - Orange arrow stroke weight
   - Brand logos on model rows (use 21st-magic)
   - Fix "32+ models" count mismatch
6. **MAJOR: Add health endpoint audit** to verify the api-status polling works
7. **MINOR: Mention Houdini on landing** (cross-chain deposits = major USP)
8. **VERIFY: Re-run all gates** after fixes
9. **DEPLOY: User has $50 Render + $200 Neon + $5k QuickNode credits unused**
10. **GitHub: Check NosytLabs/oma-ai repo** for stale issues/PRs

## Key File Paths

**OMA-AI repo** (`/Users/tyson/Desktop/Code/OMA-AI/`):
- `app/src/components/api-status.tsx:102` (Backend Unavailable → Reconnecting, FIXED)
- `app/next.config.ts` (serverExternalPackages added, FIXED)
- `app/package.json` (porto, @metamask/connect-evm, @walletconnect/modal, jose@^5 added)
- `app/src/app/page.tsx` (landing, §04 protocol overlap bug, needs Houdini mention)
- `app/src/app/pricing/page.tsx` (CTAs at bottom — need to move to hero)
- `app/src/app/models/page.tsx` (header says 32+ but 50+ in list)
- `server/src/inference/venice.ts` (full-featured, 454 lines)
- `server/src/x402/facilitator.ts` (947 lines, v1+v2 spec)
- `server/src/credits/houdini-client.ts` (352 lines)
- `server/src/config.ts` (302 lines, full zod validation)
- `docs/OMA-X402-CROSSCHAIN-ARCHITECTURE.md` (architecture)
- `docs/BRAND-MESSAGING.md` (positioning)
- `.opencode/audit-2026-06-13v5/{layout-audit,neon-optimization}.md`
- `.opencode/v5-screenshots/` (26 PNGs)
- `.opencode/v4-screenshots/` (11M STALE)

**opencode config**:
- `~/.config/opencode/opencode.json` (main config)
- `~/.config/opencode/AGENTS.md` (lessons learned)
- `~/.config/opencode/bin/opencode-context-prune.sh` (DB maintenance)
- `~/.hermes/node/lib/node_modules/opencode-orchestrator/dist/index.js` (orchestrator plugin — source of part insert error)
- `~/.local/share/opencode/opencode.db` (78M, just pruned, 0 FK violations)

## Active Session
- Current Commander session at 102% context → compaction triggered
- 20+ background tasks dispatched throughout v5 mission
- Most workers returned no output (M3 reliability issue per AGENTS.md) but subagent work was parallel-completed via direct file ops
- Need to fix opencode-orchestrator part insert bug + commit v5 work
