#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

DB_URL="${DATABASE_URL:-${RAILWAY_DATABASE_URL:-}}"
if [ -z "${DB_URL}" ]; then
  echo "ERROR: set DATABASE_URL or RAILWAY_DATABASE_URL"
  exit 1
fi

for f in migrations/*.sql; do
  [ -f "$f" ] || continue
  echo "Applying $f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo "Migrations done."
