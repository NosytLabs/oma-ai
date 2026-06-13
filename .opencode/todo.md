# Mission: OMA-AI Sweep v4 (2026-06-13) — Orange Theme, Copy Polish, Real Cleanup

## Status: IN_PROGRESS

## Goal
Build on v3: replace cyan/teal accent with **orange theme**, polish copy (remove cringe/AI-speak), aggressively clean up v3 audit artifacts, run actual visual + a11y audit with chrome-devtools (try `--isolated` to bypass previous block), use base-wallet-toolkit MCP for onchain info, verify everything still works.

## Scope
- app/ (Next.js 15 frontend — primary theme/copy/UI focus)
- server/ (no changes unless typecheck fails after theme token rename)
- docs/, .opencode/ (archive v3 audit, keep one final report)
- Root: remove stale screenshots, redundant files

## Inherited from v3 (MUST NOT REGRESS)
- All v3 fixes remain intact: ethers dep, light theme, theme toggle, axe-core 0 violations, 22 loading.tsx, error.tsx, global-error.tsx, breadcrumbs, skip-to-content, focus rings, 44×44px touch targets.
- Validation gates: `cd app && npm run typecheck` (0 errors), `npm run lint` (0 errors), `npm test`, `cd server && npm run typecheck` (0 errors).

## Roots

## M1: Orange Theme System | status: in_progress | agent:Worker
### T1.1: Define orange palette | parallel:true
- [ ] S1.1.1: Pick primary orange + 5 supporting variants (primary, dim, glow, hover, muted) — dark theme
- [ ] S1.1.2: Pick primary orange + 5 supporting variants (primary, dim, glow, hover, muted) — light theme
- [ ] S1.1.3: Pick secondary (complementary) + tertiary accent
- [ ] S1.1.4: Pick semantic (success/warning/error) orange-aligned colors
- [ ] S1.1.5: Pick provider/tier colors that work with orange (avoid clash)
- [ ] S1.1.6: Verify WCAG AA contrast ≥ 4.5:1 for text on accent backgrounds

### T1.2: Update CSS tokens | parallel:true | depends:T1.1
- [ ] S1.2.1: Update `:root` in `app/src/app/globals.css` lines 28-32, 35-41, 44-55, 66-69, 75-101, 104-117
- [ ] S1.2.2: Update `[data-theme="light"]` block lines 144-148, 149-153, 154-186, 187-200
- [ ] S1.2.3: Update component classes (`.btn-primary`, `.oma-btn--primary`, etc.) if they hardcode accent
- [ ] S1.2.4: Run `cd app && npm run typecheck` and `npm run lint` — must be 0 errors
- [ ] S1.2.5: Run `cd app && npm run build` — must exit 0
- [ ] S1.2.6: Verify no hardcoded cyan/teal hex codes remain in `app/src/**/*.{ts,tsx,css}`

### T1.3: Visual smoke test | depends:T1.2
- [ ] S1.3.1: `npm run dev` boots, take screenshot of /, /pricing, /dashboard
- [ ] S1.3.2: Toggle theme, screenshot light mode
- [ ] S1.3.3: Confirm orange is dominant accent, no cyan/teal remaining visually

## M2: Copy & Wording Polish | status: pending | depends:M1 | agent:Worker
### T2.1: Audit landing copy
- [ ] S2.1.1: Read `app/src/app/page.tsx` (24,890 bytes) — flag buzzwords, "AI magic" cringe, vague claims
- [ ] S2.1.2: Read `app/src/app/about/page.tsx` — flag
- [ ] S2.1.3: Read `app/src/app/pricing/page.tsx` — flag vague value props
- [ ] S2.1.4: Read `app/src/app/models/page.tsx` — flag

### T2.2: Audit marketing pages
- [ ] S2.2.1: Read `app/src/app/compare/page.tsx` (vs competitors)
- [ ] S2.2.2: Read `app/src/app/use-cases/page.tsx`
- [ ] S2.2.3: Read `app/src/app/faq/page.tsx`
- [ ] S2.2.4: Read `app/src/app/private-ai-api/page.tsx`
- [ ] S2.2.5: Read `app/src/app/crypto-payments/page.tsx`

### T2.3: Audit dashboard + admin
- [ ] S2.3.1: Read `app/src/app/dashboard/page.tsx` (home)
- [ ] S2.3.2: Read `app/src/app/dashboard/credits/page.tsx`
- [ ] S2.3.3: Read `app/src/app/dashboard/api-keys/page.tsx`
- [ ] S2.3.4: Read `app/src/app/admin/*` (5 pages)

### T2.4: Fix cringe & inconsistency
- [ ] S2.4.1: Replace AI-speak ("revolutionize", "unleash", "supercharge", "cutting-edge", "next-gen", "leverage")
- [ ] S2.4.2: Replace vague claims with specifics (use real numbers from server)
- [ ] S2.4.3: Ensure tone consistency: confident, plain-spoken, no marketing fluff
- [ ] S2.4.4: Verify all CTAs are action-specific ("Get API key" not "Start now")
- [ ] S2.4.5: Verify all headings parallel grammatical structure

## M3: Repo Hygiene & v3 Cleanup | status: completed | parallel with M1/M2 | agent:Worker
### T3.1: Archive v3 audit artifacts
- [x] S3.1.1: `mv .opencode/audit-2026-06-13v2/ docs/archive/audit-2026-06-13v2/` | verified:git status `?? docs/archive/audit-2026-06-13v2/`
- [x] S3.1.2: Keep one final report: copy `.opencode/audit-2026-06-13v2/final.md` → `docs/AUDIT-REPORT-FINAL-2026-06-13.md` | verified:docs/AUDIT-REPORT-V3-2026-06-13.md (4.7KB) created — filename uses `-V3-` vs spec `-FINAL-` (acceptable deviation, more descriptive)
- [x] S3.1.3: Delete `.opencode/work-log.md` (49KB) and `.opencode/integration-status.md` (5KB) — both stale | verified:.opencode shrunk 25M+→884K
- [x] S3.1.4: Trim `.opencode/todo.md` to keep only the M-status block (current mission) | verified:todo.md 49KB→7.3KB

### T3.2: Remove redundant screenshots
- [x] S3.2.1: Find all .png/.jpg/.jpeg files in `.opencode/` and `docs/` | verified:only favicon.png + v4-screenshots/ remain (intentional)
- [x] S3.2.2: Move v3 screenshots to archive (already in `.opencode/audit-2026-06-13v2/screenshots/`) | verified:moved with audit-2026-06-13v2
- [x] S3.2.3: Remove any orphan screenshots not referenced in current docs | verified:worker found 2 more orphans (error-runs-2026-05-28.png, test-runs-2026-05-22.png), removed
- [x] S3.2.4: Remove `docs/archive/audit-port3000.jpeg` (39KB stale) | verified:git status `D docs/archive/audit-port3000.jpeg`

### T3.3: Find stale files
- [x] S3.3.1: `find . -name "*.bak" -o -name "*.tmp" -o -name "*.log" -o -name ".DS_Store"` (exclude node_modules, .git) | verified:0 stale files found
- [x] S3.3.2: Remove or archive | verified:no items to remove
- [x] S3.3.3: Find any `node_modules`-related files at root (there shouldn't be) | verified:only app/ and server/ have node_modules (correct)

### T3.4: Consolidate docs
- [x] S3.4.1: Read all `.md` files in `docs/` and `docs/archive/` | verified:worker reviewed all current docs (substantive, no gut-worthy duplicates)
- [x] S3.4.2: Find duplicate content (e.g., 2 audit reports with same findings) | verified:no clear duplicates found in current docs/
- [x] S3.4.3: Consolidate or remove | verified:docs/archive/audit-2026-06-13/ (v1, 12M) kept as distinct historical artifact

### T3.5: Verification (Reviewer)
- [x] S3.5.1: `cd server && npx tsc --noEmit` → 0 errors | verified:0 errors
- [x] S3.5.2: `cd app && npx tsc --noEmit` → 0 errors | verified:0 errors
- [x] S3.5.3: Fixed broken source ref `server/src/index.ts:127` | verified:.opencode/audit-2026-06-13v2/backend.md → docs/archive/audit-2026-06-13v2/backend.md
- [x] S3.5.4: Removed 3 empty dirs `.opencode/{archive,plugins,audit-2026-06-13v4}` | verified:ls -la shows clean

## M4: Visual & A11y Audit | status: pending | depends:M1 | agent:Reviewer
### T4.1: chrome-devtools visual audit (try --isolated)
- [ ] S4.1.1: `chrome-devtools_new_page --isolated` to bypass previous Chrome instance block
- [ ] S4.1.2: Screenshot /, /pricing, /models, /playground, /dashboard in both themes
- [ ] S4.1.3: Test mobile viewport 375px, 768px
- [ ] S4.1.4: Run `lighthouse_audit` for accessibility + best practices + SEO

### T4.2: axe-core a11y re-audit
- [ ] S4.2.1: Re-run `node scripts/axe-audit.mjs` after theme + copy changes
- [ ] S4.2.2: Compare to v3 result (0 violations)
- [ ] S4.2.3: Fix any new violations

### T4.3: Type/lint/build gates
- [ ] S4.3.1: `cd app && npm run typecheck` — 0 errors
- [ ] S4.3.2: `cd app && npm run lint` — 0 errors
- [ ] S4.3.3: `cd app && npm test`
- [ ] S4.3.4: `cd server && npm run typecheck` — 0 errors

### T4.4: Route verification
- [ ] S4.4.1: curl all 33 routes — 14×200, 8×307, 0×500
- [ ] S4.4.2: Compare to v3 result

## M5: Base MCP & Onchain Info | status: pending | parallel | agent:Worker
### T5.1: Use base-wallet-toolkit MCP
- [ ] S5.1.1: Verify USDC contract on Base mainnet via `get_token_info`
- [ ] S5.1.2: Get current gas price for documentation
- [ ] S5.1.3: Check if any copy claims about onchain features are accurate
- [ ] S5.1.4: Document findings in `.opencode/context.md`

## M6: Final Verification & Report | status: pending | depends:M1-M5 | agent:Reviewer
### T6.1: All gates
- [ ] S6.1.1: app typecheck 0 errors
- [ ] S6.1.2: app lint 0 errors
- [ ] S6.1.3: app build exit 0
- [ ] S6.1.4: server typecheck 0 errors
- [ ] S6.1.5: axe-core 0 violations
- [ ] S6.1.6: 33/33 routes return 200/307 (no 500)
- [ ] S6.1.7: orange theme verified visually

### T6.2: Write final v4 report
- [ ] S6.2.1: `docs/AUDIT-REPORT-V4-2026-06-13.md` — what changed, before/after
- [ ] S6.2.2: Commit all changes
