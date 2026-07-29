#!/bin/bash
# Render a URL or PDF to screenshot tiles via pixelshot (self-hosted).
#
# Usage:
#   ./scripts/pixelshot.sh https://news.ycombinator.com
#   ./scripts/pixelshot.sh /path/to/file.pdf /tmp/my-tiles --quality 70

set -euo pipefail

OUTPUT_DIR="${2:-/tmp/pixelshot-$(date +%s)}"
QUALITY="${3:-85}"
TILE_HEIGHT="${4:-8192}"
VIEWPORT_WIDTH="${5:-875}"

mkdir -p "$OUTPUT_DIR"

echo "→ Rendering to $OUTPUT_DIR (quality=$QUALITY, tile_height=$TILE_HEIGHT)"

exec pixelshot \
  "$1" \
  -o "$OUTPUT_DIR" \
  --quality "$QUALITY" \
  --tile-height "$TILE_HEIGHT" \
  --viewport-width "$VIEWPORT_WIDTH"
