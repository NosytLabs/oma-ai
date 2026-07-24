#!/usr/bin/env bash
# Start local Postgres 16 + Redis for OMA server development.
# Works on macOS (ARM + Intel via Homebrew) and Linux (system packages).
set -euo pipefail

# Detect Postgres bin path (Homebrew ARM, Homebrew Intel, or system PATH)
if command -v brew &>/dev/null; then
  PG_PREFIX="$(brew --prefix postgresql@16 2>/dev/null || brew --prefix postgresql 2>/dev/null || echo "")"
  if [ -n "$PG_PREFIX" ]; then
    export PATH="$PG_PREFIX/bin:$PATH"
  fi
fi

DATA="${PGDATA:-$(brew --prefix 2>/dev/null || echo /usr/local)/var/postgresql@16}"
LOG="${TMPDIR:-/tmp}/pg16-oma.log"
if ! pg_isready -q 2>/dev/null; then
  pg_ctl -D "$DATA" -l "$LOG" start
fi
pg_isready
psql -d postgres -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'oma') THEN
    CREATE ROLE oma LOGIN PASSWORD 'oma_dev_local' SUPERUSER;
  END IF;
END $$;
SQL
psql -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='oma'" | grep -q 1 || createdb -O oma oma
# Redis
redis-cli ping >/dev/null 2>&1 || brew services start redis
redis-cli ping
echo "DATABASE_URL=postgresql://oma:oma_dev_local@127.0.0.1:5432/oma"
echo "REDIS_URL=redis://127.0.0.1:6379"
