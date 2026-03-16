#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

set -a
source /opt/stemford/run/.env
set +a

DB_URL="${DATABASE_URL:-${RAILWAY_DATABASE_URL:-}}"
THRESHOLD_MIN="${STALL_WATCHDOG_THRESHOLD_MIN:-120}"

if [ -z "${DB_URL}" ]; then
  echo "ERROR: set DATABASE_URL or RAILWAY_DATABASE_URL"
  exit 1
fi

psql "$DB_URL" -v ON_ERROR_STOP=1 -v threshold_min="$THRESHOLD_MIN" <<'SQL'
WITH stalled AS (
  UPDATE tasks
     SET status='blocked',
         status_reason=coalesce(status_reason, 'stalled watchdog auto-block')
   WHERE status='in_progress'
     AND claimed_at IS NOT NULL
     AND claimed_at < now() - (:'threshold_min'::text || ' minutes')::interval
   RETURNING id, primary_goal_id, assignee, claimed_at, status_reason
),
logged AS (
  INSERT INTO actions_log (action_id, action_type, entity_type, entity_id, actor_role, run_id, idempotency_key, payload)
  SELECT
    'act_' || extract(epoch from clock_timestamp())::bigint || '_' || substr(md5(random()::text),1,6),
    'task_stalled_auto_blocked',
    'task',
    s.id,
    'system_watchdog',
    NULL,
    NULL,
    jsonb_build_object(
      'reason', s.status_reason,
      'claimed_at', s.claimed_at,
      'threshold_min', :'threshold_min'::int,
      'goal_id', s.primary_goal_id,
      'assignee', s.assignee
    )
  FROM stalled s
)
SELECT count(*) AS blocked_count FROM stalled;
SQL
