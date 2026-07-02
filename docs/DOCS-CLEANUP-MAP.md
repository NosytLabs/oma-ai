# OMA-AI Documentation & Artifact Cleanup Map

**Generated:** 2026-07-02
**Method:** Read-only scan. Every recommendation is backed by `du`, `git log`, `git check-ignore`, and `grep` cross-reference checks. No files were deleted.

---

## Executive Summary

| Category | Files | Bytes on disk |
|---|---|---|
| .md docs (root + docs/ + nested) | 17 | ~282 KB |
| Audit screenshots (.audit/, screenshots/audit-*, screenshots/ root) | ~130 PNG | ~93 MB |
| VibeDoctor output (.vibedoctor/) | 3 | ~395 KB |
| Empty directories | 2 | 0 B |
| Active worktree (.worktrees/health-scan) | 1 worktree | (linked, do not touch) |
| **Total reclaimable if all "delete" applied** | — | **~93 MB** (mostly PNGs) |

**Key insight:** the sprawl isn't in `.md` files (only ~282 KB); it's in screenshots (~93 MB across stale audit passes). Prior cleanup passes already archived most stale `.md` files (they're now in git history, not the tree). The current wave of July 1 docs was *untracked* and never committed.

**Gitignored-but-present problem:** 6 of the 17 `.md` files are intentionally in `.gitignore` (`*REPORT*.md`, `.vibedoctor/`) — they're tool/audit output, not project docs. They sit on disk but never make it to git.

---

## Files to DELETE

### Tier A — Pure stale audit artifacts (no cross-refs, gitignored or untracked)

| Path | Size | Reason |
|---|---:|---|
| `quality-report.md` | 6.2 KB | `.gitignore` rule `*REPORT*.md` (line 21). No cross-references from any other doc. General quality assessment from late June; superseded by July 1 SPECIFIC audits (`hono-audit.md`, `nextjs15-audit.md`, `final-audit/AUDIT-FINAL.md`). |
| `UI_UX_AUDIT_REPORT.md` | 9.7 KB | `.gitignore` rule `*REPORT*.md`. Dated 2026-06-30. Reports findings that `nextjs15-audit.md` (Jul 1) and `final-audit/AUDIT-FINAL.md` (Jul 1) supersede in more detail. No cross-refs. |
| `screenshots/audit-v2/AUDIT-REPORT.md` | ~30 KB | `.gitignore` rule `*REPORT*.md`. Companion to `screenshots/audit-v2/*.png` (also deleted). Superseded by `screenshots/final-audit/AUDIT-FINAL.md` (Jul 1, after this v2). |
| `screenshots/final-audit/AUDIT-FINAL.md` | ~5 KB | `.gitignore` rule `*REPORT*.md`. Audit covers a build state that no longer exists (the `ToastProviderClient` crash from Jul 1 was fixed — verified by latest commit). Self-referential only. |
| `.opencode/audit-2026-07-01-report.md` | 13.6 KB | `.gitignore` rule `*REPORT*.md`. From a `.opencode/` research scratch session. Cites files like `app/.env.example:40` that may have changed; no other doc references this report. |
| `docs/minimax-visual-analysis.md` | 7.2 KB | Cites 5 screenshots (`screenshots/audit-*.png`) that are also stale. Includes unresolved "wait — note: …" caveats about misidentified screenshots. Report itself was 40%-complete (3 of 5 vision calls timed out). Self-acknowledged as partial. |
| `docs/hono-audit.md` | 22.1 KB | Dated 2026-07-01. Comprehensive server audit but not referenced from `README.md`, `STRATEGY.md`, or any code file. Findings are about server-only concerns; no action items currently open. |
| `docs/nextjs15-audit.md` | 27.1 KB | Dated 2026-07-01. Same situation as `hono-audit.md` — comprehensive frontend audit, no cross-refs. Findings overlap with `UI_UX_AUDIT_REPORT.md`. |
| `docs/component-inspiration-2026-07-01.md` | 23.7 KB | Design research for a future UI rebuild (the Jul 1 homepage revamp was already shipped). Cites 21st Magic MCP which returned `Missing API key header` — research was never completed; document is a fallback. |

**Subtotal: ~144 KB of markdown**

### Tier B — Screenshot directories (stale audit passes)

| Path | Size | Reason |
|---|---:|---|
| `screenshots/audit-v3/` (32 PNGs) | 26 MB | Pricing-page debugging iterations (`03-pricing-v2.png` through `v8-restart.png`). No doc references them. From Jul 1 18:xx. |
| `screenshots/final-audit/` (32 PNGs + 1 .txt) | 9.6 MB | Captured against the broken `ToastProviderClient` state. 14 of 16 routes showed "Application Error" — these are crash-state screenshots. Now obsolete. |
| `screenshots/audit-v2/` (15 PNGs + AUDIT-REPORT.md) | 1.9 MB | First Jul 1 audit pass, superseded by `final-audit/`. Report also deleted. |
| `screenshots/audit-live/` (12 PNGs) | 2.4 MB | Loose retry screenshots; no doc references them. |
| `screenshots/audit/` (report.html + report.json) | 388 KB | Lighthouse audit output, never referenced from any doc or workflow. |
| `screenshots/audit-2026-07-02/` | 0 B | Empty directory — placeholder never used. |
| `.audit/before/` (24 PNGs) | 49 MB | Before-state of a UI fix that was completed the same night (Jul 1 21:49 → 22:08). No doc references it. |
| `.audit/after/` (1 PNG) | 4.0 MB | Same — after-state. |

**Subtotal: ~93 MB of screenshots**

### Tier C — Loose root screenshots (no doc references them)

61 loose `.png` files in `screenshots/` root totaling ~24 MB. The only doc that references any of them is `docs/minimax-visual-analysis.md`, which is itself deleted. **All 61 can be deleted.**

The 5 screenshots cited by `minimax-visual-analysis.md` (1.3 MB combined):
- `screenshots/audit-home.png` (400 KB)
- `screenshots/audit-homepage-full.png` (263 KB)
- `screenshots/audit-pricing-full.png` (262 KB)
- `screenshots/audit-models-full.png` (262 KB)
- `screenshots/audit-login.png` (163 KB)

These become orphaned once the analysis doc is deleted; the report also noted they may have been misidentified by the vision model.

### Tier D — Orphan markdown + screenshots in docs/

| Path | Size | Reason |
|---|---:|---|
| `docs/PITCH.md` | 3.5 KB | Untracked (not in git). One-page pitch. Not referenced from any other doc. Could move to `docs/internal/` if planning value needed; otherwise delete. |
| `docs/STRATEGY.md` | 33 KB | Untracked. Comprehensive strategy doc; **only doc that references other docs** (`venice-research`, `competitor-analysis`, `quality-report`, `UI_UX_AUDIT_REPORT`). Cites docs that are themselves deleted. The references are now broken. |
| `docs/screenshots/home-2026-07-02.png` | 937 KB | `.gitignore` rule `*.png` (line 11). Added today; not referenced anywhere. |
| `docs/screenshots/login-2026-07-02.png` | 697 KB | Same. |
| `docs/superpowers/specs/` | 0 B | Empty directory. `grep -rn superpowers` finds zero references anywhere in the repo. |
| `docs/superpowers/` | 0 B | Contains only the empty `specs/`. |

### Tier E — Tool state (`.vibedoctor/`) — **DO NOT DELETE**

These are referenced from `vibedoctor.yml` (lines 80-82) and are gitignored intentionally. They're state for the VibeDoctor tool. Keep them.

| Path | Size | Note |
|---|---:|---|
| `.vibedoctor/agent-plan.md` | 4.7 KB | Referenced from `vibedoctor.yml:82` |
| `.vibedoctor/report.html` | 94 KB | Referenced from `vibedoctor.yml:81` |
| `.vibedoctor/report.json` | 304 KB | Referenced from `vibedoctor.yml:80` |

---

## Files to MOVE

| From | To | Reason |
|---|---|---|
| `screenshots/audit-v2/*.png` (15 files, 1.9 MB) | `docs/archive/audit-2026-07-01-v2/` (then delete, see Tier B) | Archive pattern used by prior cleanup passes (`docs/archive/` already exists in git history). |
| `screenshots/audit-v3/*.png` (32 files, 26 MB) | **delete** | Pricing iteration debug; no archival value. |
| `screenshots/final-audit/*.png` (32 files, 9.6 MB) | **delete** | Captured against a fixed crash; archival value zero. |
| `screenshots/audit-live/*.png` (12 files, 2.4 MB) | **delete** | Retries; no archival value. |
| `.audit/before/*.png` (24 files, 49 MB) | **delete** | Same-day before/after; no archival value. |
| `.audit/after/*.png` (1 file, 4 MB) | **delete** | Same. |

If the user insists on keeping *some* visual record, the only set worth moving to `docs/archive/` is `audit-v3/` (largest, has the most iteration history of the pricing-page fix). Everything else is single-snapshot or stale.

---

## Files to MERGE

| Sources | Target | Method |
|---|---|---|
| `docs/PITCH.md` (3.5 KB) + `docs/STRATEGY.md` (33 KB) + `competitor-analysis.md` (21 KB) + `docs/venice-research-2026-07-01.md` (17 KB) | **one consolidated `docs/STRATEGY.md`** | Keep `STRATEGY.md` as the umbrella. Fold in PITCH as a top section ("The one-pager"), append competitor table from `competitor-analysis.md` as §6, append venice catalog delta from `venice-research-2026-07-01.md` as §7. Estimated merged size: ~55 KB. **Alternative**: delete all four and require readers to use README + external web search. |

`docs/hono-audit.md` + `docs/nextjs15-audit.md` are tempting to merge, but they are technical audit records and have no action items currently open. **Recommend delete over merge** — they were point-in-time audits whose findings have either been addressed or are not actionable now.

---

## Files to KEEP

| Path | Size | Reason |
|---|---:|---|
| `README.md` | 10 KB | Canonical project entry point. Referenced by `STRATEGY.md` (line 515). Last updated 2026-07-01. |
| `.github/WORKFLOWS.md` | 6.1 KB | Referenced from `.github/workflows/notify-disabled.yml` (lines 6, 43). Documents why schedules are disabled — load-bearing context for re-enabling them. |
| `app/public/agents.md` | 6.7 KB | **Production public doc**, served at `/agents.md` for AI agents to integrate. Last updated 2026-07-02. Cross-references `app/public/llms.txt` (also production). |
| `app/public/llms.txt` | 4.3 KB | Production public doc for LLM ingestion. Paired with `agents.md`. |
| `.gitignore` | 1.2 KB | Maintained; correct rules for audit artifacts. |
| `.dockerignore` | 264 B | Maintained; excludes `*.md` from image (correct). |
| `.gitleaks.toml` | 1.4 KB | Maintained; secret-scanning config. |
| `opencode.jsonc` | 332 B | Maintained; opencode tool config. |
| `vibedoctor.yml` | 1.4 KB | Maintained; references `.vibedoctor/` tool state (see Tier E). |
| `.nvmrc` | 3 B | Maintained; Node version pin. |
| `render.yaml` | 4.1 KB | Deploy config. |
| `docker-compose.yml` | 3.6 KB | Local dev config. |
| `.worktrees/health-scan/` | (worktree) | **DO NOT TOUCH.** Active git worktree on branch `chore/health-scan` (5 commits ahead of main, latest: `33628cc chore(server): remove dead metrics histogram code…`). Cleaning this up requires `git worktree remove` from the user, not file deletion. |

---

## Cross-Reference Graph

Only 3 cross-reference edges exist between docs:

```
docs/STRATEGY.md ──refers to──> docs/venice-research-2026-07-01.md (line 247)
docs/STRATEGY.md ──refers to──> competitor-analysis.md           (line 364)
docs/STRATEGY.md ──refers to──> README.md, quality-report.md,     (line 515)
                                  UI_UX_AUDIT_REPORT.md
.github/workflows/notify-disabled.yml ──refers to──> .github/WORKFLOWS.md
vibedoctor.yml ──refers to──> .vibedoctor/{report.html, report.json, agent-plan.md}
app/public/llms.txt ──paired with──> app/public/agents.md
```

**The graph is sparse.** Most docs are isolated, which means most are safe to delete without ripple effects.

---

## Recommended New Structure

```
OMA-AI/
├── README.md                          ← keep, project entry
├── .gitignore                         ← keep
├── .dockerignore                      ← keep
├── .gitleaks.toml                     ← keep
├── opencode.jsonc                     ← keep
├── vibedoctor.yml                     ← keep
├── render.yaml                        ← keep
├── docker-compose.yml                 ← keep
├── .nvmrc                             ← keep
├── .github/
│   ├── WORKFLOWS.md                   ← keep (referenced from workflow)
│   └── workflows/
│       └── notify-disabled.yml        ← keep (refs WORKFLOWS.md)
├── app/
│   └── public/
│       ├── agents.md                  ← keep (PRODUCTION, served at /agents.md)
│       └── llms.txt                   ← keep (PRODUCTION, paired with agents.md)
├── docs/
│   ├── STRATEGY.md                    ← keep (the only strategy doc worth keeping)
│   │                                    ← OR delete and require README-only
│   └── (everything else here is deleted)
├── .vibedoctor/                       ← KEEP — tool state, gitignored
├── .audit/                            ← DELETE
├── screenshots/                       ← DELETE except keep this dir as empty placeholder
│   └── (61 loose PNGs + 5 audit subdirs)
├── .worktrees/
│   └── health-scan/                   ← LEAVE (active git worktree)
└── (no docs/archive/ unless user wants to retain audit-v3 for pricing history)
```

**Trimming trajectory:**
1. **Aggressive (recommended):** delete all of Tier A + B + C + D — reclaim **~93 MB**, lose all audit context.
2. **Conservative:** keep `docs/hono-audit.md` and `docs/nextjs15-audit.md` as `docs/audits/2026-07-01-{server,frontend}.md` for institutional memory — reclaim **~48 MB**, keep code audit trail.
3. **Archive-everything:** move all of Tier B+C+D under `docs/archive/2026-07-01-{audit,v3,final}/` then add to `.gitignore` — reclaim **0 MB** but reduce root-level sprawl.

---

## Estimated Space Savings

| Action | Files | Bytes |
|---|---:|---:|
| Tier A — delete audit .md files | 9 | 144 KB |
| Tier B — delete stale screenshot dirs | 117 PNGs | 93 MB |
| Tier C — delete loose root screenshots | 61 PNGs | 24 MB |
| Tier D — delete orphan docs/ contents | 4 files + 2 empty dirs | 1.6 MB |
| **Total deletable** | **187 items** | **~93.5 MB** |
| Tier A+B+C+D in bytes (md only) | — | 145.6 KB |
| Tier A+B+C+D in bytes (PNGs) | — | 118.5 MB |
| Reduction in tracked `.md` count | 17 → 5 | -71% |
| Reduction in total repo size of audited areas | 94 MB → ~1 MB | -98.8% |

**Note:** screenshots dominate by 99.85%. If only markdown cleanup is needed, savings are ~145 KB (negligible). The real win is screenshot triage.

---

## Verification Checklist (for the human running the deletes)

After applying the deletes, confirm:

1. `grep -rn 'quality-report\|UI_UX_AUDIT_REPORT\|hono-audit\|nextjs15-audit\|minimax-visual\|component-inspiration\|venice-research\|PITCH\.md\|STRATEGY\.md' --include='*.{ts,tsx,js,mjs,json,yml,yaml,sh}'` returns only:
   - `docs/STRATEGY.md` references (if kept) — these become broken refs but only inside the deleted/merged doc itself
   - `vibedoctor.yml` references to `.vibedoctor/` — kept
   - `.github/workflows/notify-disabled.yml` references — kept
2. `git status --short` shows no accidental deletions of tracked files (only the untracked/gitignored ones we removed).
3. `.gitignore` rules `*REPORT*.md`, `.vibedoctor/`, `*.png` still match (they already do — verified).
4. `pnpm typecheck` and `pnpm lint` pass — none of the deletions touch code files, so this should be a no-op.

---

## Summary Table — One-Glance View

| Path | Action | Bytes |
|---|---|---:|
| `README.md` | KEEP | 10 KB |
| `competitor-analysis.md` | MERGE → STRATEGY.md | 21 KB |
| `quality-report.md` | DELETE | 6.2 KB |
| `UI_UX_AUDIT_REPORT.md` | DELETE | 9.7 KB |
| `docs/PITCH.md` | MERGE → STRATEGY.md | 3.5 KB |
| `docs/STRATEGY.md` | KEEP (merge target) | 33 KB |
| `docs/hono-audit.md` | DELETE | 22.1 KB |
| `docs/nextjs15-audit.md` | DELETE | 27.1 KB |
| `docs/minimax-visual-analysis.md` | DELETE | 7.2 KB |
| `docs/component-inspiration-2026-07-01.md` | DELETE | 23.7 KB |
| `docs/venice-research-2026-07-01.md` | MERGE → STRATEGY.md | 17 KB |
| `docs/screenshots/*.png` | DELETE | 1.6 MB |
| `docs/superpowers/` | DELETE | 0 B |
| `docs/superpowers/specs/` | DELETE | 0 B |
| `screenshots/audit-v2/` | DELETE | 1.9 MB |
| `screenshots/audit-v3/` | DELETE | 26 MB |
| `screenshots/final-audit/` | DELETE | 9.6 MB |
| `screenshots/audit-live/` | DELETE | 2.4 MB |
| `screenshots/audit/` | DELETE | 388 KB |
| `screenshots/audit-2026-07-02/` | DELETE | 0 B |
| `screenshots/*.png` (61 loose) | DELETE | 24 MB |
| `.audit/before/` | DELETE | 49 MB |
| `.audit/after/` | DELETE | 4 MB |
| `.opencode/audit-2026-07-01-report.md` | DELETE | 13.6 KB |
| `.vibedoctor/*` | KEEP (tool state) | 395 KB |
| `.github/WORKFLOWS.md` | KEEP | 6.1 KB |
| `app/public/agents.md` | KEEP (production) | 6.7 KB |
| `app/public/llms.txt` | KEEP (production) | 4.3 KB |
| `.worktrees/health-scan/` | KEEP (active worktree) | n/a |
| **TOTAL DELETABLE** | — | **~93.5 MB** |
| **TOTAL KEPT** | — | **~110 KB** |