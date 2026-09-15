#!/usr/bin/env bash
# Preflight for Coolify / production launch.
# Usage:
#   ./scripts/ops/check-launch-env.sh           # reads .env.prod if present
#   ENV_FILE=/path/to/env ./scripts/ops/check-launch-env.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env.prod}"

RED=$'\033[0;31m'
YEL=$'\033[1;33m'
GRN=$'\033[0;32m'
NC=$'\033[0m'

fail=0
warn=0

ok() { echo "${GRN}OK${NC}  $*"; }
bad() { echo "${RED}FAIL${NC} $*"; fail=$((fail + 1)); }
caution() { echo "${YEL}WARN${NC} $*"; warn=$((warn + 1)); }

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  ok "Loaded $ENV_FILE"
else
  caution "No $ENV_FILE — checking process environment only"
fi

require() {
  local name="$1"
  local val="${!name:-}"
  if [[ -z "$val" ]]; then
    bad "$name is unset"
    return
  fi
  if echo "$val" | grep -qiE 'placeholder|changeme|your-key|example|0x000000000000000000000000000000000000000'; then
    bad "$name looks like a placeholder"
    return
  fi
  ok "$name set"
}

echo ""
echo "=== Required production secrets ==="
require BETTER_AUTH_SECRET
require ENCRYPTION_KEY
require RECEIPT_HMAC_SECRET
require TREASURY_BASE_ADDRESS
require USDC_DEPOSIT_ADDRESS
require FACILITATOR_PRIVATE_KEY
require VENICE_API_KEY
require POSTGRES_PASSWORD
require REDIS_PASSWORD

echo ""
echo "=== Mode / URLs ==="
if [[ "${FACILITATOR_MODE:-}" == "live" ]]; then
  ok "FACILITATOR_MODE=live"
else
  bad "FACILITATOR_MODE must be live in production (got: ${FACILITATOR_MODE:-unset})"
fi

for name in PUBLIC_APP_URL PUBLIC_API_URL BETTER_AUTH_URL PRIMARY_DOMAIN; do
  require "$name"
done

if [[ "${PUBLIC_APP_URL:-}" == *"localhost"* ]] || [[ "${PUBLIC_API_URL:-}" == *"localhost"* ]]; then
  bad "PUBLIC_* URLs must not be localhost in production"
fi

echo ""
echo "=== Optional card rail (Polar) ==="
if [[ -n "${POLAR_ACCESS_TOKEN:-}" ]]; then
  ok "POLAR_ACCESS_TOKEN set — checking companions"
  require POLAR_WEBHOOK_SECRET
  require POLAR_HOBBY_PRODUCT_ID
  require POLAR_BUILDER_PRODUCT_ID
  require POLAR_SCALE_PRODUCT_ID
  if [[ "${POLAR_SERVER:-production}" == "sandbox" ]]; then
    bad "POLAR_SERVER=sandbox is not allowed for production earn path"
  fi
else
  caution "POLAR_ACCESS_TOKEN unset — card rail disabled (USDC/x402 only)"
fi

echo ""
echo "=== DNS smoke (public) ==="
for host in oma-ai.com api.oma-ai.com; do
  if dig +short "$host" A | grep -qE '^[0-9]+\.'; then
    ok "$host resolves: $(dig +short "$host" A | tr '\n' ' ')"
  else
    bad "$host has no A record — set Spaceship DNS to your Coolify VPS"
  fi
done

echo ""
if [[ "$fail" -gt 0 ]]; then
  echo "${RED}Launch preflight failed ($fail errors, $warn warnings).${NC}"
  exit 1
fi
echo "${GRN}Launch preflight passed ($warn warnings).${NC}"
