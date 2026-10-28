#!/bin/bash
# OMA AI Gateway - Quick Start Script
# Usage: ./scripts/dev/start-dev.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "🚀 Starting OMA AI Gateway..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check the database configuration used by local development.
check_env() {
    if [ -z "${DATABASE_URL:-}" ] && ! grep -q '^DATABASE_URL=' "$ROOT/server/.env" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Warning: DATABASE_URL not set${NC}"
        echo "   Please set it in server/.env"
    fi
}

# Start server
start_server() {
	if curl -fsS --max-time 2 http://localhost:3001/health >/dev/null 2>&1; then
		echo -e "${GREEN}▶ API server already healthy on port 3001; reusing it${NC}"
		SERVER_PID=""
		return
	fi
	if lsof -nP -iTCP:3001 -sTCP:LISTEN >/dev/null 2>&1; then
		echo -e "${YELLOW}⚠️  Port 3001 is occupied but /health is unavailable${NC}"
		echo "   Stop the existing process before retrying this launcher."
		exit 1
	fi
	echo -e "${GREEN}▶ Starting API server...${NC}"
	(cd "$ROOT/server" && npm run dev) &
	SERVER_PID=$!
	echo "   Server PID: $SERVER_PID"
}

# Start frontend
start_frontend() {
	if curl -fsS --max-time 2 http://localhost:3000/ >/dev/null 2>&1; then
		echo -e "${GREEN}▶ Frontend already responding on port 3000; reusing it${NC}"
		FRONTEND_PID=""
		return
	fi
	if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
		echo -e "${YELLOW}⚠️  Port 3000 is occupied but the frontend is not responding${NC}"
		echo "   Stop the existing process before retrying this launcher."
		exit 1
	fi
	echo -e "${GREEN}▶ Starting Frontend...${NC}"
	(cd "$ROOT/app" && npm run dev) &
	FRONTEND_PID=$!
	echo "   Frontend PID: $FRONTEND_PID"
}
# Note: this dev launcher shells into per-package `npm run dev` because
# the per-package scripts (`server/package.json#dev`, `app/package.json#dev`)
# are pinned to the right toolchain. pnpm workspaces would also work; the
# choice keeps the scripts portable across npm/pnpm.

# Main
echo ""
check_env
echo ""

# Create .env if not exists
if [ ! -f "server/.env" ]; then
    echo "Creating server/.env from example..."
    cp server/.env.example server/.env 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}Starting services...${NC}"
echo ""

start_server
sleep 2
start_frontend

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ OMA AI Gateway is running!"
echo ""
echo "   Frontend: http://localhost:3000"
echo "   API:      http://localhost:3001"
echo "   Health:   http://localhost:3001/health"
echo ""
echo "   Connect wallet → Sign message → Get API key → Build!"
echo ""
echo "   Press Ctrl+C to stop"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Wait for interrupt
trap "echo 'Stopping...' ; [ -n \"${SERVER_PID:-}\" ] && kill $SERVER_PID 2>/dev/null || true; [ -n \"${FRONTEND_PID:-}\" ] && kill $FRONTEND_PID 2>/dev/null || true; exit" INT TERM
wait
