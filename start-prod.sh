#!/usr/bin/env bash
# Shim — production launcher lives under scripts/ops/
exec "$(cd "$(dirname "$0")" && pwd)/scripts/ops/start-prod.sh" "$@"
