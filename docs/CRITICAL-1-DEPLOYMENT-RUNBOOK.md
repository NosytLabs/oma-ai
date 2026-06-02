# CRITICAL-1 Deployment Runbook — `www.oma-ai.com` / `api.oma-ai.com`

> **Status (as of 2026-06-02)**: BLOCKER. `https://www.oma-ai.com/` serves *NosytLabs MCP Marketplace* (a different product). `https://api.oma-ai.com/` returns `404 DEPLOYMENT_NOT_FOUND`. The OMA AI Gateway in this repo (`oma/`) is not deployed to its documented domain. See screenshot `docs/screenshots/audit-2026-06-02/00-production-url-mismatch.png`.
>
> **Goal**: `www.oma-ai.com` returns the Next.js app (`oma/app/`), `api.oma-ai.com` returns the Hono gateway (`oma/server/`), and the two talk to each other with CORS and auth wired correctly.

---

## 0. Pre-flight: confirm the failure mode

```bash
# Should each be checked from a network outside the org
curl -sI https://www.oma-ai.com/                 # currently serves NosytLabs HTML
curl -sI https://www.oma-ai.com/ | grep -i 'x-vercel\|server'
curl -s  https://api.oma-ai.com/v1/models | jq   # currently {"error":"DEPLOYMENT_NOT_FOUND"}
dig +short www.oma-ai.com
dig +short api.oma-ai.com
```

Record the actual Vercel project IDs and the DNS records (CNAME targets) in the "Before" column of §7. You will need them to know what to change.

---

## 1. Decide the routing model

Pick one of the two following setups and stick with it (don't mix).

| Model | `www.oma-ai.com` | `api.oma-ai.com` | CORS origin on server | Pros | Cons |
|---|---|---|---|---|---|
| **A. Two Vercel projects** (recommended) | Vercel project A (Next.js, root `app/`) | Vercel project B (Hono, root `server/`) | `https://www.oma-ai.com` | Independent deploys, clear blast radius | Two projects to manage |
| **B. One Vercel project, sub-path** | Vercel project (Next.js, root `app/`) — proxies `/api/v1/*` to Hono via `MED-11` rewrite | same project, Hono mounted on `/api/v1` | same-origin (no CORS) | One project, one deploy | Couples release cadences; rewrites are easy to get wrong |

This runbook assumes **Model A** (the repo's current architecture). Model B is noted inline where it diverges.

---

## 2. Vercel: create / verify the two projects

```bash
# Install / verify
npm i -g vercel
vercel login
vercel whoami
```

### 2a. `oma-app` (Next.js, root: `oma/app/`)

```bash
cd oma/app
vercel link --project=oma-app --yes    # or create: vercel project add oma-app
vercel env pull .env.production        # non-destructive; just downloads to a temp file for review
```

**Required env vars on this project** (set in Vercel dashboard → Project → Settings → Environment Variables):

| Var | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.oma-ai.com` | Production, Preview |
| `NEXT_PUBLIC_APP_URL` | `https://www.oma-ai.com` | Production, Preview |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | (from WalletConnect Cloud) | All |
| `NEXT_PUBLIC_*` treasury / RPC / feature flags | (see `app/.env.example`) | All |

**Domains to attach**:
- `www.oma-ai.com` (primary)
- `oma-ai.com` (apex, with 308 → `www`)

**Build command**: `npm run build` (no override needed; Vercel auto-detects Next.js).
**Output directory**: leave default (`.next`).

### 2b. `oma-api` (Hono, root: `oma/server/`)

```bash
cd oma/server
vercel link --project=oma-api --yes
```

`oma/server/vercel.json` (or equivalent) must declare Hono as a Node serverless function. Verify it exists; if not, create:

```json
{
  "version": 2,
  "builds": [{ "src": "src/index.ts", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "src/index.ts" }]
}
```

**Required env vars on this project** (see `server/.env.example`):

| Var | Required? | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres URL, fail-fast in `db/client.ts` |
| `REDIS_URL` | yes | Redis URL, fail-fast in `cache/redis.ts` |
| `JWT_SECRET` | yes | >= 32 chars (validated in `config.ts`) |
| `ENCRYPTION_KEY` | yes | 32-byte hex |
| `CSRF_SECRET` | yes | 32-byte hex |
| `RECEIPT_HMAC_SECRET` | yes | strong random, NOT the `dev-receipt-hmac-placeholder` default |
| `VENICE_API_KEY` / `OPENROUTER_API_KEY` / `TOGETHER_API_KEY` / `DEEPINFRA_API_KEY` | yes | upstream provider keys |
| `CORS_ORIGIN` | yes | EXACTLY `https://www.oma-ai.com` (no trailing slash, no `*` in prod) |
| `NODE_ENV` | yes | `production` (drives fail-fast) |
| `FACILITATOR_MODE` | yes | per treasury policy |
| treasury addresses, `LOG_LEVEL` | yes | per `server/.env.example` |

> **NOTE on the 2026-06-02 patches**: The server is now configured to **refuse to start** (`process.exit(1)`) in production if any of the above is missing, placeholder, or — for `CORS_ORIGIN` — set to `*`. This is intentional and good. The CI validation gates in `oma/AGENTS.md` will catch a missing var before deploy.

**Domain to attach**: `api.oma-ai.com`.

---

## 3. DNS — point the records

Get the CNAME target Vercel gave each project (Step 2), then:

### Apex (`oma-ai.com`) and `www`

In your DNS provider (Cloudflare / Route53 / Namecheap / Vercel DNS):

| Host | Type | Target |
|---|---|---|
| `oma-ai.com` | A | `76.76.21.21` (Vercel apex IP) |
| `www` | CNAME | `cname.vercel-dns.com` (or the project-specific CNAME Vercel shows) |

If DNS lives in Cloudflare, **disable the orange cloud (proxy) for `api.oma-ai.com`** — Vercel needs to see the real client IP for rate limiting and for any per-IP allowlists.

### `api`

| Host | Type | Target |
|---|---|---|
| `api` | CNAME | `cname.vercel-dns.com` (or the `oma-api` project's CNAME) |

Propagation: typically 30 s to 5 min with Vercel DNS, up to 48 h with external providers. Test with `dig +short api.oma-ai.com`.

---

## 4. CORS — lock it down

In `oma-api` Vercel env:

```
CORS_ORIGIN=https://www.oma-ai.com
```

Do **not** set it to `*`. The server's `src/index.ts` will `process.exit(1)` at module init if you try, in production. (This is the HIGH-3 fix from 2026-06-02.)

If you also have a staging / preview flow, list the exact origins separated by commas; see `server/src/index.ts` lines 84–103 for the parser. The parser compares full origins (scheme + host + port) — `https://staging.oma-ai.com` ≠ `https://www.oma-ai.com`, and that's correct.

---

## 5. Auth — link the cookies and the issuer

The Next.js app and the Hono server must agree on JWT issuer / audience. From the 2026-06-02 patch (`app/src/middleware.ts:48`):

```ts
// Server side
issuer:   "oma-ai"
audience: "oma-ai-api"
```

Mirror this on the Hono side (search for `iss` / `aud` in `server/src/middleware/auth.ts` or wherever JWTs are verified) — they must match exactly, character-for-character. Drift here is the #1 cause of "I get logged in but the dashboard says unauthorized" production bugs.

Cookie attributes (per `docs/DEVELOPER-GUIDE.md` dual-cookie section, MED-12):

- `oma_session` (HTTP-only, `Secure`, `SameSite=Lax`, `Path=/`, `Domain=.oma-ai.com`)
- `oma_csrf` (NOT HTTP-only, `Secure`, `SameSite=Lax`, `Path=/`, `Domain=.oma-ai.com`) — sent to the SPA for double-submit

> Cross-subdomain cookies require `Domain=.oma-ai.com` (note the leading dot). Without it, `api.oma-ai.com` will not see a cookie set by `www.oma-ai.com`.

---

## 6. Verify the deployment

Run these from your laptop, in order. Each must pass before moving on.

```bash
# 6.1 DNS resolves
dig +short www.oma-ai.com | grep -q cname && echo "OK" || echo "FAIL"
dig +short api.oma-ai.com | grep -q cname && echo "OK" || echo "FAIL"

# 6.2 TLS is issued
curl -sIv https://www.oma-ai.com/ 2>&1 | grep -i "subject:\|issuer:" | head -2
curl -sIv https://api.oma-ai.com/ 2>&1 | grep -i "subject:\|issuer:" | head -2

# 6.3 www returns the OMA app, not NosytLabs
curl -sL https://www.oma-ai.com/ | grep -qi "oma"      # must hit
curl -sL https://www.oma-ai.com/ | grep -qi "nosyt"    # must NOT hit

# 6.4 api health
curl -sS https://api.oma-ai.com/health | jq            # {"ok":true,...} expected
curl -sS https://api.oma-ai.com/v1/models | jq         # { "data": [...] } expected

# 6.5 CORS preflight
curl -sS -X OPTIONS https://api.oma-ai.com/v1/chat/completions \
  -H "Origin: https://www.oma-ai.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization, content-type" -i | head -20
# Must show: Access-Control-Allow-Origin: https://www.oma-ai.com
# Must show: Access-Control-Allow-Credentials: true
# Must NOT show: Access-Control-Allow-Origin: *

# 6.6 Auth round-trip
# Open https://www.oma-ai.com/ in a browser, sign in with SIWE,
# then in DevTools confirm:
#   - Document cookie: oma_session=...; Domain=.oma-ai.com
#   - Application > Cookies: oma_session visible
# Then click into a protected page; the Network tab request to
# api.oma-ai.com must carry Authorization: Bearer ... or the oma_session cookie.
```

If §6.3 returns NosytLabs content, you have DNS or Vercel-project routing pointing at the wrong project — go back to §2 and §3.

---

## 7. Rollback / disown

If a deploy goes bad:

```bash
# Revert DNS to the previous NosytLabs project (or static "maintenance" page)
# In DNS provider: change CNAMEs back to the previous targets.

# Disable the Vercel project (keeps the build, prevents traffic)
vercel project ls
vercel project update <project-name> --disabled

# Or roll back a specific deployment
vercel ls <project-name>
vercel rollback <deployment-url>
```

Record what you rolled back in §8.

---

## 8. Change log (fill in as you go)

| When | Action | By | Before | After | Notes |
|---|---|---|---|---|---|
| 2026-06-02 | Runbook drafted | AI assistant | — | — | Pre-deploy |
| | | | | | |
| | | | | | |
