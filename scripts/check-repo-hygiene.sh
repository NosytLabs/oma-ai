#!/usr/bin/env bash
# Check the Git index, including force-added ignored files.
set -euo pipefail
cd "$(dirname "$0")/.."

git ls-files -z | {
found=0
while IFS= read -r -d '' path; do
  if [[ "/$path/" =~ /(node_modules|\.next|dist|coverage|\.cache|\.vite|\.nyc_output|\.pnpm-store|\.turbo|\.vercel|\.playwright-mcp|test-results|playwright-report)/ ]] ||
     [[ "$path" =~ (\.log|\.tsbuildinfo|\.bak|\.backup|\.orig|\.swp|\.swo|~)$ ]] ||
     [[ "/$path" =~ /(\.eslintcache|\.DS_Store|Thumbs\.db)$ ]]; then
    if (( ! found )); then
      echo "Transient files must not be tracked:" >&2
    fi
    printf '  %s\n' "$path" >&2
    found=1
  fi
done

if (( found )); then
  exit 1
fi
echo "Repository hygiene: no tracked transient files."
}
