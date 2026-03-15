#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

DB_URL="${DATABASE_URL:-${RAILWAY_DATABASE_URL:-}}"
if [ -z "${DB_URL}" ]; then
  echo "ERROR: set DATABASE_URL or RAILWAY_DATABASE_URL"
  exit 1
fi

psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"

for f in migrations/*.sql; do
  [ -f "$f" ] || continue
  v="$(basename "$f")"

  applied="$(psql "$DB_URL" -Atqc "SELECT 1 FROM schema_migrations WHERE version='${v}' LIMIT 1;")"
  if [ "$applied" = "1" ]; then
    echo "Skipping $v (already applied)"
    continue
  fi

  echo "Applying $v"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations(version) VALUES ('${v}') ON CONFLICT DO NOTHING;"
done

echo "Migrations done."
