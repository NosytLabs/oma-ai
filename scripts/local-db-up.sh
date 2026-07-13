#!/usr/bin/env bash
# Start local Postgres 16 + Redis for OMA server development.
set -euo pipefail
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
DATA="${PGDATA:-/opt/homebrew/var/postgresql@16}"
if ! pg_isready -q 2>/dev/null; then
  pg_ctl -D "$DATA" -l /tmp/pg16-oma.log start
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
