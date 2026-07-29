#!/bin/bash
# Deploy self-hosted PixelRAG serve (Qwen3-VL-Embedding-2B + FAISS).
# Runs on port 30001 by default. Override with PIXELRAG_PORT env.
#
# Usage:
#   ./scripts/pixelrag-serve.sh                       # foreground
#   ./scripts/pixelrag-serve.sh --build-index /path   # build first
#
# Required:
#   - uv tool install "pixelrag[all]" --python 3.13
#   - HF_HOME=/Users/tyson/.cache/pixelrag-models
#   - Pre-built index at $PIXELRAG_INDEX_DIR
#
# Health: http://localhost:${PIXELRAG_PORT:-30001}/health

set -euo pipefail

PIXELRAG_PY="${PIXELRAG_PY:-/Users/tyson/.local/share/uv/tools/pixelrag/bin/python}"
PIXELRAG_PORT="${PIXELRAG_PORT:-30001}"
PIXELRAG_HOST="${PIXELRAG_HOST:-0.0.0.0}"
PIXELRAG_DEVICE="${PIXELRAG_DEVICE:-cpu}"  # cpu | cuda | mps
PIXELRAG_INDEX_DIR="${PIXELRAG_INDEX_DIR:-$HOME/data/pixelrag/index}"
PIXELRAG_TILES_DIR="${PIXELRAG_TILES_DIR:-$HOME/data/pixelrag/index}"
PIXELRAG_ARTICLES_JSON="${PIXELRAG_ARTICLES_JSON:-$HOME/data/pixelrag/index/articles.json}"
PIXELRAG_MODEL="${PIXELRAG_MODEL:-Qwen/Qwen3-VL-Embedding-2B}"
export HF_HOME="${HF_HOME:-$HOME/.cache/pixelrag-models}"

LOG_FILE="${PIXELRAG_LOG:-$HOME/data/pixelrag/serve.log}"

if [[ ! -x "$PIXELRAG_PY" ]]; then
  echo "❌ pixelrag python not found at $PIXELRAG_PY"
  echo "   install: uv tool install 'pixelrag[all]' --python 3.13"
  exit 1
fi

if [[ ! -d "$PIXELRAG_INDEX_DIR" ]]; then
  echo "❌ index dir not found: $PIXELRAG_INDEX_DIR"
  echo "   build one first: see scripts/pixelrag-index.sh or run with --build-index"
  exit 1
fi

# Build index if requested
if [[ "${1:-}" == "--build-index" ]]; then
  SOURCE_PATH="${2:?need source path}"
  echo "→ Building index from $SOURCE_PATH → $PIXELRAG_INDEX_DIR"
  exec "$PIXELRAG_PY" -m pixelrag_index.pipelines build \
    --source local \
    --source-path "$SOURCE_PATH" \
    --output "$PIXELRAG_INDEX_DIR" \
    --tiles-dir "$PIXELRAG_TILES_DIR"
fi

echo "→ Starting PixelRAG serve on $PIXELRAG_HOST:$PIXELRAG_PORT (device=$PIXELRAG_DEVICE)"
echo "  index:  $PIXELRAG_INDEX_DIR"
echo "  tiles:  $PIXELRAG_TILES_DIR"
echo "  model:  $PIXELRAG_MODEL"
echo "  log:    $LOG_FILE"

mkdir -p "$(dirname "$LOG_FILE")"

# Stop any prior serve
pkill -f "pixelrag_serve.api" 2>/dev/null || true
sleep 1

exec "$PIXELRAG_PY" -m pixelrag_serve.api \
  --index-dir "$PIXELRAG_INDEX_DIR" \
  --tiles-dir "$PIXELRAG_TILES_DIR" \
  --articles-json "$PIXELRAG_ARTICLES_JSON" \
  --model "$PIXELRAG_MODEL" \
  --device "$PIXELRAG_DEVICE" \
  --host "$PIXELRAG_HOST" \
  --port "$PIXELRAG_PORT" \
  2>&1 | tee -a "$LOG_FILE"
