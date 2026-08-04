#!/usr/bin/env bash
# OMA AI Gateway · Production Launch Validation Script
# Performs environment audits, configuration checks, and dependency validation.

set -euo pipefail

# Visual terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BOLD}${CYAN}=====================================================${NC}"
echo -e "${BOLD}${CYAN}      OMA AI GATEWAY · LAUNCH READY VERIFIER         ${NC}"
echo -e "${BOLD}${CYAN}=====================================================${NC}"
echo -e "${BLUE}Starting checks...${NC}\n"

# 1. Check Node.js version
echo -e "${BOLD}1. System & Engine Audit${NC}"
NODE_VERSION=$(node -v | cut -d'v' -f2)
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d'.' -f1)

if [ "$NODE_MAJOR" -lt 20 ]; then
    echo -e "  [${RED}FAIL${NC}] Node.js version is v$NODE_VERSION. Version >= v20.x is required for Next.js 15."
    exit 1
else
    echo -e "  [${GREEN}PASS${NC}] Node.js: v$NODE_VERSION"
fi

# 2. Check build directories
if [ -d "app/node_modules" ] && [ -d "server/node_modules" ]; then
    echo -e "  [${GREEN}PASS${NC}] Dependencies are installed."
else
    echo -e "  [${YELLOW}WARN${NC}] Missing node_modules. Ensure 'npm install' is run."
fi
echo ""

# 3. Environment variables verification (Server)
echo -e "${BOLD}2. Server Environment Audit (.env)${NC}"
SERVER_ENV="server/.env"

if [ ! -f "$SERVER_ENV" ]; then
    echo -e "  [${RED}FAIL${NC}] Server environment file ($SERVER_ENV) does not exist."
    echo -e "         Copy server/.env.example to server/.env and fill in the values."
    exit 1
fi

# Load variables safely
get_env_val() {
    grep -E "^$1=" "$SERVER_ENV" | cut -d'=' -f2- | tr -d '\r' || echo ""
}

DB_URL=$(get_env_val "DATABASE_URL")
REDIS_URL=$(get_env_val "REDIS_URL")
VENICE_KEY=$(get_env_val "VENICE_API_KEY")
BETTER_AUTH_SECRET=$(get_env_val "BETTER_AUTH_SECRET")
ENCRYPT_KEY=$(get_env_val "ENCRYPTION_KEY")
FACILITATOR_MODE=$(get_env_val "FACILITATOR_MODE")
TREASURY_ADDR=$(get_env_val "TREASURY_BASE_ADDRESS")
CORS_ORIGIN=$(get_env_val "CORS_ORIGIN")
ENV_FILE_NODE_ENV=$(get_env_val "NODE_ENV")
EFFECTIVE_NODE_ENV=${NODE_ENV:-${ENV_FILE_NODE_ENV:-development}}

# Development/test envs intentionally use local placeholder secrets. Keep the
# verifier strict for deployable environments while making local audits useful.
STRICT_SECURITY=false
if [[ "$EFFECTIVE_NODE_ENV" == "production" || "$EFFECTIVE_NODE_ENV" == "staging" || "$EFFECTIVE_NODE_ENV" == "preview" ]]; then
    STRICT_SECURITY=true
fi

# DB Check
if [ -z "$DB_URL" ] || [[ "$DB_URL" == *"your_password_here"* ]]; then
    echo -e "  [${RED}FAIL${NC}] DATABASE_URL is empty or has placeholder values."
    exit 1
else
    echo -e "  [${GREEN}PASS${NC}] DATABASE_URL is configured."
fi

# Redis Check
if [ -z "$REDIS_URL" ] || [[ "$REDIS_URL" == *"your_redis_password"* ]]; then
    echo -e "  [${YELLOW}WARN${NC}] REDIS_URL is using placeholder. Rate limiter will use in-memory fallback."
else
    echo -e "  [${GREEN}PASS${NC}] REDIS_URL is configured."
fi

# Provider API Key Check
if [ -z "$VENICE_KEY" ] || [[ "$VENICE_KEY" == "sk-..." ]]; then
    echo -e "  [${RED}FAIL${NC}] VENICE_API_KEY is missing or is using placeholder."
    exit 1
else
    echo -e "  [${GREEN}PASS${NC}] VENICE_API_KEY is configured."
fi

# Security Secrets check
if [ ${#BETTER_AUTH_SECRET} -lt 64 ] || [[ "$BETTER_AUTH_SECRET" == *"dev-*"* ]]; then
    if [[ "$STRICT_SECURITY" == true ]]; then
        echo -e "  [${RED}FAIL${NC}] BETTER_AUTH_SECRET must be at least 64 characters and not a dev placeholder."
        exit 1
    fi
    echo -e "  [${YELLOW}WARN${NC}] BETTER_AUTH_SECRET is a development placeholder (NODE_ENV=${EFFECTIVE_NODE_ENV})."
else
    echo -e "  [${GREEN}PASS${NC}] BETTER_AUTH_SECRET meets security parameters."
fi

if [ ${#ENCRYPT_KEY} -lt 32 ] || [[ "$ENCRYPT_KEY" == *"your-32-char"* ]]; then
    if [[ "$STRICT_SECURITY" == true ]]; then
        echo -e "  [${RED}FAIL${NC}] ENCRYPTION_KEY must be at least 32 characters and not placeholder."
        exit 1
    fi
    echo -e "  [${YELLOW}WARN${NC}] ENCRYPTION_KEY is a development placeholder (NODE_ENV=${EFFECTIVE_NODE_ENV})."
else
    echo -e "  [${GREEN}PASS${NC}] ENCRYPTION_KEY meets security parameters."
fi

# Facilitator live check
if [ "$FACILITATOR_MODE" = "mock" ]; then
    echo -e "  [${YELLOW}WARN${NC}] FACILITATOR_MODE is 'mock'. Transactions are not settled on-chain."
    echo -e "         Flashing 'mock' will cause server startup failures in production NODE_ENV."
elif [ "$FACILITATOR_MODE" = "live" ]; then
    echo -e "  [${GREEN}PASS${NC}] FACILITATOR_MODE is set to 'live' (Production settlement mode)."
    if [ -z "$TREASURY_ADDR" ] || [[ "$TREASURY_ADDR" == "0x"*111* ]]; then
        echo -e "  [${RED}FAIL${NC}] FACILITATOR_MODE is live but TREASURY_BASE_ADDRESS is missing/placeholder."
        exit 1
    fi
else
    echo -e "  [${RED}FAIL${NC}] FACILITATOR_MODE value must be exactly 'mock' or 'live'."
    exit 1
fi

# CORS production check
if [[ "$CORS_ORIGIN" == "*" ]]; then
    echo -e "  [${RED}FAIL${NC}] CORS_ORIGIN is set to wildcard (*). Startup will fail in production mode."
    exit 1
else
    echo -e "  [${GREEN}PASS${NC}] CORS_ORIGIN allows safe scoped origins: $CORS_ORIGIN"
fi
echo ""

# 4. App env check
echo -e "${BOLD}3. App Environment Audit (.env.local)${NC}"
APP_ENV="app/.env.local"

if [ ! -f "$APP_ENV" ]; then
    echo -e "  [${YELLOW}WARN${NC}] App environment ($APP_ENV) not found. Falling back to dev defaults."
else
    APP_API_URL=$(grep -E "^NEXT_PUBLIC_API_URL=" "$APP_ENV" | cut -d'=' -f2- || echo "")
    if [ -z "$APP_API_URL" ]; then
        echo -e "  [${RED}FAIL${NC}] NEXT_PUBLIC_API_URL is missing from app configuration."
        exit 1
    else
        echo -e "  [${GREEN}PASS${NC}] NEXT_PUBLIC_API_URL is configured: $APP_API_URL"
    fi
fi
echo ""

# 5. Typecheck validation
echo -e "${BOLD}4. Compile & Build Integrity Audit${NC}"
echo -e "  Checking server TypeScript compilation..."
if cd server && npx tsc --noEmit >/dev/null; then
    echo -e "  [${GREEN}PASS${NC}] Server compiles flawlessly."
else
    echo -e "  [${RED}FAIL${NC}] Server compilation failed. Run 'npx tsc' inside server to debug."
    exit 1
fi
cd ..

echo -e "  Checking app TypeScript compilation..."
if cd app && npx tsc --noEmit >/dev/null; then
    echo -e "  [${GREEN}PASS${NC}] App compiles flawlessly."
else
    echo -e "  [${RED}FAIL${NC}] App compilation failed. Run 'npm run typecheck' inside app to debug."
    exit 1
fi
cd ..
echo ""

# 6. Success Banner
echo -e "${BOLD}${GREEN}=====================================================${NC}"
echo -e "${BOLD}${GREEN}      ALL PRODUCTION CHECKS COMPLETED SUCCESSFULLY   ${NC}"
echo -e "${BOLD}${GREEN}        OMA AI GATEWAY IS FULLY READY FOR LAUNCH     ${NC}"
echo -e "${BOLD}${GREEN}=====================================================${NC}"
