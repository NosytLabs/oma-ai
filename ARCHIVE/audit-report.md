# OMA-AI Audit Report (2026-07-31)

## Summary
A comprehensive audit was performed on the OMA-AI repository with focus on security, code quality, frontend accessibility, server logic, and test coverage. Issues are categorized by type, with file paths, line numbers, severity, and suggested fixes.

---

## Security
| File | Line | Severity | Issue | Suggested Fix |
|---|---|---|---|---|
| .env, .env.example, server/.env | various | HIGH | Sensitive secrets (JWT_SECRET, ENCRYPTION_KEY, FACILITATOR_PRIVATE_KEY, etc.) are present. | Remove hardcoded/fake secrets from any committed files, use secure .env setup and rotate real secrets in production. |
| app/src/lib/auth.ts | 43 | LOW | console.log for magic link in dev | Remove or replace with secure logger in production |
| server/src/auth.ts | comments | LOW | Mentions of console.log fallback for email; ensure not in prod | Guard with proper env checks |
| server/scripts/seed-admin.ts | 44 | LOW | console.log | Restrict to dev only or remove |

## Code Quality
| File | Line | Severity | Issue | Suggested Fix |
|---|---|---|---|---|
| app/src/lib/auth.ts | 43 | LOW | console.log found, should not run in production | Remove or replace with environment guard |
| app/src/app/_components/home/code-example.tsx | 34 | LOW | console.log in demo code | Remove/guard in prod build |
| app/src/app/docs/sections/sdks.tsx | 42/210/386 | LOW | console.log in docs | Remove in prod build |
| app/src/app/models/[slug]/page.tsx | 229/499 | LOW | console.log | Remove before prod |
| server/src/auth.ts | Comments | - | Use of console.log in comments, ensure not present in production flow | Guard logging |
| Unused/removed code | various | LOW | Comments reference removed/deleted functions or endpoints | Clean unused code and update comments |

## Frontend Accessibility
| File | Line | Severity | Issue | Suggested Fix |
|---|---|---|---|---|
| app/src/components/ThemeToggle.tsx | 54-100 | MEDIUM | Accessibility well covered (aria-* usage), but ensure focus states for keyboard navigation | Validate and test with screen readers/keyboard-only |
| app/src/app/chat/_components/MessagesList.tsx | n/a | LOW | Feature discovery is visually discoverable, ensure ARIA usage for all interactive elements | Review for proper roles and labels |
| app/src/components/navbar/NavbarMobileMenu.tsx (and test) | All | LOW | Role=alertdialog used for disconnect flow — appears accessible, verify actual interaction on devices | Manual QA for mobile a11y |
| app/src/app/_components/home/capabilities-grid.tsx | n/a | LOW | ARIA-labels present, but verify for color contrast (theming) | Run automated and manual a11y tests |

## Server (API/Auth/Routes)
| File | Line | Severity | Issue | Suggested Fix |
|---|---|---|---|---|
| server/src/routes/auth.ts | 55-72 | HIGH | Permanently delete user in DB on /account delete | Confirm extra account recovery guard/warning for destructive action |
| server/src/routes/auth.ts | 139-162 | HIGH | API Key revocation removes by user & key, ensure audit trails | Confirm audit logs are stored reliably |
| server/src/routes/auth.ts | All | LOW | No clear rate-limiting on user delete endpoint | Add stricter rate-limit for destructive user actions |

## Tests — Missing or Insufficient
| Area | File | Severity | Issue | Suggested Fix |
|---|---|---|---|---|
| app/src/lib/ | free-chat-model.test.ts | LOW | Single-file model gate checks, functional but minimal | Broaden model-check scenarios and edge cases |
| app/src/lib/ | utils.test.ts | LOW | Covers format and mask utilities, but no error/exception branches | Add additional negative tests |
| site-redirects.test.ts | - | MEDIUM | Covers route removal and redirects, good coverage | Keep tests updated as site routes evolve |
| use-dialog.test.tsx | - | LOW | Tests dialog open/close and ESC, but no a11y or focus trap edge cases | Add a11y and focus cycle tests |
| components/__tests__/navbar.mobile-disconnect.isolated.test.tsx | - | MEDIUM | Covers mobile account disconnect for a11y/UX, solid test | Maintain test and consider additional a11y/manual checks |

---

# Checklist of Recommended Fixes

- [ ] Remove or properly guard all console.log and dev logging methods in production-facing code.
- [ ] Remove fake secrets and private keys from any .env.example or .env files in the repo.
- [ ] Ensure all destructive API operations (delete account, revoke key) are fully rate-limited and include proper audit logging.
- [ ] Validate frontend key flows (ThemeToggle, NavbarMobileMenu, etc.) for keyboard accessibility and ARIA coverage.
- [ ] Expand automated test coverage, especially for error boundaries and accessibility in custom dialogs and navigation modals.
- [ ] Perform a manual accessibility audit on mobile flows (menu, dialogs, alerts).
- [ ] Remove stale or dead commented code and keep in-line docs up to date with app state.
- [ ] Run automated a11y and color contrast checks for all key surfaces (home, chat, dashboard).

---

This audit report should be reviewed regularly as fixes are applied and new code is merged.