#!/usr/bin/env bash
# Code-only release. Preserve the function environment and scheduled triggers.
# For intentional infrastructure/environment changes, follow docs/DEPLOYMENT.md.
set -euo pipefail

cd "$(dirname "$0")/../.."
# Uses the CLI's authenticated session or NEON_API_KEY.
exec npx --yes neon@6.2.3 functions deploy omaapi \
  --src server/src/index.ts \
  --project-id "${NEON_PROJECT_ID:-empty-bar-94645349}" \
  --branch "${NEON_BRANCH_ID:-br-sweet-rain-b40o54xa}" \
  --wait
