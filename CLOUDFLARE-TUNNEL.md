# Cloudflare Tunnel — public ingress for OMA-AI (no WAN port open)
#
# Prereqs:
#   - Domain oma-ai.com in Cloudflare
#   - cloudflared installed on oldpc:  curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared
#
# One-time setup (run on oldpc):
#   1. login:            cloudflared tunnel login
#   2. create tunnel:    cloudflared tunnel create oma-ai
#      -> prints a Tunnel ID + credentials.json path
#   3. point DNS:
#      cloudflared tunnel route dns oma-ai oma-ai.com
#      cloudflared tunnel route dns oma-ai api.oma-ai.com
#   4. get token for docker-compose.prod.yml:
#      cloudflared tunnel token oma-ai
#      -> paste into CLOUDFLARE_TUNNEL_TOKEN in .env.prod
#
# Tunnel config (config.yml) — maps hostnames to local compose services:
#   tunnel: <TUNNEL_ID>
#   credentials-file: /root/.cloudflared/<TUNNEL_ID>.json
#   ingress:
#     - hostname: oma-ai.com
#       service: http://app:3000
#     - hostname: api.oma-ai.com
#       service: http://server:3001
#     - service: http_status:404
#
# Then `./start-prod.sh` brings up app+server+postgres+redis+cloudflared.
# Cloudflare terminates TLS; oma-ai.com + api.oma-ai.com are public.
# SSH stays on Tailscale only (UFW allows 100.64.0.0/10) — never open 22 on WAN.
#
# Verify:
#   curl -fsS https://api.oma-ai.com/health
#   curl -fsS https://oma-ai.com
