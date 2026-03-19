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
declare -a SMOKE_TASK_IDS=()
declare -a SMOKE_ENTITY_IDS=()
declare -a SMOKE_MEMORY_CARD_IDS=()
declare -a SMOKE_MEMORY_USER_IDS=()
declare -a SMOKE_TRIGGER_IDS=()
declare -a SMOKE_RUN_IDS=()

log_pass() { PASS=$((PASS + 1)); echo "PASS: $1"; }
log_fail() { FAIL=$((FAIL + 1)); echo "FAIL: $1"; }
log_skip() { SKIP=$((SKIP + 1)); echo "SKIP: $1"; }

sql_literal() {
  local raw="$1"
  printf "'%s'" "$(printf "%s" "$raw" | sed "s/'/''/g")"
}

cleanup_smoke_entities() {
  local task_id ent_id mem_id mem_user task_id_sql ent_id_sql mem_id_sql mem_user_sql
  for task_id in "${SMOKE_TASK_IDS[@]}"; do
    task_id_sql="$(sql_literal "$task_id")"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
      delete from actions_log where entity_id = ${task_id_sql};
      delete from tasks where id = ${task_id_sql};
    " >/dev/null 2>&1 || true
  done

  for ent_id in "${SMOKE_ENTITY_IDS[@]}"; do
    ent_id_sql="$(sql_literal "$ent_id")"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
      delete from actions_log where entity_id = ${ent_id_sql};
      delete from approval_requests where entity_id = ${ent_id_sql};
    " >/dev/null 2>&1 || true
  done

  for mem_id in "${SMOKE_MEMORY_CARD_IDS[@]}"; do
    mem_id_sql="$(sql_literal "$mem_id")"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
      delete from actions_log where entity_type = 'memory_card' and entity_id = ${mem_id_sql};
      delete from memory_cards where id::text = ${mem_id_sql};
    " >/dev/null 2>&1 || true
  done

  for mem_user in "${SMOKE_MEMORY_USER_IDS[@]}"; do
    mem_user_sql="$(sql_literal "$mem_user")"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
      delete from memory_cards where user_id = ${mem_user_sql};
    " >/dev/null 2>&1 || true
  done

  for run_id in "${SMOKE_RUN_IDS[@]}"; do
    local run_id_sql="$(sql_literal "$run_id")"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
      delete from actions_log where entity_type = 'agent_run' and entity_id = ${run_id_sql};
      delete from agent_runs where id = ${run_id_sql} or retry_of_run_id = ${run_id_sql};
    " >/dev/null 2>&1 || true
  done

  for trig_id in "${SMOKE_TRIGGER_IDS[@]}"; do
    local trig_id_sql="$(sql_literal "$trig_id")"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
      delete from agent_runs where trigger_id = ${trig_id_sql};
      delete from actions_log where entity_type = 'agent_run' and payload::text like '%${trig_id}%';
      delete from processed_triggers where trigger_id = ${trig_id_sql};
    " >/dev/null 2>&1 || true
  done
}

trap cleanup_smoke_entities EXIT

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
    SMOKE_TASK_IDS+=("$created_task_id")
    log_pass "S2 create task (Guarded): task created"
  else
    log_fail "S2 create task (Guarded): create failed"
    TASK_ID=""
  fi
}

scenario_3_class_a_approval() {
  local ent_id resp
  ent_id="smoke_class_a_$(date +%s)"
  SMOKE_ENTITY_IDS+=("$ent_id")
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
  local task_id_sql
  if [ -z "$task_id" ]; then
    log_fail "S4 stalled watchdog: missing task id"
    return
  fi

  task_id_sql="$(sql_literal "$task_id")"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
    update tasks
    set status='in_progress',
        claimed_by='strategy',
        claimed_at=now() - interval '181 minutes'
    where id = ${task_id_sql};
  " >/dev/null
  ./scripts/stall_watchdog.sh >/dev/null

  if psql "$DB_URL" -At -c "
    select count(*)
    from actions_log
    where action_type='task_stalled_auto_blocked' and entity_id = ${task_id_sql};
  " | grep -q '^[1-9][0-9]*$'; then
    log_pass "S4 stalled watchdog: blocked + logged"
  else
    log_fail "S4 stalled watchdog: expected task_stalled_auto_blocked log"
  fi
}

scenario_5_retry_limit() {
  local task_id="$1"
  local task_id_sql
  if [ -z "$task_id" ]; then
    log_fail "S5 retry limit: missing task id"
    return
  fi

  task_id_sql="$(sql_literal "$task_id")"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
    update tasks
    set status='failed',
        retry_attempt=5
    where id = ${task_id_sql};
  " >/dev/null
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
  local ent_id_sql
  ent_id="smoke_forbidden_$(date +%s)"
  SMOKE_ENTITY_IDS+=("$ent_id")
  ent_id_sql="$(sql_literal "$ent_id")"
  resp="$(curl -sS -X POST "$API_BASE/approvals/request" \
    -H "Content-Type: application/json" \
    -d "{\"action_class\":\"financial_change\",\"entity_type\":\"task\",\"entity_id\":\"${ent_id}\",\"requested_by_role\":\"pmo\",\"reason\":\"smoke forbidden\"}")"

  if echo "$resp" | jq -e '.ok == false and .error.code == "forbidden"' >/dev/null; then
    if psql "$DB_URL" -At -c "
      select count(*)
      from actions_log
      where action_type='tool_access_denied' and entity_id = ${ent_id_sql};
    " | grep -q '^[1-9][0-9]*$'; then
      log_pass "S6 pmo forbidden finance command: 403 + actions_log"
    else
      log_fail "S6 pmo forbidden finance command: missing tool_access_denied log"
    fi
  else
    log_fail "S6 pmo forbidden finance command: expected forbidden"
  fi
}

scenario_7_memory_cards() {
  local now user_id topic content create_resp card_id read_resp maint_resp expired_user_id
  now="$(date +%s)"
  user_id="smoke_memory_user_${now}"
  topic="smoke_memory_topic_${now}"
  content="Smoke memory card content ${now}"
  expired_user_id="smoke_memory_expired_${now}"
  SMOKE_MEMORY_USER_IDS+=("$user_id")
  SMOKE_MEMORY_USER_IDS+=("$expired_user_id")

  create_resp="$(curl -sS -X POST "$API_BASE/memory/cards" \
    -H "Content-Type: application/json" \
    -d "{\"agent_role\":\"orchestrator\",\"user_id\":\"${user_id}\",\"topic\":\"${topic}\",\"content\":\"${content}\"}")"
  if ! echo "$create_resp" | jq -e '.ok == true and (.data.id | tostring | length > 0)' >/dev/null; then
    log_fail "S7 memory cards: create failed"
    return
  fi

  card_id="$(echo "$create_resp" | jq -r '.data.id | tostring')"
  SMOKE_MEMORY_CARD_IDS+=("$card_id")

  read_resp="$(curl -sS "$API_BASE/memory/cards?actor_role=orchestrator&user_id=${user_id}&limit=20")"
  if ! echo "$read_resp" | jq -e --arg cid "$card_id" '.ok == true and (.data.items | map(.id|tostring) | index($cid) != null)' >/dev/null; then
    log_fail "S7 memory cards: created card not returned by read endpoint"
    return
  fi

  psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
    insert into memory_cards (agent_role,user_id,topic,content,is_sensitive,created_at,expires_at)
    values (
      'orchestrator',
      '${expired_user_id}',
      'smoke memory expired ${now}',
      'expired card for maintenance smoke',
      false,
      now() - interval '2 days',
      now() - interval '1 day'
    );
  " >/dev/null

  maint_resp="$(curl -sS -X POST "$API_BASE/memory/cards/maintenance" \
    -H "Content-Type: application/json" \
    -d '{"actor_role":"system_watchdog"}')"
  if ! echo "$maint_resp" | jq -e '.ok == true and (.data.expired_deleted | tonumber) >= 1' >/dev/null; then
    log_fail "S7 memory cards: maintenance did not report expired cleanup"
    return
  fi

  log_pass "S7 memory cards: create/read/maintenance"
}

scenario_8_critic_class_a_reason_required() {
  local ent_id ent_id_sql resp
  ent_id="smoke_critic_${RANDOM}_$(date +%s)"
  SMOKE_ENTITY_IDS+=("$ent_id")
  ent_id_sql="$(sql_literal "$ent_id")"

  resp="$(curl -sS -X POST "$API_BASE/approvals/request" \
    -H "Content-Type: application/json" \
    -d "{\"action_class\":\"financial_change\",\"entity_type\":\"task\",\"entity_id\":\"${ent_id}\",\"requested_by_role\":\"orchestrator\"}")"

  if echo "$resp" | jq -e '.ok == false and .error.code == "critic_policy_denied"' >/dev/null; then
    if psql "$DB_URL" -At -c "
      select count(*)
      from actions_log
      where action_type='critic_policy_denied' and entity_id = ${ent_id_sql};
    " | grep -q '^[1-9][0-9]*$'; then
      log_pass "S8 critic class-A reason: denied + actions_log"
    else
      log_fail "S8 critic class-A reason: missing critic_policy_denied log"
    fi
  else
    log_fail "S8 critic class-A reason: expected critic_policy_denied"
  fi
}

scenario_9_critic_check_contract() {
  local resp

  resp="$(curl -sS -X POST "$API_BASE/critic/check" \
    -H "Content-Type: application/json" \
    -d '{"actor_role":"orchestrator","action_key":"approvals.request.financial_change","entity_type":"task","entity_id":"smoke_critic_check","action_class":"financial_change"}')"
  if ! echo "$resp" | jq -e '.ok == true and .data.allow == false and .data.code == "critic_reason_required"' >/dev/null; then
    log_fail "S9 critic/check deny contract: expected allow=false + critic_reason_required"
    return
  fi

  resp="$(curl -sS -X POST "$API_BASE/critic/check" \
    -H "Content-Type: application/json" \
    -d '{"actor_role":"orchestrator","action_key":"tasks.write","entity_type":"task","entity_id":"new"}')"
  if echo "$resp" | jq -e '.ok == true and .data.allow == true' >/dev/null; then
    log_pass "S9 critic/check contract: deny+allow paths"
  else
    log_fail "S9 critic/check allow contract: expected allow=true for tasks.write"
  fi
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
scenario_8_critic_class_a_reason_required
scenario_9_critic_check_contract

echo "---"
echo "Summary: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

