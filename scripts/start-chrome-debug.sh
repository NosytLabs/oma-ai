#!/usr/bin/env bash
# start-chrome-debug.sh — Start Chrome with remote debugging for browser-harness
#
# Usage:
#   ./scripts/start-chrome-debug.sh          # Start on port 9222
#   ./scripts/start-chrome-debug.sh 9333     # Start on custom port
#
# Then use browser-harness:
#   BU_CDP_URL=http://127.0.0.1:9222 browser-harness <<'PY'
#   new_tab("http://localhost:3000")
#   wait_for_load()
#   capture_screenshot("/tmp/screenshot.png")
#   PY
#
# Chrome 149 on macOS requires --use-gl=swiftshader to prevent GPU process crash.
# The headless mode (--headless=new) works with --disable-gpu --use-gl=swiftshader.

set -euo pipefail

PORT="${1:-9222}"
PROFILE="/tmp/chrome-bh"

# Kill stale Chrome on our port
lsof -ti ":$PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

# Clean up lock files from previous run
rm -f "$PROFILE/SingletonLock" "$PROFILE/SingletonSocket" 2>/dev/null || true

echo "Starting Chrome (port $PORT, profile $PROFILE)..."

nohup /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless=new \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE" \
  --no-first-run \
  --no-default-browser-check \
  --disable-extensions \
  --disable-sync \
  --disable-background-networking \
  --disable-gpu \
  --use-gl=swiftshader \
  --no-sandbox \
  --disable-dev-shm-usage \
  --hide-crash-restore-bubble \
  http://localhost:3000 \
  > /tmp/chrome-bh.log 2>&1 &

CHROME_PID=$!

# Wait for port to be ready
for i in $(seq 1 15); do
  if curl -s "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; then
    WS_URL=$(curl -s "http://127.0.0.1:$PORT/json/version" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['webSocketDebuggerUrl'])" 2>/dev/null || echo "unknown")
    echo "Chrome ready on port $PORT (PID $CHROME_PID)"
    echo "BU_CDP_URL=http://127.0.0.1:$PORT"
    echo "WS: $WS_URL"
    exit 0
  fi
  sleep 1
done

echo "ERROR: Chrome didn't become ready on port $PORT in 15s"
exit 1
