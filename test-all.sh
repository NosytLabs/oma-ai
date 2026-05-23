#!/usr/bin/env bash
# OMA AI Gateway - Test Runner
# Run all tests and checks

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "============================================"
echo "OMA AI Gateway - Full Test Suite"
echo "============================================"
echo ""

# Function to run tests
run_check() {
    local name=$1
    local dir=$2
    local cmd=$3

    echo -e "${CYAN}[CHECK]${NC} $name"
    echo "  Directory: $dir"
    echo "  Command: $cmd"

    if cd "$dir" && eval "$cmd"; then
        echo -e "  ${GREEN}[PASS]${NC}"
        cd - > /dev/null
        return 0
    else
        echo -e "  ${RED}[FAIL]${NC}"
        cd - > /dev/null
        return 1
    fi
}

FAILED=0

# Typecheck
run_check "TypeScript (Server)" "oma/server" "npm run typecheck" || FAILED=$((FAILED + 1))
run_check "TypeScript (App)" "oma/app" "npm run typecheck" || FAILED=$((FAILED + 1))

# Lint
run_check "Lint (Server)" "oma/server" "npm run lint" || FAILED=$((FAILED + 1))
run_check "Lint (App)" "oma/app" "npm run lint" || FAILED=$((FAILED + 1))

# Tests
run_check "Tests (Server)" "oma/server" "npm test" || FAILED=$((FAILED + 1))
run_check "Tests (App)" "oma/app" "npm test" || FAILED=$((FAILED + 1))

echo ""
echo "============================================"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}ALL CHECKS PASSED${NC}"
    echo "============================================"
    exit 0
else
    echo -e "${RED}$FAILED CHECK(S) FAILED${NC}"
    echo "============================================"
    exit 1
fi