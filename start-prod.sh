#!/usr/bin/env bash
# =============================================================================
# OMA-AI production launcher for oldpc
#   Usage:  ./start-prod.sh           # build + up (detached)
#           ./start-prod.sh down      # stop
#           ./start-prod.sh logs      # follow logs
#
# Reads secrets from .env.prod (gitignored). Copy .env.prod.example -> .env.prod
# and fill in real values. Secrets are NEVER committed.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")"

if [[ "${1:-}" == "down" ]]; then
  docker compose -f docker-compose.prod.yml down
  exit 0
fi

if [[ "${1:-}" == "logs" ]]; then
  docker compose -f docker-compose.prod.yml logs -f
  exit 0
fi

# sanity: required secrets present
REQUIRED=(POSTGRES_PASSWORD JWT_SECRET ENCRYPTION_KEY CSRF_SECRET RECEIPT_HMAC_SECRET \
          VENICE_API_KEY FACILITATOR_MODE FACILITATOR_PRIVATE_KEY \
          TREASURY_BASE_ADDRESS CHAIN_RPC_URL)
missing=0
for v in "${REQUIRED[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    echo "  MISSING: $v"
    missing=1
  fi
done
if [[ "$missing" -eq 1 ]]; then
  echo "[fatal] Set the above in .env.prod (or your shell) before launching."
  exit 1
fi

# treasury funded check (Base mainnet) — warn, don't block
if command -v cast >/dev/null 2>&1; then
  bal=$(cast balance --rpc-url "$CHAIN_RPC_URL" "$TREASURY_BASE_ADDRESS" 2>/dev/null || echo "0")
  echo "[check] treasury $TREASURY_BASE_ADDRESS balance: $bal ETH"
fi

echo "[start] building + launching OMA-AI (prod)..."
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "[done] app on :3000, server on :3001 (reachable via Cloudflare Tunnel)"
echo "        health: docker compose -f docker-compose.prod.yml exec server wget -qO- http://localhost:3001/health"
