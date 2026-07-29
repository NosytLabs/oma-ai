#!/bin/bash
# Build a PixelRAG index from a local corpus (PDFs, HTML, images, .md).
#
# Usage:
#   ./scripts/pixelrag-index.sh /path/to/corpus
#   ./scripts/pixelrag-index.sh /path/to/corpus ~/data/my-index
#
# The default output goes to $HOME/data/pixelrag/index (matching pixelrag-serve.sh).
# Override with the second arg.

set -euo pipefail

PIXELRAG_PY="${PIXELRAG_PY:-/Users/tyson/.local/share/uv/tools/pixelrag/bin/python}"
PIXELRAG_DEVICE="${PIXELRAG_DEVICE:-cpu}"
PIXELRAG_MODEL="${PIXELRAG_MODEL:-Qwen/Qwen3-VL-Embedding-2B}"
export HF_HOME="${HF_HOME:-$HOME/.cache/pixelrag-models}"

SOURCE_PATH="${1:?Usage: $0 <source_path> [output_dir]}"
OUTPUT_DIR="${2:-$HOME/data/pixelrag/index}"
TILES_DIR="$OUTPUT_DIR"

if [[ ! -d "$SOURCE_PATH" ]]; then
  echo "❌ source path not found: $SOURCE_PATH"
  exit 1
fi

if [[ ! -x "$PIXELRAG_PY" ]]; then
  echo "❌ pixelrag python not found at $PIXELRAG_PY"
  echo "   install: uv tool install 'pixelrag[all]' --python 3.13"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "→ Building index from $SOURCE_PATH"
echo "  output:   $OUTPUT_DIR"
echo "  tiles:    $TILES_DIR"
echo "  model:    $PIXELRAG_MODEL"
echo "  device:   $PIXELRAG_DEVICE"
echo "  HF cache: $HF_HOME"

exec "$PIXELRAG_PY" -m pixelrag_index.pipelines build \
  --source local \
  --source-path "$SOURCE_PATH" \
  --output "$OUTPUT_DIR" \
  --tiles-dir "$TILES_DIR" \
  --embed-model "$PIXELRAG_MODEL" \
  --embed-device "$PIXELRAG_DEVICE"
