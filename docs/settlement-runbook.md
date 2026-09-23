# OMA-AI Settlement Activation Runbook (Base/USDC/x402)

Status: **CONFIGURED, NOT LIVE** — treasury wallet created + wired, settlement still `mock`.

## Treasury wallet (dedicated, self-custodied, generated with viem)
- **Address:** `0x3144293aACC1c26Eb803591151D775ed89eefcfE` (Base mainnet, chain `8453`)
- Wired in `server/.env` (gitignored, never committed):
  - `TREASURY_BASE_ADDRESS=0x3144293aACC1c26Eb803591151D775ed89eefcfE`
  - `USDC_DEPOSIT_ADDRESS=0x3144293aACC1c26Eb803591151D775ed89eefcfE`
  - `FACILITATOR_PRIVATE_KEY=<0x…>` (derives the address above — verified cryptographically)
- Private key rests ONLY in `server/.env`. Copy it into Bitwarden as the source of truth.

## To go LIVE (2 steps, in order)
1. **Fund the wallet on Base:**
   - a small USDC seed (enough for the first deposits you expect) — **Base USDC**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
   - **~$2 of ETH on Base** for settlement gas (~$0.0001/tx → more than enough).
   - Verify balances on basescan.org for `0x3144293aACC1c26Eb803591151D775ed89eefcfE`.
2. **Flip the mode** in `server/.env` (and the Neon Function's env for prod):
   - `FACILITATOR_MODE=mock` → `FACILITATOR_MODE=live`
   - Redeploy. The code now **reports real x402 readiness** and refuses `mock` in a production `NODE_ENV`.

## Do NOT change
- `X402_FACILITATOR_PROVIDER=coinbase-cdp` — the code **deliberately rejects `quicknode`** as an unsafe settlement delegate (QuickNode is not a hosted settlement service for this merchant).
- QuickNode IS already used correctly as the **Base RPC provider** (`QUICKNODE_RPC_URL` → `CHAIN_RPC_URL`, free tier, $0).

## Cost profile (lowest cost path)
- Self-hosted `coinbase-cdp` settlement (EIP-3009 broadcast via viem + QuickNode RPC) — **$0 facilitator fees**.
- Base settlement gas ≈ **$0.0001/tx**.
- QuickNode free tier = up to **10M credits/month, $0**.
- Vercel: 1 production deployment (Hobby minimum) after the 11→1 prune.

## Deploy note (Vercel prod-branch bug)
Project `productionBranch` is stuck on the retired `master` (API re-link 400s; needs manual dashboard re-link). Workaround that works:
`vercel deploy --prod --yes` from `app/` (the project rootDir). Push-to-main does NOT auto-deploy.
