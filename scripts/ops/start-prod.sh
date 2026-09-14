#!/usr/bin/env bash
# =============================================================================
# OMA-AI production launcher for oldpc
#   Usage:  ./scripts/ops/start-prod.sh           # build + up (detached)
#           ./scripts/ops/start-prod.sh down      # stop
#           ./scripts/ops/start-prod.sh logs      # follow logs
#
# Reads secrets from .env.prod (gitignored). Start from the root .env.example,
# copy it to .env.prod, and replace every placeholder with production values.
# Secrets are NEVER committed.
# =============================================================================
set -euo pipefail

cd "$(cd "$(dirname "$0")/../.." && pwd)"

if [[ "${1:-}" == "down" ]]; then
  docker compose -f docker-compose.prod.yml down
  exit 0
fi

if [[ "${1:-}" == "logs" ]]; then
  docker compose -f docker-compose.prod.yml logs -f
  exit 0
fi

# Load the deployment env file so the preflight and Docker Compose receive the
# same values. Compose does not auto-load .env.prod, so exporting is deliberate.
if [[ ! -f .env.prod ]]; then
  echo "[fatal] Missing .env.prod. Copy .env.example to .env.prod and set production values."
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env.prod
set +a

# sanity: required secrets present
REQUIRED=(POSTGRES_PASSWORD BETTER_AUTH_SECRET ENCRYPTION_KEY RECEIPT_HMAC_SECRET \
          VENICE_API_KEY FACILITATOR_MODE TREASURY_BASE_ADDRESS \
          USDC_DEPOSIT_ADDRESS CHAIN_RPC_URL PUBLIC_APP_URL PUBLIC_API_URL \
          BETTER_AUTH_URL CORS_ORIGIN PRIMARY_DOMAIN)
if [[ "${X402_FACILITATOR_PROVIDER:-coinbase-cdp}" == "coinbase-cdp" && "${FACILITATOR_MODE:-}" == "live" ]]; then
  REQUIRED+=(FACILITATOR_PRIVATE_KEY)
fi
if [[ -n "${POLAR_ACCESS_TOKEN:-}" ]]; then
  REQUIRED+=(POLAR_WEBHOOK_SECRET POLAR_HOBBY_PRODUCT_ID POLAR_BUILDER_PRODUCT_ID POLAR_SCALE_PRODUCT_ID)
fi
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

for v in BETTER_AUTH_SECRET ENCRYPTION_KEY RECEIPT_HMAC_SECRET VENICE_API_KEY \
         TREASURY_BASE_ADDRESS USDC_DEPOSIT_ADDRESS CHAIN_RPC_URL; do
  value="${!v}"
  if [[ "$value" =~ placeholder|changeme|your-key|example ]] || [[ "$value" =~ ^0x0{39}[0-9a-fA-F]$ ]]; then
    echo "  PLACEHOLDER: $v"
    missing=1
  fi
done
if [[ "$missing" -eq 1 ]]; then
  echo "[fatal] Replace every production placeholder in .env.prod before launching."
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
