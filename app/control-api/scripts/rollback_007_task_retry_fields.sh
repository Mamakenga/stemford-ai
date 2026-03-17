#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

DB_URL="${DATABASE_URL:-${RAILWAY_DATABASE_URL:-}}"
if [ -z "${DB_URL}" ]; then
  echo "ERROR: set DATABASE_URL or RAILWAY_DATABASE_URL"
  exit 1
fi

psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

DROP INDEX IF EXISTS idx_tasks_retry_queue;

ALTER TABLE tasks
  DROP COLUMN IF EXISTS retry_after,
  DROP COLUMN IF EXISTS retry_attempt;

DELETE FROM schema_migrations WHERE version='007_task_retry_fields.sql';

COMMIT;
SQL

echo "Rollback 007 completed."
