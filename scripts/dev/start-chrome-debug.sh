#!/usr/bin/env bash
# start-chrome-debug.sh — Start Chrome with remote debugging for browser-harness
#
# Usage:
#   ./scripts/dev/start-chrome-debug.sh          # Start on port 9222
#   ./scripts/dev/start-chrome-debug.sh 9333     # Start on custom port
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
if [[ ! "$PORT" =~ ^[0-9]{1,5}$ ]] || (( 10#$PORT < 1 || 10#$PORT > 65535 )); then
  echo "ERROR: debugging port must be an integer from 1 to 65535." >&2
  exit 1
fi
PORT=$((10#$PORT))
PROFILE="${TMPDIR:-/tmp}/chrome-bh-$PORT"

# Detect Chrome binary (macOS, Linux, Windows/Git Bash)
if [ -n "${OMA_CHROME_BIN:-}" ]; then
  if [[ "$OMA_CHROME_BIN" != /* ]] || [ ! -f "$OMA_CHROME_BIN" ] || [ ! -x "$OMA_CHROME_BIN" ]; then
    echo "ERROR: OMA_CHROME_BIN must be an absolute executable file path." >&2
    exit 1
  fi
  CHROME="$OMA_CHROME_BIN"
elif [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
elif command -v google-chrome &>/dev/null; then
  CHROME="google-chrome"
elif command -v google-chrome-stable &>/dev/null; then
  CHROME="google-chrome-stable"
elif command -v chromium-browser &>/dev/null; then
  CHROME="chromium-browser"
elif command -v chromium &>/dev/null; then
  CHROME="chromium"
else
  echo "ERROR: Chrome/Chromium not found. Install Chrome or set PATH." >&2
  exit 1
fi

# Never terminate an existing listener: it may belong to an unrelated service.
if ! command -v lsof >/dev/null; then
  echo "ERROR: lsof is required to check whether port $PORT is in use." >&2
  exit 1
fi
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "ERROR: port $PORT is in use; stop its listener or choose another port." >&2
  exit 1
fi

echo "Starting Chrome (port $PORT, profile $PROFILE)..."

nohup "$CHROME" \
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
  > "${TMPDIR:-/tmp}/chrome-bh-$PORT.log" 2>&1 &

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
