#!/usr/bin/env bash
# Deploy the OMA-AI backend to Neon Functions safely.
#
# Follows the verified recipe in the neon-functions-deploy skill:
#   1. Move the DEV server/.env OUT of the package dir so the Neon CLI cannot
#      auto-load it and silently merge dev secrets over the prod env file.
#   2. Source the PRODUCTION env file so fnEnv() in neon.ts reads the real
#      values from process.env at deploy time.
#   3. Clear the esbuild bundler cache (a stale bundle survives deploys).
#   4. Deploy with --update-existing.
#   5. Restore the dev .env.
set -euo pipefail

cd "$(dirname "$0")/../.."  # repo root
PROJ="${NEON_PROJECT_ID:-empty-bar-94645349}"
PKG="server"
ENV_PROD="$PKG/.env.neon.prod"

echo ">> 1. Backing up dev .env so the CLI cannot auto-load it"
if [ -f "$PKG/.env" ]; then
  mv "$PKG/.env" "$PKG/.env.hold"
  echo "   moved $PKG/.env -> $PKG/.env.hold"
fi

restore() {
  if [ -f "$PKG/.env.hold" ]; then
    mv "$PKG/.env.hold" "$PKG/.env"
    echo ">> restored .env"
  fi
}
trap restore EXIT

echo ">> 2. Clearing esbuild bundler cache"
if [ -d "$PKG/node_modules/.cache" ]; then
  node -e "require('fs').rmSync(process.argv[1],{recursive:true,force:true})" "$PWD/$PKG/node_modules/.cache"
  echo "   cleared $PKG/node_modules/.cache"
else
  echo "   no cache dir"
fi

echo ">> 3. Exporting production env from $ENV_PROD"
# Build a shlex-quoted export script (a value may contain <, >, spaces).
# Split on the FIRST '=' only, so base64/query-string values keep their '='.
while IFS= read -r line; do
  [ -z "$line" ] && continue
  case "$line" in \#*) continue;; esac
  k="${line%%=*}"
  v="${line#*=}"
  [ -z "$k" ] && continue
  export "$k=$v"
done < <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_PROD")

echo "   NODE_ENV=$NODE_ENV  (must be production)"
echo ">> 4. Deploying (config plan + apply)"
cd "$PKG"
export NEON_API_KEY="${NEON_API_KEY:?NEON_API_KEY not set}"
set +e
OUT="$(timeout 300 npx neon deploy --project-id "$PROJ" --branch main --config neon.ts --update-existing 2>&1)"
RC=$?
set -e
echo "$OUT" | grep -v 'npm notice' | tail -40
if [ $RC -ne 0 ]; then
  echo "DEPLOY EXIT CODE: $RC"
fi

echo ">> done (dev .env restored by trap)"
exit $RC
