# T1.7 App Pages Audit — Unit Test Record

**Date:** 2026-06-14T16:29Z
**Auditor:** opencode M3
**Scope:** 37 `app/src/app/**/page.tsx` + 2 layouts + footer + meta routes
**Deliverable:** `.opencode/audit-2026-06-14v7/app-pages.md` (1 MED + 3 LOW findings)

---

## Verification

| Check | Result |
|-------|--------|
| Audit deliverable exists | ✅ |
| 37 page.tsx files inventoried | ✅ |
| 0 color-cyan references (v3 teal migration) | ✅ grep returns 0 |
| 9+ files use "91+ models" consistently | ✅ |
| Footer last-deploy wired to env vars | ✅ `footer.tsx:139` |
| OMA token refs identified | ✅ 4 app files (terms, crypto-payments, deposit/layout, 2 compare) |
| Surplus route still mounted | ✅ `api/v1/surplus/min-discount/route.ts` exists |

---

## Findings Summary

| # | Sev | File | Issue |
|---|-----|------|-------|
| M1 | MED | 4 files | OMA token references (token not deployed) |
| L1 | LOW | api/v1/surplus + compare/surplus page | Surplus route still mounted but provider disabled |
| L2 | LOW | 2 compare pages | "100+ models" → "91+ models" copy drift |
| L3 | LOW | n/a | account-number auth is consistent (4 files reference it) |

**Total actionable LOC delta: ~12 LOC removed (4 files). 0 behavior change.**

**App pages surface is shippable modulo the M1 OMA-token copy fix.**

---

## Status

**T1.7 audit: COMPLETE.** M1 (drop OMA token copy) is a quick fix that can ship with the auth M1 (shared validators) since both are cleanup.
