#!/usr/bin/env bash
# =============================================================================
# start-prod.sh — deploy OMA-AI on oldpc (or any Docker host)
# Usage:  ./start-prod.sh          # uses .env.prod if present, else .env
#         ./start-prod.sh down     # stop
#         ./start-prod.sh logs     # follow logs
# =============================================================================
set -euo pipefail
MallocStackLogging=0

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE="${OMA_ENV_FILE:-.env.prod}"

cd "$(dirname "$0")"

if [[ "${1:-}" == "down" ]]; then
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
  exit 0
fi

if [[ "${1:-}" == "logs" ]]; then
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f
  exit 0
fi

# 1. preflight — treasury must have funds for x402 to credit
if grep -q "FACILITATOR_MODE=live" "$ENV_FILE" 2>/dev/null; then
  echo "[preflight] FACILITATOR_MODE=live — ensure TREASURY_BASE_ADDRESS has USDC + ETH for gas."
  echo "           treasury: $(grep -E '^TREASURY_BASE_ADDRESS=' "$ENV_FILE" | cut -d= -f2)"
  echo "           verify at https://basescan.org/address/$(grep -E '^TREASURY_BASE_ADDRESS=' "$ENV_FILE" | cut -d= -f2)"
fi

# 2. ensure Docker is up
if ! docker info >/dev/null 2>&1; then
  echo "Docker not running. Start it: sudo systemctl start docker" >&2
  exit 1
fi

# 3. build + launch
echo "[deploy] building + starting OMA-AI (oldpc-tuned)..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

# 4. wait for healthy
echo "[deploy] waiting for services to be healthy..."
sleep 15
docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "[deploy] done. App on :3000, Server on :3001 (both behind Cloudflare Tunnel)."
echo "[deploy] check health:  curl -fsS http://localhost:3001/health"
