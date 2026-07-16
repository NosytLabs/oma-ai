# OMA-AI — Deployment (GitHub + Coolify on oldpc)

Zero-monthly-cost production host. Code lives on GitHub, **Coolify** (already
running on oldpc) pulls `main`, builds the prod compose, and serves it behind
the existing Cloudflare Tunnel. Admin access via Tailscale + SSH.

## Topology

```
GitHub (NosytLabs/oma-ai, main)
        │ git push
        ▼
Coolify (oldpc :8000, container "coolify")
        │ builds + runs docker-compose.prod.yml
        ▼
oldpc (Ryzen 5 1400 / 15GB / 830GB free / Ubuntu 26.04)
├── Cloudflare Tunnel (cloudflared-nosytlabs)
│     app.oma-ai.com -> 127.0.0.1:3000  (Next.js)
│     api.oma-ai.com -> 127.0.0.1:3001  (Hono/Bun)
└── compose: app + server + postgres + redis (all local, free)
```

Cost: ~$4-7/mo electricity. No VPS, no Neon, no managed Redis for beta.

## How to deploy (Coolify)

1. **Push to GitHub** (done — `docker-compose.prod.yml` is in `main`).
2. **Open Coolify**: browse to `http://oldpc:8000` (or `http://192.168.2.221:8000`
   on LAN / via Tailscale). Log in (or finish first-run setup).
3. **Add resource** → "Public Repository" → paste
   `https://github.com/NosytLabs/oma-ai`.
4. **Pick compose file**: `docker-compose.prod.yml` (not the dev `docker-compose.yml`).
5. **Set environment**: in Coolify's env UI, paste every var from
   `.env.prod.example` (real values from Bitwarden). Coolify injects them into
   the compose. **Never commit `.env.prod`.**
6. **Deploy**. Coolify builds app + server images, starts postgres + redis,
   wires the network, and gives you a health status.
7. **Domains**: in Coolify, set `app.oma-ai.com` + `api.oma-ai.com`. Then add
   the same hostnames to the Cloudflare Tunnel (see below) so public traffic
   reaches the containers.

That's it — no scp, no manual `docker compose up`. Coolify handles SSL,
rollbacks, and restart-on-failure.

## Public ingress (Cloudflare Tunnel)

Coolify binds containers to oldpc's localhost (`:3000`, `:3001`). The tunnel
exposes them. Append to `~/.cloudflared/config.yml` on oldpc (see
`cloudflare-tunnel-ingress.yml` for the full block), then:

```bash
sudo systemctl restart cloudflared-nosytlabs
```

In Cloudflare DNS, point `app.oma-ai.com` + `api.oma-ai.com` at the tunnel
(orange-cloud). No WAN ports opened — only the tunnel reaches the containers.

## Prerequisites (already true on oldpc)
- [x] Docker 29.1.3 + Compose v2.24.0
- [x] Coolify running (UI :8000, realtime + db + redis healthy)
- [x] Cloudflare Tunnel (systemd `cloudflared-nosytlabs`)
- [x] Tailscale + SSH (`ssh oldpc@192.168.2.221`)
- [x] UFW: 22 from Tailscale + LAN only

## x402 / USDC go-live checklist
- [ ] `TREASURY_BASE_ADDRESS` funded (ETH for gas + USDC receivable) on Base
- [ ] `FACILITATOR_PRIVATE_KEY` = real key, minimal balance, sweep to cold
- [ ] `FACILITATOR_MODE=live` (default in prod compose)
- [ ] Test a small mainnet deposit before real traffic
- [ ] Sentry DSN set (currently "No DSN" — wire before launch)

## Profit model (validated vs OpenRouter: $50M ARR, 5% take rate)
- Markup on inference ~5% (`OMA_MARKUP_PCT`). $1K/mo routed = $50 profit.
- x402 facilitator: Coinbase CDP free tier (1k tx/mo), then $0.001/tx.
- Break-even vs oldpc power: ~$140/mo routed at 5%.

## Scale-up (when traffic justifies)
- **Hetzner CX22 + Coolify** (~€5.49/mo): same compose, managed host, UPS-backed.
- **Neon Postgres**: swap `DATABASE_URL` to Neon Pro (min 1 CU, no cold-start).
- **Upstash Redis**: HA Redis (rate-limiter fails-closed on Redis errors).
- **Fly.io**: only if global edge needed later.

## Risks
- Residential power = SPOF for a payments gateway. Add a UPS before real money,
  or move to Hetzner.
- No GPU on oldpc — irrelevant (OMA-AI proxies to remote providers).
- 4 cores: fine for a gateway; saturates only under heavy concurrent fan-out.
