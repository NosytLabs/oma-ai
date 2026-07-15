# OMA-AI — Deployment (oldpc, free tier)

Host OMA-AI at **zero monthly cost** on `oldpc` (Ryzen 5 1400 / 15GB RAM / 830GB
free / Ubuntu 26.04 / Docker 29). Public ingress via the existing Cloudflare
Tunnel. Admin access via Tailscale + SSH (already configured).

## Topology

```
oldpc (192.168.2.221, Tailscale 100.104.185.83)
├── Cloudflare Tunnel (systemd: cloudflared-nosytlabs)
│     app.oma-ai.com  -> 127.0.0.1:3000  (Next.js)
│     api.oma-ai.com  -> 127.0.0.1:3001  (Hono/Bun)
│     lethometry.com  -> 127.0.0.1:8099  (existing)
└── docker compose (docker-compose.prod.yml)
      ├── app      (Next.js, 1GB cap)
      ├── server   (Hono/Bun, 1GB cap, FACILITATOR_MODE=live)
      ├── postgres (16-alpine, 512MB shared buffers, local — free)
      └── redis    (7-alpine, 512MB max, local — free)
```

Cost: ~$4-7/mo electricity (old Zen @ 24/7). No VPS, no Neon, no managed Redis
needed for beta. Scale to Hetzner+Coolify only when traffic justifies it.

## Prerequisites (already done on oldpc)
- [x] Docker 29.1.3 + Compose v2.24.0
- [x] Cloudflare Tunnel running (systemd service)
- [x] Tailscale + SSH (admin access: `ssh oldpc@192.168.2.221`)
- [x] UFW allows 22 from Tailscale + LAN only

## Deploy

```bash
# 1. on this mac, push the repo + prod files to oldpc
git push origin main
ssh oldpc@192.168.2.221 "cd ~/OMA-AI && git pull"

# 2. on oldpc: create .env.prod from template, fill secrets
ssh oldpc@192.168.2.221
cd ~/OMA-AI
cp .env.prod.example .env.prod
nano .env.prod        # paste real keys (from Bitwarden) — DO NOT commit

# 3. launch
./start-prod.sh       # builds + up -d, checks required secrets + treasury

# 4. verify
docker compose -f docker-compose.prod.yml exec server \
  wget -qO- http://localhost:3001/health
```

## Public ingress (Cloudflare Tunnel)

1. Append the rules from `cloudflare-tunnel-ingress.yml` to
   `~/.cloudflared/config.yml` on oldpc.
2. `sudo systemctl restart cloudflared-nosytlabs`
3. In Cloudflare DNS, point `app.oma-ai.com` + `api.oma-ai.com` at the tunnel
   (orange-cloud proxied).

No port 3000/3001 is ever opened on the WAN — only the tunnel reaches them.

## x402 / USDC go-live checklist
- [ ] `TREASURY_BASE_ADDRESS` funded with ETH (gas) + USDC (receivable) on Base
- [ ] `FACILITATOR_PRIVATE_KEY` = real key, minimal balance, sweep to cold
- [ ] `FACILITATOR_MODE=live` (set in .env.prod)
- [ ] Test a deposit on Base mainnet with a small amount first
- [ ] Sentry DSN set (currently "No DSN provided" — wire before real traffic)

## Profit model (validated against OpenRouter)
- Markup on inference: ~5% (set `OMA_MARKUP_PCT`). At $1K/mo routed = $50 profit.
- x402 facilitator: Coinbase CDP free tier (1,000 tx/mo), then $0.001/tx.
- Break-even vs oldpc electricity: route ~$140/mo at 5%.

## Scale-up path (when needed)
- **Hetzner CX22 + Coolify** (~€5.49/mo): same compose, managed host, UPS-backed.
- **Neon Postgres**: swap `DATABASE_URL` to Neon Pro (min compute 1 CU, no cold-start).
- **Upstash Redis**: swap `REDIS_URL` for HA Redis (rate-limiter fails-closed on Redis errors).
- **Fly.io**: only if you need global edge later.

## Notes / risks
- Residential power = single point of failure for a payments gateway. Add a UPS
  before routing real money, or move to Hetzner.
- oldpc has no GPU — irrelevant (OMA-AI proxies to remote providers, no local inference).
- 4 cores: fine for a gateway (proxy work). Saturates only under heavy fan-out.
