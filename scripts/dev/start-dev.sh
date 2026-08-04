#!/bin/bash
# OMA AI Gateway - Quick Start Script
# Usage: ./scripts/dev/start-dev.sh  (or ./scripts/start-dev.sh)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "🚀 Starting OMA AI Gateway..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for required environment variables
check_env() {
    if [ -z "${DATABASE_URL:-}" ]; then
        echo -e "${YELLOW}⚠️  Warning: DATABASE_URL not set${NC}"
        echo "   Please set it in server/.env"
    fi
    if [ -z "${VENICE_API_KEY:-}" ]; then
        echo -e "${YELLOW}⚠️  Warning: VENICE_API_KEY not set${NC}"
        echo "   Please set it in server/.env"
    fi
}

# Start server
start_server() {
    echo -e "${GREEN}▶ Starting API server...${NC}"
    (cd "$ROOT/server" && npm run dev) &
    SERVER_PID=$!
    echo "   Server PID: $SERVER_PID"
}

# Start frontend
start_frontend() {
    echo -e "${GREEN}▶ Starting Frontend...${NC}"
    (cd "$ROOT/app" && npm run dev) &
    FRONTEND_PID=$!
    echo "   Frontend PID: $FRONTEND_PID"
}

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
trap "echo 'Stopping...' ; kill $SERVER_PID $FRONTEND_PID 2>/dev/null ; exit" INT TERM
wait