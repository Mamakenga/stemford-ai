#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

set -a
source /opt/stemford/run/.env
set +a

API_BASE="${CONTROL_API_BASE_URL:-http://127.0.0.1:${CONTROL_API_PORT:-3210}}"
DB_URL="${DATABASE_URL:-${RAILWAY_DATABASE_URL:-}}"

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required"
  exit 1
fi

if [ -z "${DB_URL}" ]; then
  echo "ERROR: DATABASE_URL or RAILWAY_DATABASE_URL is required"
  exit 1
fi

PASS=0
FAIL=0
SKIP=0
TASK_ID=""

log_pass() { PASS=$((PASS + 1)); echo "PASS: $1"; }
log_fail() { FAIL=$((FAIL + 1)); echo "FAIL: $1"; }
log_skip() { SKIP=$((SKIP + 1)); echo "SKIP: $1"; }

scenario_1_open_tasks() {
  local resp
  resp="$(curl -sS "$API_BASE/tasks")"
  if echo "$resp" | jq -e '.ok == true and (.data.tasks | type == "array")' >/dev/null; then
    log_pass "S1 show tasks (Fast): /tasks returns ok + array"
  else
    log_fail "S1 show tasks (Fast): invalid response"
  fi
}

create_smoke_task() {
  local now title resp
  now="$(date +%s)"
  title="smoke_29_4_5_${now}"
  resp="$(curl -sS -X POST "$API_BASE/tasks" \
    -H "Content-Type: application/json" \
    -d "{\"title\":\"${title}\",\"primary_goal_id\":\"goal_a_positioning_brief\",\"assignee\":\"strategy\",\"actor_role\":\"orchestrator\"}")"

  if ! echo "$resp" | jq -e '.ok == true and (.data.id | type == "string")' >/dev/null; then
    echo "$resp" >&2
    return 1
  fi

  echo "$resp" | jq -r '.data.id'
}

scenario_2_create_task() {
  local created_task_id
  if created_task_id="$(create_smoke_task)"; then
    TASK_ID="$created_task_id"
    log_pass "S2 create task (Guarded): task created"
  else
    log_fail "S2 create task (Guarded): create failed"
    TASK_ID=""
  fi
}

scenario_3_class_a_approval() {
  local ent_id resp
  ent_id="smoke_class_a_$(date +%s)"
  resp="$(curl -sS -X POST "$API_BASE/approvals/request" \
    -H "Content-Type: application/json" \
    -d "{\"action_class\":\"financial_change\",\"entity_type\":\"task\",\"entity_id\":\"${ent_id}\",\"requested_by_role\":\"orchestrator\",\"reason\":\"smoke class A\"}")"

  if echo "$resp" | jq -e '.ok == true and .data.status == "pending"' >/dev/null; then
    log_pass "S3 class A approval (Guarded): pending approval requested"
  else
    log_fail "S3 class A approval (Guarded): expected pending approval"
  fi
}

scenario_4_watchdog_stalled() {
  local task_id="$1"
  if [ -z "$task_id" ]; then
    log_fail "S4 stalled watchdog: missing task id"
    return
  fi

  psql "$DB_URL" -v ON_ERROR_STOP=1 -c "update tasks set status='in_progress', claimed_by='strategy', claimed_at=now() - interval '181 minutes' where id='${task_id}';" >/dev/null
  ./scripts/stall_watchdog.sh >/dev/null

  if psql "$DB_URL" -At -c "select count(*) from actions_log where action_type='task_stalled_auto_blocked' and entity_id='${task_id}';" | grep -q '^1\|^[2-9][0-9]*$'; then
    log_pass "S4 stalled watchdog: blocked + logged"
  else
    log_fail "S4 stalled watchdog: expected task_stalled_auto_blocked log"
  fi
}

scenario_5_retry_limit() {
  local task_id="$1"
  if [ -z "$task_id" ]; then
    log_fail "S5 retry limit: missing task id"
    return
  fi

  psql "$DB_URL" -v ON_ERROR_STOP=1 -c "update tasks set status='failed', retry_attempt=5 where id='${task_id}';" >/dev/null
  local resp
  resp="$(curl -sS -X POST "$API_BASE/tasks/${task_id}/retry" \
    -H "Content-Type: application/json" \
    -d '{"actor_role":"orchestrator","reason":"smoke retry limit"}')"

  if echo "$resp" | jq -e '.ok == false and .error.code == "retry_limit_exceeded"' >/dev/null; then
    log_pass "S5 retry limit: retry_limit_exceeded returned"
  else
    log_fail "S5 retry limit: expected retry_limit_exceeded"
  fi
}

scenario_6_pmo_forbidden_finance_command() {
  local ent_id resp
  ent_id="smoke_forbidden_$(date +%s)"
  resp="$(curl -sS -X POST "$API_BASE/approvals/request" \
    -H "Content-Type: application/json" \
    -d "{\"action_class\":\"financial_change\",\"entity_type\":\"task\",\"entity_id\":\"${ent_id}\",\"requested_by_role\":\"pmo\",\"reason\":\"smoke forbidden\"}")"

  if echo "$resp" | jq -e '.ok == false and .error.code == "forbidden"' >/dev/null; then
    if psql "$DB_URL" -At -c "select count(*) from actions_log where action_type='tool_access_denied' and entity_id='${ent_id}';" | grep -q '^1\|^[2-9][0-9]*$'; then
      log_pass "S6 pmo forbidden finance command: 403 + actions_log"
    else
      log_fail "S6 pmo forbidden finance command: missing tool_access_denied log"
    fi
  else
    log_fail "S6 pmo forbidden finance command: expected forbidden"
  fi
}

scenario_7_memory_cards() {
  log_skip "S7 memory cards: not implemented yet (planned in §29.4.3)"
}

echo "Running smoke scenarios against $API_BASE"
echo "---"

scenario_1_open_tasks
scenario_2_create_task
scenario_3_class_a_approval
scenario_4_watchdog_stalled "$TASK_ID"
scenario_5_retry_limit "$TASK_ID"
scenario_6_pmo_forbidden_finance_command
scenario_7_memory_cards

echo "---"
echo "Summary: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
