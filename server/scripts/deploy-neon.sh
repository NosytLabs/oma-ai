#!/usr/bin/env bash
# Code-only production release. Preserve remote secrets and scheduled triggers.
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${NEON_API_KEY:?Export NEON_API_KEY before deploying}"
exec npx --yes neon@6.2.3 functions deploy omaapi \
  --src server/src/index.ts \
  --project-id "${NEON_PROJECT_ID:-empty-bar-94645349}" \
  --branch "${NEON_BRANCH_ID:-br-sweet-rain-b40o54xa}" --wait
