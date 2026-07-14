# OMA Roadmap

Tracked feature work + their state. The codebase's `TODO` comments reference back here.

## 2FA login flow

**Status:** not started — waiting on server-side flag.

**Trigger:** when `users.two_factor_enabled` ships and `/api/auth/account/login` starts returning `{ requiresTwoFactor: true }` instead of issuing a session cookie.

**Files affected:**
- `app/src/app/login/page.tsx` (consumer — currently a one-line TODO pointing here)
- `app/src/components/account-login-modal.tsx` (handleLogin needs to detect the flag, surface TOTP input)
- Backend: `users.two_factor_enabled` column + login route change

**Acceptance criteria:**
1. `AccountLoginModal.handleLogin` catches `{ requiresTwoFactor: true }` and surfaces a 6-digit TOTP input below the account-number field.
2. Auto-advance each digit on input, paste-fill the whole string on a single paste event, resubmit with `{ accountNumber, totpCode }`.
3. On success, fall through to the existing cookie-set path (no auth state divergence).
4. Rate-limit on TOTP failures inherits from the existing `/api/auth/account/login` rate-limit window.

**Out of scope for this slice:**
- Recovery codes (separate ticket)
- SMS / email fallback (separate ticket)
- WebAuthn / passkey (separate ticket)