#!/usr/bin/env bash
# Compatibility shim — preferred path: scripts/dev/start-dev.sh
exec "$(dirname "$0")/dev/start-dev.sh" "$@"
