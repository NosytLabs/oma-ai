# OMA Platform Owner Onboarding

> **Audience:** Tyson (the platform owner). One-time setup. Do it once per environment (dev / staging / production).
> **Sources of truth:** `server/.env.example`, `server/src/config.ts`, `docs/CRITICAL-1-DEPLOYMENT-RUNBOOK.md`, `.opencode/unit-tests/2026-06-13T18-37-25Z-base-mcp.md`.

## §0. TL;DR

1. **Get a hot wallet** — `node scripts/generate-platform-wallet.mjs` → save the address + private key in 1Password.
2. **Fund it** — send ~$25 USDC on **Base** + a tiny bit of **ETH on Base** (~$1 worth) for gas. Add it to MetaMask.
3. **Set env vars** — paste the address into `TREASURY_BASE_ADDRESS` / `HOUDINI_ADDRESS_TO` / `CHEAPTOKENS_ADDRESS`, the private key into `FACILITATOR_PRIVATE_KEY` (and the same key in `SURPLUS_WALLET_PRIVATE_KEY` for the one-wallet bootstrap). Set `FACILITATOR_MODE=live`. Deploy.

Everything below is the details for the above.

---

## §1. Wallets you need

| Name | Chain | Purpose | Hot / cold | Who controls | Config var(s) |
|---|---|---|---|---|---|
| **Platform hot wallet** | Base (chainId 8453) | Receives USDC from users; signs x402 settlements; pays gas | Hot — keep ≤ $200 working capital | The server (private key in env) | `TREASURY_BASE_ADDRESS`, `HOUDINI_ADDRESS_TO`, `CHEAPTOKENS_ADDRESS` *(all = same address)*, `FACILITATOR_PRIVATE_KEY`, `SURPLUS_WALLET_PRIVATE_KEY` |
| **Operator cold wallet** | Base | Receives periodic USDC sweeps from the hot wallet | Cold — long-term store | You (MetaMask / hardware wallet) | `ADMIN_SWEEP_ADDRESS` |
| **Admin signing key** (optional) | Base | Signs onchain sweeps from hot → cold when you don't want to use a hardware wallet | Cold | You | `TREASURY_PRIVATE_KEY` *(omitted for the one-wallet bootstrap)* |
| **Server operator wallet** | (any) | Listed in `ADMIN_WALLET_ADDRESSES` so you can hit `/admin/*` routes | n/a | You (MetaMask) | `ADMIN_WALLET_ADDRESSES` |

**The one-wallet bootstrap:** for the first cut, the *hot wallet* and the *signing key* are the **same wallet**. You generate one keypair, paste the **address** everywhere a public address is required, paste the **private key** into the server's env. Later, you can split: move the signing-key role to a hardware wallet or a multisig (Safe) and keep just the address for the public-facing role. Don't split until you have ≥ $1k in working capital — the operational complexity isn't worth it before then.

**Already-funded addresses on Base (verified 2026-06-13 by M5 audit, in `.opencode/unit-tests/2026-06-13T18-37-25Z-base-mcp.md:60-67`):**

| Address | Role | Balance (at audit time) | Source |
|---|---|---|---|
| `0x8581784D3E598cCa3482375CFF2409Ac9DD8c402` | Documented OMA treasury / payTo in `app/src/app/llms.txt/route.ts:67` | 0.105 ETH, 309.295 USDC | M5 audit |
| `0x0AcdFE0779f527e9BF75F52458301432EdD7633f` | Currently set as `TREASURY_BASE_ADDRESS` and `HOUDINI_ADDRESS_TO` in `server/.env:45-46` | (not re-verified) | dev default |
| `0x0770d2124C0a581C28Cfc47a659817145e6Cc137` | x402 settlement proxy / EIP-712 verifyingContract | 0 ETH (USDC `name()` reverts) | M5 audit |

> **Pitfall:** the **documented** treasury (`0x8581…c402`) and the **currently-configured** treasury (`0x0Acd…633f`) are two different addresses. Pick **one**, use it everywhere. The user-facing docs / llms.txt / the `app/.env.local` `NEXT_PUBLIC_TREASURY_BASE_ADDRESS` and the server's `TREASURY_BASE_ADDRESS` must all agree. A mismatch means users send to one address and the server watches the other — silent loss.

---

## §2. Generate the hot wallet

This repo ships a one-shot script:

```bash
cd /Users/tyson/Desktop/Code/OMA-AI
node scripts/generate-platform-wallet.mjs
```

It prints:

```
Address:      0x...
Private Key:  0x...
```

…and exits. It does **not** write to disk.

**What to do with the output:**

1. Copy the **Address** into a fresh note: `OMA Hot Wallet — <env>`.
2. Copy the **Private Key** into 1Password (or your password manager of choice) under the same entry. Title it `OMA Hot Wallet Private Key — <env>`. Set the password manager to require re-auth to view.
3. Clear your terminal scrollback (`clear` after the values are saved).
4. **Never** paste the private key into chat, a screenshot, a git commit, or a Notion page. The public address is safe to share. The private key is the wallet.

> Why a fresh key and not "an existing one of mine"? The server needs the private key in plaintext in `server/.env` (or a secret store). Anything with the key has full control of the wallet. A throwaway hot wallet limits blast radius — you can sweep the cold side out of it instantly and rotate the key without touching your personal funds.

---

## §3. Add the address to MetaMask

> Replace every `0x...` below with the address from §2.

**Manual add (works for any wallet):**

1. Open MetaMask → click the network dropdown → **Add network** → **Add a network manually** (or pick "Base" if it's already there).
2. Network config:
   - **Network name:** Base
   - **RPC URL:** `https://mainnet.base.org` (or QuickNode / Alchemy if you have a paid key)
   - **Chain ID:** `8453`
   - **Currency symbol:** ETH
   - **Block explorer URL:** `https://basescan.org`
3. Save and switch to **Base**.
4. Click the account icon → **Add account or hardware wallet** → **Add an account** → **Import an account** → paste the **public address** (0x…). MetaMask creates a watch-only view of your hot wallet.
5. To send *from* the hot wallet, you'd need to import the **private key** instead — **don't do this on your daily MetaMask**. Use a separate "Hot Ops" MetaMask install, or import the key into a hot ops tool like Rabby/Frame on a hardened machine.

**Screenshot placeholders** *(fill in after first run):*

- `docs/screenshots/onboarding/01-metamask-add-network.png` — the "Add network manually" form filled in.
- `docs/screenshots/onboarding/02-metamask-import-address.png` — the "Import account" screen with the address pasted.
- `docs/screenshots/onboarding/03-metamask-base-balance.png` — Base mainnet selected, USDC and ETH balances visible.

**Other wallets (Rainbow, Rabby, Frame, Coinbase Wallet):** all support a custom Base RPC + watch-only address import. Same fields as above.

---

## §4. Fund the platform

You need two things in the hot wallet before going live:

### 4.1 USDC (working capital)

For the first month of testing + early users: **$50–$200 USDC on Base** is plenty. Refill when the cold sweep drains it.

How to acquire:

| Source | Speed | Cost | Notes |
|---|---|---|---|
| **Coinbase → Withdraw → USDC on Base** | Minutes | Free | Easiest if you already have a CEX account. Pick the **Base** network (not Ethereum). |
| **Bridge from another chain** (Arbitrum, Optimism, Mainnet) via `https://bridge.base.org` | 10–20 min | ~$0.05 gas | For larger amounts. The native Base bridge is canonical. |
| **Buy on Uniswap on Base** (USDC.e → USDC) | Minutes | Swap fee | Only if you already hold something on Base. |
| **Bridge via Houdini** (`server/src/credits/houdini-client.ts`) | 10 min | 0.5–1% | This is what end-users will use. Try it once as a smoke test. |

> **Use USDC, not USDC.e.** There are two USDCs on Base: native USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, what OMA expects) and bridged USDC.e (`0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA`, the legacy bridged form). Sending USDC.e will credit the user's balance only if the wallet integration is using the bridge USDC contract; the `server/src/jobs/deposit-recovery.ts:46-65` log filter is pinned to the **native** USDC contract, so bridged USDC.e will not auto-credit. The user can manually enter a wrong-network recovery request.

### 4.2 ETH for gas

Base is cheap: **0.006 gwei** typical, **`$0.001` per ERC-20 transfer** (M5 audit, 2026-06-13). For 100–500 settlements/day you need **< $0.50 of ETH per day**. Send **$2 of ETH on Base** to start; refill weekly.

> **Critical:** if the hot wallet runs out of ETH, all settlement transactions revert. No alert fires automatically. Set a balance alert on MetaMask (or your wallet of choice) for "ETH < 0.0005" → email.

### 4.3 Test deposit procedure

Before flipping `FACILITATOR_MODE=live`, prove the pipeline end-to-end:

1. **From your personal MetaMask on Base:** send **$1 USDC** to the hot wallet address.
2. Wait for 1 block confirmation (~2s on Base).
3. **Sign in** to `https://www.oma-ai.com/dashboard` (or your local `localhost:3000/dashboard` in dev) with a fresh wallet. This is the test user.
4. Click **Deposit** → **USDC Direct** → enter **$1** and the tx hash from step 1.
5. The dashboard should show a +$1 credit balance within ~5 seconds. If it doesn't, see §8.

> The `processUsdcDeposit` function in `server/src/credits/deposit.ts:48-76` requires a cryptographic `signature` of ≥ 64 chars for any non-zero deposit (line 50-52). The frontend handles this — you don't need to construct it manually. If you're testing with `curl`, pass a dummy 64-hex-char signature or you'll get `Deposit requires valid cryptographic proof`.

---

## §5. Required env vars

All of these go in **`server/.env`** (NOT committed — `server/.env` is gitignored). The values you generate in §2 (address) and §2 (private key) plug in here.

| Var | What | Example / format | Required? | Notes |
|---|---|---|---|---|
| `NODE_ENV` | Runtime mode | `production` | yes | Drives the fail-fast checks in `server/src/config.ts:217-265`. |
| `DATABASE_URL` | Postgres | `postgresql://user:pass@host:5432/oma?sslmode=require` | yes | Production guard refuses `localhost` (line 261-263). |
| `REDIS_URL` | Redis (rate-limit, locks) | `redis://:pass@host:6379` | yes (recommended) | Falls back to in-memory if down, but degraded. |
| `JWT_SECRET` | Session cookie HMAC | 40+ char random | yes | Min 40 in prod (line 242-245). |
| `ENCRYPTION_KEY` | TOTP secret AES key | 32-byte hex / base64 | yes | Rotating it invalidates all 2FA secrets. |
| `CSRF_SECRET` | CSRF token HMAC | 32+ char random | yes | Refuses the dev default in prod (line 220-223). |
| `RECEIPT_HMAC_SECRET` | x402 receipt HMAC | 32+ char random | yes | Refuses dev default in prod (line 252-255). |
| `ONRAMP_WEBHOOK_SECRET` | Onramp provider signature | (from onramp provider) | recommended | Warns if unset in prod (line 265-267). |
| `CORS_ORIGIN` | Browser origins | `https://www.oma-ai.com,https://staging.oma-ai.com` | yes | **`*` is fatal in production** (`server/src/index.ts:54-58`). |
| `FACILITATOR_MODE` | Mock / live | `live` | yes | `mock` is fatal in prod (`config.ts:225-227`). |
| `TREASURY_BASE_ADDRESS` | The hot wallet's public address | `0x…` (EIP-55 checksummed) | yes | Refuses `0x3333…3333` placeholder in prod (line 230-234). |
| `HOUDINI_ADDRESS_TO` | Payee for x402 / Houdini | same as above | yes | Pin to the same address for the one-wallet bootstrap. |
| `CHEAPTOKENS_ADDRESS` | Payee for CheapTokens | same as above | yes | Same. |
| `FACILITATOR_PRIVATE_KEY` | Server signing key | `0x` + 64 hex | yes (live mode) | The hot wallet's private key. Used by `cheaptokens.ts:125`. |
| `SURPLUS_WALLET_PRIVATE_KEY` | Surplus path signing key | same as above | yes (live mode) | Same key in the one-wallet bootstrap. |
| `TREASURY_PRIVATE_KEY` | Sweep signer (optional) | `0x` + 64 hex | optional | Omit for the one-wallet bootstrap; the sweep endpoint will 501 (read-only). |
| `ADMIN_SWEEP_ADDRESS` | Where sweeps go | your cold wallet | optional | 403 if `TREASURY_PRIVATE_KEY` set but this missing. |
| `SURPLUS_SETTLEMENT_CONTRACT` | Surplus verifier | `0x0770d2124C0a581C28Cfc47a659817145e6Cc137` | recommended | From M5 audit. |
| `SURPLUS_PERMIT2_CONTRACT` | Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | recommended | Canonical Permit2. |
| `SURPLUS_USDC_CONTRACT` | Native USDC on Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | recommended | Native USDC. **Not** USDC.e. |
| `SURPLUS_VERIFIER_CONTRACT` | Legacy EIP-712 | (unset for now) | optional | Only set if you're keeping the legacy verifier. |
| `CHAIN_RPC_URL` | Base mainnet RPC | `https://mainnet.base.org` or QuickNode | yes | Used by `deposit-recovery.ts:38`, `x402/facilitator.ts:319`, etc. |
| `CHAIN_RPC_URL_FALLBACK` | Backup RPC | `https://base-rpc.publicnode.com` | recommended | Auto-fallback in `facilitator.ts:335-340`. |
| `ADMIN_WALLET_ADDRESSES` | Comma-separated admin addrs | `0xff54d5d60670d505cd956e7cbc66a33dd8544566,…` | recommended | OOB admin gating. |
| Provider API keys | `VENICE_API_KEY`, `OPENROUTER_API_KEY`, `TOGETHER_API_KEY`, `ANTHROPIC_API_KEY`, etc. | `sk-…` | depends | The chat gateway needs at least one upstream. |
| `BASE_CHAIN_ID` | Base mainnet chain ID | `8453` | yes | `84532` = Base Sepolia (testnet). Default in `config.ts:102`. |

> **TL;DR for §5:** copy `server/.env.example` to `server/.env`, then fill in:
> 1. The 6 auth secrets (one-shot: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` 6 times, save outputs to 1Password).
> 2. The 4 address vars (`TREASURY_BASE_ADDRESS`, `HOUDINI_ADDRESS_TO`, `CHEAPTOKENS_ADDRESS`, `ADMIN_SWEEP_ADDRESS`).
> 3. The 2 private keys (`FACILITATOR_PRIVATE_KEY` = hot wallet PK; `SURPLUS_WALLET_PRIVATE_KEY` = same PK; leave `TREASURY_PRIVATE_KEY` unset for the one-wallet bootstrap).
> 4. The 5 RPC / contract addresses (RPC URL, fallback, settlement proxy, Permit2, USDC).
> 5. The 3 fail-fast toggles (`NODE_ENV=production`, `FACILITATOR_MODE=live`, `CORS_ORIGIN=https://www.oma-ai.com`).
> 6. At least one provider API key.

---

## §6. Verify (smoke tests)

Run these in order. Each must pass before moving on.

```bash
# 6.1 Health
curl -sS https://api.oma-ai.com/health | jq
# Expect: {"status":"ok",...}

# 6.2 Health detail (with DB + Redis status)
curl -sS https://api.oma-ai.com/health/ready | jq
# Expect: {"db":"ok","redis":"ok",...}

# 6.3 Models list
curl -sS https://api.oma-ai.com/v1/models | jq '.data | length'
# Expect: a positive number, not 0, not an error

# 6.4 Hot wallet balance (read-only via Basescan)
curl -sS "https://api.basescan.org/api?module=account&action=balance&address=$TREASURY_BASE_ADDRESS&tag=latest" | jq
# Expect: status=1, a positive ETH balance

# 6.5 Test deposit (via the UI, since the API requires a signature)
#    - From your personal MetaMask on Base, send $1 USDC to TREASURY_BASE_ADDRESS
#    - Wait one block
#    - Sign in at /dashboard with a throwaway test wallet
#    - Deposit page → USDC Direct → $1 → paste the tx hash
#    - Dashboard should show +$1 within ~5 s

# 6.6 Credit balance check
curl -sS https://api.oma-ai.com/v1/credits/balance \
  -H "Authorization: Bearer $TEST_USER_JWT" | jq
# Expect: {"balanceCents": 100, ...} (for the $1 deposit)
```

If §6.5 fails: check `server/src/jobs/deposit-recovery.ts:46-65` (it scans USDC `Transfer` events **to the address in `TREASURY_BASE_ADDRESS`**). If your `.env` has a different address than the one you sent to, the scan won't find it. Also confirm you used **native USDC** (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`), not USDC.e.

---

## §7. Monitoring

| What | Where | What to watch |
|---|---|---|
| **Hot wallet ETH balance** | Basescan alert (`https://basescan.org/address/$TREASURY_BASE_ADDRESS` → "Watch List") | ETH < 0.0005 → email. Settlement reverts if it hits 0. |
| **Hot wallet USDC balance** | Same | Sudden drop without a corresponding deposit = someone drained it. Page. |
| **Settlement failures** | Server log: grep for `"[facilitator] EVM verification error"` (`x402/facilitator.ts:330`) | > 1% rate = upstream RPC issue or a config drift. |
| **DLQ growth** | Postgres: `SELECT count(*) FROM settlements_dlq` (if the table exists; see `server/src/lib/dlq.ts`) | Any growth = persistent settlement write failures. Page. |
| **CORS errors** | Server log: `"[CORS] Wildcard origin '*'"` (`index.ts:101`) | If this fires, someone tried to set `CORS_ORIGIN=*` in prod. The server is supposed to refuse to start, so seeing this means a code-level bypass. |
| **`FACILITATOR_MODE` drift** | Server log: `"[FACILITATOR] [WARN] Processing payment in mock mode"` (`facilitator.ts:410`) | If you see this in production, someone changed the env var. Investigate immediately. |
| **Deposit recovery backlog** | Server log: `"[recovery] Auto-expired pending recovery"` (`deposit-recovery.ts:288`) | > 5/day = something is misrouting. |
| **Credit expiry churn** | Server log: `"[credit-expiry]"` | Expected ~1% of unused credits per week. Spike = users churning. |

**Where alerts go:** MetaMask / Basescan email for onchain alerts. Server logs → a log sink (Datadog, Better Stack, etc., not configured here). Slack/email PagerDuty integrations for "page" items are a TBD follow-up.

**What to NOT alert on (will false-alarm constantly):**

- USDC balance going up (that's a deposit).
- ETH balance going down by a fraction of a cent (that's gas).
- Settlement latency > 2 seconds (Base is fast but RPC variance is normal).

---

## §8. Common pitfalls

### 8.1 The Jupiter Solana USDC mint (now fixed)

**Was:** `server/src/routes/jupiter.ts:19` shipped with `EPjFWdd5AufqSSqeM2qN1xzybapC8DM4GMX5HEsPsS1` (last 22 chars `…C8DM4GMX5HEsPsS1`). The canonical Circle USDC mint on Solana is `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (last 22 chars `…C8G4wEGGkZwyTDt1v`). See M5 audit (2026-06-13).

**Now:** fixed in commit `c2d4563` (v5 mission). The current `jupiter.ts:19` matches the canonical mint.

**If you see USDC-on-Solana deposits not crediting:** double-check `server/src/routes/jupiter.ts:19` against the canonical above. The fix is a 1-character string change.

### 8.2 The EIP-55 checksum trap

Every address in this doc has a specific **mixed-case** format. That's not decorative — it's the **EIP-55 checksum**, computed from `keccak256(lowercase(address))`. A single-character change (case flip, hex digit) breaks the checksum, and viem / ethers / MetaMask will reject the address with `INVALID_ARGUMENT: bad address checksum`.

**Symptoms of a checksum bug:**

- MetaMask shows the address as valid but the network sees it as a different address (0x… with all lowercase).
- `viem` / `ethers` throws `"Address checksum does not match"` or `"InvalidArg"`.
- The MCP `get_token_info` call returns `bad address checksum (INVALID_ARGUMENT)`.

**Fix:** regenerate the address with the correct EIP-55 form. Easiest: use viem's `getAddress(address)` which returns the checksummed form:

```bash
node -e "import('viem').then(v => console.log(v.getAddress('0x<lowercase address>')))"
```

or use the address **exactly** as printed by `scripts/generate-platform-wallet.mjs` — viem's `privateKeyToAccount` always returns the EIP-55 form.

The 2026-06-13 M5 audit caught a real-world example of this: `docs/API-DOCUMENTATION.md:414` had a typo (`0x833589fCD6eDb6E08f4c7C32D4f71b54cA3B8766` — note `cA3B8766` instead of `bdA02913`). Always validate docs addresses with `viem.getAddress()` before pasting.

### 8.3 `CORS_ORIGIN` fail-fast in production

`server/src/index.ts:54-58` calls `process.exit(1)` if `CORS_ORIGIN === "*"` and `NODE_ENV === "production"`. **This is intentional.** It catches the most common production bug (a `*` in `.env` from a dev template). If your server won't start in prod and the log says `[SECURITY] CORS_ORIGIN='*' is not allowed in production`, **don't** "fix" the guard. Set the real origin:

```env
CORS_ORIGIN=https://www.oma-ai.com
```

For preview / staging, comma-separate:

```env
CORS_ORIGIN=https://www.oma-ai.com,https://staging.oma-ai.com,https://preview-oma-ai.vercel.app
```

### 8.4 Other `config.ts` fail-fasts

From `server/src/config.ts:217-265`, the following will refuse to start in `NODE_ENV=production` / `staging` / `preview`:

| Trigger | Fatal message |
|---|---|
| `JWT_SECRET` is a known dev default | `[FATAL] JWT_SECRET must not be a known insecure default` |
| `JWT_SECRET` < 40 chars | `[FATAL] JWT_SECRET must be at least 40 characters` |
| `RECEIPT_HMAC_SECRET` unset | `[FATAL] RECEIPT_HMAC_SECRET must be set in production` |
| `RECEIPT_HMAC_SECRET` is dev default | `[FATAL] RECEIPT_HMAC_SECRET must not be a known insecure default` |
| `FACILITATOR_MODE=mock` | `FATAL: FACILITATOR_MODE=mock is not allowed in production or staging` |
| `TREASURY_BASE_ADDRESS` is a placeholder (`0x3333…3333`) | `FATAL: TREASURY_BASE_ADDRESS is a placeholder address` |
| `DATABASE_URL` has no credentials or `localhost` | `FATAL: DATABASE_URL must have proper credentials` |
| `CSRF_SECRET` is a dev default | `[FATAL] CSRF_SECRET must not be a known insecure default` |
| `CORS_ORIGIN=*` | (above) |

These are loud on purpose. If you hit one, **fix the env, don't disable the check.**

### 8.5 Native USDC vs USDC.e

There are two USDCs on Base:

- **Native USDC** (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) — what Circle issues natively on Base, what OMA expects.
- **USDC.e** (`0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA`) — the legacy bridged form.

Coinbase's "Withdraw USDC on Base" sends **native** USDC. Some DEXes (Uniswap on Base) show both. Make sure the token you send to the hot wallet is **native USDC**. The token contract address is the only way to tell them apart; the symbol in your wallet will say "USDC" for both.

If a user sends USDC.e, it will arrive in the hot wallet, but `server/src/jobs/deposit-recovery.ts:46-65` only watches native USDC `Transfer` events. The user has to file a wrong-network recovery request (the UI has a "wrong network?" link on the deposit page).

### 8.6 The two-treasury mismatch

`server/.env:45` sets `TREASURY_BASE_ADDRESS=0x0AcdFE0779f527e9BF75F52458301432EdD7633f`. `app/src/app/llms.txt/route.ts:67` documents the treasury as `0x8581784D3E598cCa3482375CFF2409Ac9DD8c402`. M5 audit verified the documented address has real funds. These don't agree.

**Action before going live:** pick one. Either:

- (a) Move the dev funds from `0x0Acd…` to `0x8581…` and update `server/.env`, OR
- (b) Move the public USDC from `0x8581…` to a fresh new address and update both `server/.env` and `app/src/app/llms.txt/route.ts:67` and `app/.env.local:3`.

Whichever you pick, **both files must agree** before you start taking real user deposits. A mismatch = users send to address A, server watches address B, money stuck.

---

## Appendix A: Quick-reference command sheet

```bash
# Generate the hot wallet
cd /Users/tyson/Desktop/Code/OMA-AI
node scripts/generate-platform-wallet.mjs
# → copy Address → MetaMask, copy Private Key → 1Password

# Generate a strong secret (run 6 times for JWT, ENCRYPTION, CSRF, RECEIPT, ONRAMP_WEBHOOK, OMA_API_KEY)
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# Validate an address checksum
node -e "import('viem').then(v => console.log(v.getAddress('0xLOWERCASE_ADDRESS')))"

# Check hot wallet ETH balance (no API key needed for free tier)
curl -sS "https://api.basescan.org/api?module=account&action=balance&address=$TREASURY_BASE_ADDRESS&tag=latest" | jq

# Smoke test the live server
curl -sS https://api.oma-ai.com/health | jq
curl -sS https://api.oma-ai.com/v1/models | jq '.data | length'
```

## Appendix B: What I deliberately didn't include

- **Hardware wallet / Safe multisig setup.** YAGNI until you have working capital to protect. The one-wallet bootstrap is enough to ship.
- **Coinbase Server Wallet v2 (CDP).** Tempting — it gives you a managed signing endpoint — but it's a third-party dependency and a new account model. The simple self-custody hot key is the right starting point. Migrate later if you need managed signing.
- **Gas estimation cron / auto-top-up.** Not needed at 0.006 gwei. Revisit if Base fees spike.
- **CI / deploy automation.** That's the deploy runbook, not onboarding.
