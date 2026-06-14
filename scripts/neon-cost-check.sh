#!/bin/bash
# =============================================================================
# Neon cost check — queries Neon API for current usage and projects monthly cost
# =============================================================================
# Usage:   ./scripts/neon-cost-check.sh [project_id]
# Default: raspy-cherry-93577802 (oma-ai-dev)
#
# Reads NEON_API_KEY from (in order):
#   1. ~/.hermes/.env
#   2. ~/.config/opencode/.env
#   3. macOS keychain (security find-generic-password -s neon-api-key)
#
# Pricing (Neon Launch, AWS US West 2, June 2026 — verify before use):
#   Storage: $0.125/GB-month
#   Compute: $0.04/CU-hour
#   Egress : first 5 GB/mo free, then $0.09/GB
#
# Exit codes:
#   0  success
#   1  NEON_API_KEY not found
#   2  API HTTP error
#   3  jq parse failure
# =============================================================================
set -euo pipefail

PROJECT_ID="${1:-raspy-cherry-93577802}"
NEON_API_KEY=""

# --- Resolve API key ---------------------------------------------------------
for envfile in ~/.hermes/.env ~/.config/opencode/.env ~/.config/opencode/.mcp-env; do
  if [ -f "$envfile" ]; then
    KEY=$(grep -E '^NEON_API_KEY=' "$envfile" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' || true)
    if [ -n "${KEY:-}" ]; then
      NEON_API_KEY="$KEY"
      break
    fi
  fi
done

if [ -z "$NEON_API_KEY" ] && command -v security >/dev/null 2>&1; then
  NEON_API_KEY=$(security find-generic-password -s "neon-api-key" -w 2>/dev/null || true)
fi

if [ -z "$NEON_API_KEY" ]; then
  echo "ERROR: NEON_API_KEY not found." >&2
  echo "  Set in ~/.hermes/.env (export NEON_API_KEY=...) or store in keychain:" >&2
  echo "  security add-generic-password -s neon-api-key -a \"\$USER\" -w '<key>'" >&2
  exit 1
fi

# --- Helpers -----------------------------------------------------------------
NEON_BASE="https://console.neon.tech/api/v2"
auth() { curl -sS -H "Authorization: Bearer $NEON_API_KEY" -H "Accept: application/json" "$@"; }
hr()   { printf '%s\n' "------------------------------------------------------------"; }
num()  { awk "BEGIN { printf \"%.4f\", $1 }"; }

# --- Header ------------------------------------------------------------------
hr
echo "Neon Cost Check — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Project:  $PROJECT_ID"
hr

# --- Project-level data (storage, periods, suspend setting) -----------------
PJ_JSON=$(auth "$NEON_BASE/projects/$PROJECT_ID")
if [ -z "$PJ_JSON" ] || ! echo "$PJ_JSON" | jq -e '.project' >/dev/null 2>&1; then
  echo "ERROR: failed to parse project response (HTTP error or invalid ID)" >&2
  exit 2
fi

NAME=$(echo      "$PJ_JSON" | jq -r '.project.name                          // "unknown"')
REGION=$(echo    "$PJ_JSON" | jq -r '.project.region_id                      // "unknown"')
SUSPEND=$(echo   "$PJ_JSON" | jq -r '.project.default_endpoint_settings.suspend_timeout_seconds // null')
STORAGE_BYTES=$(echo "$PJ_JSON" | jq -r '.project.synthetic_storage_size       // 0')
COMPUTE_SEC=$(echo  "$PJ_JSON" | jq -r '.project.compute_time_seconds          // 0')
ACTIVE_SEC=$(echo   "$PJ_JSON" | jq -r '.project.active_time_seconds           // 0')
XFER_BYTES=$(echo   "$PJ_JSON" | jq -r '.project.data_transfer_bytes           // 0')
WRITTEN_BYTES=$(echo "$PJ_JSON" | jq -r '.project.written_data_bytes           // 0')
PERIOD_START=$(echo "$PJ_JSON" | jq -r '.project.consumption_period_start      // "?"')
PERIOD_END=$(echo   "$PJ_JSON" | jq -r '.project.consumption_period_end        // "?"')

echo "Name:           $NAME"
echo "Region:         $REGION"
echo "Billing period: $PERIOD_START → $PERIOD_END"
hr

# --- Convert to human units + dollars ----------------------------------------
STORAGE_GB=$(num "$STORAGE_BYTES / 1073741824")
STORAGE_COST=$(num "$STORAGE_GB * 0.125")
COMPUTE_HRS=$(num "$COMPUTE_SEC / 3600")
COMPUTE_COST=$(num "$COMPUTE_HRS * 0.04")
ACTIVE_HRS=$(num  "$ACTIVE_SEC / 3600")
ACTIVE_COST=$(num "$ACTIVE_HRS * 0.04")
XFER_MB=$(num    "$XFER_BYTES / 1048576")
XFER_GB=$(num    "$XFER_MB / 1024")
# Egress: first 5 GB free, then $0.09/GB on Launch plan
# Use shell conditional (POSIX awk has no ternary)
if [ "$(awk "BEGIN { print ($XFER_GB > 5) ? 1 : 0 }")" = "1" ]; then
  XFER_OVER_GB=$(num "$XFER_GB - 5")
else
  XFER_OVER_GB="0"
fi
XFER_COST=$(num  "$XFER_OVER_GB * 0.09")
WRITTEN_MB=$(num "$WRITTEN_BYTES / 1048576")

printf "Storage:  %10.4f GB   = \$%-8s /mo   (Launch \$0.125/GB-month)\n"  "$STORAGE_GB"  "$STORAGE_COST"
printf "Compute:  %10.4f hrs  = \$%-8s /mo   (CPU time only)\n"            "$COMPUTE_HRS" "$COMPUTE_COST"
printf "Active:   %10.4f hrs  = \$%-8s /mo   (wall clock — what you pay if auto-suspend=0)\n" "$ACTIVE_HRS" "$ACTIVE_COST"
printf "Egress:   %10.2f MB   = \$%-8s /mo   (first 5 GB free)\n"          "$XFER_MB"    "$XFER_COST"
printf "Written:  %10.2f MB\n" "$WRITTEN_MB"
hr

# --- Two scenarios: "what we likely pay" vs "worst case (no auto-suspend)" --
TYPICAL=$(num  "$STORAGE_COST + $COMPUTE_COST + $XFER_COST")
WORST=$(num    "$STORAGE_COST + $ACTIVE_COST + $XFER_COST")
printf "TOTAL (typical, with auto-suspend):  \$%s /mo\n" "$TYPICAL"
printf "TOTAL (worst case, no auto-suspend):  \$%s /mo\n" "$WORST"
hr

# --- Auto-suspend health (the v5.3 G1 finding) -------------------------------
SUSPEND_LABEL="not configured"
SUSPEND_OK=false
if [ "$SUSPEND" = "null" ] || [ "$SUSPEND" = "" ]; then
  SUSPEND_LABEL="not configured"
elif [ "$SUSPEND" = "0" ]; then
  SUSPEND_LABEL="DISABLED (compute always on — cost bug)"
elif [ "$SUSPEND" -gt 0 ] 2>/dev/null; then
  SUSPEND_LABEL="${SUSPEND}s after idle"
  SUSPEND_OK=true
fi
echo "Auto-suspend:  $SUSPEND_LABEL"
if [ "$SUSPEND_OK" = false ]; then
  echo "  ⚠ Compute will bill 24/7. Set suspend_timeout_seconds > 0 (e.g. 60) to save ~62%."
  echo "  Fix: update project default_endpoint_settings via Neon console or API."
fi
hr

# --- Per-branch breakdown (separate /branches endpoint, project returns null) -
BR_JSON=$(auth "$NEON_BASE/projects/$PROJECT_ID/branches")
if [ -z "$BR_JSON" ] || ! echo "$BR_JSON" | jq -e '.branches' >/dev/null 2>&1; then
  echo "Per-branch: (unavailable — branches API returned no data)"
else
  BR_COUNT=$(echo "$BR_JSON" | jq -r '.branches | length // 0')
  echo "Per-branch ($BR_COUNT branch[es]):"
  echo "$BR_JSON" | jq -r '
    .branches[]? |
    "  " + (.name // "?") + " (" + (.id // "?") + ")" +
    "  state=" + (.current_state // "?") +
    "  compute=" + (((.compute_time_seconds // 0) / 3600) | tostring) + "h" +
    "  active="  + (((.active_time_seconds  // 0) / 3600) | tostring) + "h" +
    "  logical_size=" + ((.logical_size // 0) | tostring) + "B"
  '
fi
hr

# --- Threshold alert ---------------------------------------------------------
THRESHOLD=20
# Use shell-side comparison (POSIX awk has no ternary)
if [ "$(awk "BEGIN { print ($WORST > $THRESHOLD) ? 1 : 0 }")" = "1" ]; then
  echo "🚨 ALERT: worst-case monthly cost \$$WORST exceeds threshold \$$THRESHOLD"
  echo "   Likely cause: auto-suspend is broken or compute hours are abnormal."
  exit 0  # still success, but loud
fi

echo "OK: worst-case monthly cost \$$WORST under threshold \$$THRESHOLD"
exit 0
