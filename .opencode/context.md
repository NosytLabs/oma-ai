# OMA-AI Mission Context — Active (2026-06-13T21:05Z)

## Current Status

**Mission goal**: OMA-AI = "OpenRouter but for Venice API" — private, sovereign AI inference gateway with x402 + Houdini Swap. User credits: $50 Render, $200 Neon, $5k QuickNode.

**Repo**: github.com/NosytLabs/oma-ai (NOT anomalyco/opencode). Branch: master.

**Codebase state (excellent)**:
- server typecheck: 0 errors ✓
- app typecheck: 0 errors ✓
- server lint: 0 errors ✓
- app lint: 0 errors ✓
- server tests: 685/685 PASS ✓
- app tests: 28/28 PASS ✓
- 51 models in catalog; Venice = PRIMARY provider; AntSeed = failover
- 24 inference modules, 5 x402 modules, 18 credits modules
- /v1/x402/proxy returns 501 (intentional stub per audit)
- Houdini Swap client fully implemented (352 lines, WS + REST)
- x402 facilitator is v1 with v2-spec comment block explaining migration
- Settlement proxy at 0x0770d2124C0a581C28Cfc47a659817145e6Cc137 verified real on Base (522-byte bytecode, EIP-1967 proxy slot)

**v5 mission state** (in progress):
- M1 Orange Theme + M2 Copy Polish + M3 Hygiene + M5.1 Onchain: DONE
- M6 Layout Audit: dispatch attempt 1 (task_5760ad24 152s) + attempt 2 (returned no output)
- M7 Neon DB: dispatch attempt 1 (task_ffc6d340 174s) + attempt 2
- M8 Render $50: dispatch attempt 1 (task_37716300 163s) + attempt 2
- 20 background tasks total; many returned no output (M3 reliability bug)
- .opencode/audit-2026-06-13v5/ now has layout-audit.md (10K) + neon-optimization.md (12K) + screenshots/
- 26 PNG screenshots in .opencode/v5-screenshots/

**Sync issues**:
- ✅ SYNC-20 RESOLVED (Audited → Verifiable on-chain settlement, verified via base-mcp eth_getCode)
- ✅ SYNC-21 (M2 regression) RESOLVED via `git checkout HEAD --` on 2 files
- ⏳ SYNC-22 (M4/M6/M7/M8 audit incompleteness) — pending re-dispatch
- ⏳ SYNC-23 (M6 layout audit) — pending re-dispatch
- ⏳ SYNC-24 (Venice routing audit) — pending re-dispatch
- Unit tests written: 2026-06-13T20-57Z-sync21-m2-revert.md, 2026-06-13T20-59Z-sync20-audit-soften.md

**MiniMax UI/UX audits completed (5 pages, all brutally honest)**:

CRITICAL findings to fix:
1. **"Backend Unavailable" red dot** — `app/src/components/api-status.tsx:102` is the source. Component is in the navbar. This is a conversion killer. Need to change copy OR fix the health-check endpoint OR add a "mock dev" mode for landing page.
2. **§04 Protocol text overlap** — orange text "x402 header attached" / "stream response" physically overlaps step numbers 02 and 05. CSS positioning bug in landing page §04.
3. **Pricing page CTAs buried** — "Start AI Inference" / "Deposit Crypto" at bottom of 28-model table. Must move to hero.
4. **Mobile table overflow** — 4-column tables in §02/§03 will break at 375px. Need card-list transformation.
5. **Light theme ghost text** — secondary gray text (#999/#AAA) fails WCAG AA. Darken to #666.
6. **Orange arrows too thin** in §04 protocol (light theme).
7. **Provider labels confusing** — "Venice/AntSeed" don't mean anything to new users.
8. **Missing logos** — no brand icons for models.

MAJOR findings:
- Header says "32+ models" but list has 50+ (data mismatch erodes trust)
- Table view toggle needed for power users
- Footer "Backend Unavailable" scares users
- Pricing page X402 box too tall, pushes table down
- Cross-chain deposit (Houdini) not mentioned on landing
- "Schematic" copy in System State box unclear

**Cleanup opportunities**:
- .opencode/ is 37M with 114 files — could trim v3 audit dirs (v2 = 4K, v3 missing, v4-screenshots = 11M)
- No .bak/.tmp/.orig files
- node_modules are normal
- docs/archive/ is archived properly

**MCP health** (from prior session):
- ✅ 16/18 MCPs working (desktop-commander, memory, filesystem, chrome-devtools, taskmanager, base-mcp, brave-search, railway, neon, github, firecrawl, base-wallet-toolkit, sequential-thinking, mult-fetch, 21st-magic)
- ❌ context7: needs opencode restart to pick up new key
- ❌ quicknode: key rejected upstream (regenerate at dashboard.quicknode.com)
- ⚠️ render: needs workspace selection (`opencode mcp auth render`)
- ✅ MiniMax MCP working: `MiniMax_understand_image` + `MiniMax_web_search` confirmed functional

## Pending Tasks

1. **CRITICAL FIX: "Backend Unavailable" red dot** — fix `app/src/components/api-status.tsx:102` and the underlying health-check OR add a marketing-mode override
2. **CRITICAL FIX: §04 protocol text overlap** — fix CSS in `app/src/app/page.tsx` §04 (around line 380-430, the protocol diagram)
3. **CRITICAL FIX: Pricing page CTA placement** — move CTAs to hero in `app/src/app/pricing/page.tsx`
4. **CRITICAL FIX: Mobile table responsiveness** — add card-list transform for 375px in §02/§03
5. **MAJOR: Apply MiniMax audit fixes** — increase orange arrow stroke, darken light theme grays, add brand logos to model rows
6. **MAJOR: Mention Houdini on landing** — cross-chain deposit is a major USP
7. **CLEANUP: Trim .opencode/v4-screenshots** (11M, mostly stale)
8. **CLEANUP: Verify all SYNC issues resolved** in sync-issues.md
9. **VERIFY: Re-run server typecheck + lint + tests** after all changes
10. **COMMIT: Stage + commit all v5 changes** with comprehensive message
11. **GitHub: Check NosytLabs/oma-ai repo state** via github MCP (queried wrong repo earlier - was anomalyco/opencode)
12. **MCP: Tell user to restart opencode for context7** + regenerate QuickNode key
13. **DEPLOY: User has $50 Render credit unused** — recommend deployment strategy per M8 audit
14. **Final: Update todo.md M0-M9 tree** with all completed work
15. **Final: Write AUDIT-REPORT-V5-2026-06-13.md** summarizing all v5 findings

## Key File Paths
- `/Users/tyson/Desktop/Code/OMA-AI/.opencode/todo.md` (v5 mission tree)
- `/Users/tyson/Desktop/Code/OMA-AI/.opencode/sync-issues.md` (SYNC-20/21 resolved, 22/23/24 pending)
- `/Users/tyson/Desktop/Code/OMA-AI/.opencode/work-log.md` (active sessions, ~20 entries)
- `/Users/tyson/Desktop/Code/OMA-AI/.opencode/audit-2026-06-13v5/{layout-audit,neon-optimization}.md` + screenshots/
- `/Users/tyson/Desktop/Code/OMA-AI/.opencode/v5-screenshots/` (26 PNGs)
- `/Users/tyson/Desktop/Code/OMA-AI/.opencode/unit-tests/` (8 files now)
- `/Users/tyson/Desktop/Code/OMA-AI/app/src/components/api-status.tsx:102` (CRITICAL: Backend Unavailable)
- `/Users/tyson/Desktop/Code/OMA-AI/app/src/app/page.tsx` (landing, 591 lines, §04 protocol overlap bug)
- `/Users/tyson/Desktop/Code/OMA-AI/app/src/app/pricing/page.tsx` (CTAs at bottom — need to move)
- `/Users/tyson/Desktop/Code/OMA-AI/app/src/app/models/page.tsx` (no search/filter prominent)
- `/Users/tyson/Desktop/Code/OMA-AI/server/src/inference/venice.ts` (full-featured, 454 lines)
- `/Users/tyson/Desktop/Code/OMA-AI/server/src/x402/facilitator.ts` (947 lines, v1+v2 spec)
- `/Users/tyson/Desktop/Code/OMA-AI/server/src/credits/houdini-client.ts` (352 lines)
- `/Users/tyson/Desktop/Code/OMA-AI/server/src/config.ts` (302 lines, full zod validation)
- `/Users/tyson/Desktop/Code/OMA-AI/docs/OMA-X402-CROSSCHAIN-ARCHITECTURE.md` (architecture)
- `/Users/tyson/Desktop/Code/OMA-AI/docs/BRAND-MESSAGING.md` (positioning)

## Active Session
- Current Commander session, depth 0
- 89% context → compaction triggered
- 20+ background tasks dispatched, many returned empty (M3 reliability issue per AGENTS.md)
- MiniMax MCP confirmed working for visual audit
- Need to continue with fixes after compaction
