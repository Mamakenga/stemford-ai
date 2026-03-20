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
declare -a REL_TASK_IDS=()
declare -a REL_ENTITY_IDS=()
declare -a REL_APPROVAL_IDS=()
declare -a REL_MEMORY_CARD_IDS=()
declare -a REL_MEMORY_USERS=()
declare -a REL_TRIGGER_IDS=()
declare -a REL_RUN_IDS=()

log_pass() { PASS=$((PASS + 1)); echo "PASS: $1"; }
log_fail() { FAIL=$((FAIL + 1)); echo "FAIL: $1"; }
log_skip() { SKIP=$((SKIP + 1)); echo "SKIP: $1"; }

sql_literal() {
  local raw="$1"
  printf "'%s'" "$(printf "%s" "$raw" | sed "s/'/''/g")"
}

cleanup_rel_entities() {
  local task_id task_id_sql
  for task_id in "${REL_TASK_IDS[@]}"; do
    task_id_sql="$(sql_literal "$task_id")"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
      delete from actions_log where entity_id = ${task_id_sql};
      delete from tasks where id = ${task_id_sql};
    " >/dev/null 2>&1 || true
  done

  local ent_id ent_id_sql
  for ent_id in "${REL_ENTITY_IDS[@]}"; do
    ent_id_sql="$(sql_literal "$ent_id")"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
      delete from actions_log where entity_id = ${ent_id_sql};
      delete from approval_requests where entity_id = ${ent_id_sql};
    " >/dev/null 2>&1 || true
  done

  local approval_id approval_id_sql
  for approval_id in "${REL_APPROVAL_IDS[@]}"; do
    approval_id_sql="$(sql_literal "$approval_id")"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
      delete from actions_log where payload::text like '%${approval_id}%';
      delete from approval_requests where approval_id = ${approval_id_sql};
    " >/dev/null 2>&1 || true
  done

  local mem_id mem_id_sql
  for mem_id in "${REL_MEMORY_CARD_IDS[@]}"; do
    mem_id_sql="$(sql_literal "$mem_id")"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
      delete from actions_log where entity_type = 'memory_card' and entity_id = ${mem_id_sql};
      delete from memory_cards where id::text = ${mem_id_sql};
    " >/dev/null 2>&1 || true
  done

  local mem_user mem_user_sql
  for mem_user in "${REL_MEMORY_USERS[@]}"; do
    mem_user_sql="$(sql_literal "$mem_user")"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
      delete from memory_cards where user_id = ${mem_user_sql};
    " >/dev/null 2>&1 || true
  done

  local run_id run_id_sql
  for run_id in "${REL_RUN_IDS[@]}"; do
    run_id_sql="$(sql_literal "$run_id")"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
      delete from actions_log where entity_type = 'agent_run' and entity_id = ${run_id_sql};
      delete from agent_runs where id = ${run_id_sql} or retry_of_run_id = ${run_id_sql};
    " >/dev/null 2>&1 || true
  done

  local trig_id trig_id_sql
  for trig_id in "${REL_TRIGGER_IDS[@]}"; do
    trig_id_sql="$(sql_literal "$trig_id")"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
      delete from agent_runs where trigger_id = ${trig_id_sql};
      delete from actions_log where entity_type = 'agent_run' and payload::text like '%${trig_id}%';
      delete from processed_triggers where trigger_id = ${trig_id_sql};
    " >/dev/null 2>&1 || true
  done
}

trap cleanup_rel_entities EXIT

create_rel_task() {
  local now title resp
  now="$(date +%s)"
  title="rel_task_${now}"
  resp="$(curl -sS -X POST "$API_BASE/tasks" \
    -H "Content-Type: application/json" \
    -d "{\"title\":\"${title}\",\"primary_goal_id\":\"goal_a_positioning_brief\",\"assignee\":\"pmo\",\"actor_role\":\"orchestrator\"}")"
  echo "$resp" | jq -r '.data.id // empty'
}

scenario_r1_health_readiness_diagnostics() {
  local health readiness diagnostics
  health="$(curl -sS "$API_BASE/health")"
  readiness="$(curl -sS "$API_BASE/readiness")"
  diagnostics="$(curl -sS "$API_BASE/diagnostics")"

  if echo "$health" | jq -e '.ok == true and .data.service == "stemford-control-api"' >/dev/null &&
     echo "$readiness" | jq -e '.data.status == "ready"' >/dev/null &&
     echo "$diagnostics" | jq -e '.ok == true and (.data.queue.in_progress | type == "number") and (.data.queue.pending_approvals | type == "number")' >/dev/null; then
    log_pass "R1 health/readiness/diagnostics: core observability endpoints are healthy"
  else
    log_fail "R1 health/readiness/diagnostics: one or more endpoints returned unexpected payload"
  fi
}

scenario_r2_handoff_validate_contract() {
  local resp
  resp="$(curl -sS -X POST "$API_BASE/handoff/validate" \
    -H "Content-Type: application/json" \
    -d '{"caller_role_id":"strategy","callee_role_id":"finance"}')"

  if echo "$resp" | jq -e '.ok == true and (.data.allowed | type == "boolean")' >/dev/null; then
    log_pass "R2 handoff validate: contract returns deterministic allowed flag"
  else
    log_fail "R2 handoff validate: invalid response contract"
  fi
}

scenario_r3_approval_decision_flow() {
  local ent_id req_resp approval_id bad_decide ok_decide dup_decide
  ent_id="rel_approval_${RANDOM}_$(date +%s)"
  REL_ENTITY_IDS+=("$ent_id")

  req_resp="$(curl -sS -X POST "$API_BASE/approvals/request" \
    -H "Content-Type: application/json" \
    -d "{\"action_class\":\"financial_change\",\"entity_type\":\"task\",\"entity_id\":\"${ent_id}\",\"requested_by_role\":\"orchestrator\",\"reason\":\"reliability test reason\"}")"

  approval_id="$(echo "$req_resp" | jq -r '.data.approval_id // empty')"
  if [ -z "$approval_id" ]; then
    log_fail "R3 approvals: failed to create approval request"
    return
  fi
  REL_APPROVAL_IDS+=("$approval_id")

  bad_decide="$(curl -sS -X POST "$API_BASE/approvals/decide" \
    -H "Content-Type: application/json" \
    -d "{\"approval_id\":\"${approval_id}\",\"decision\":\"approved\",\"decided_by_role\":\"strategy\",\"reason\":\"wrong role\"}")"
  if ! echo "$bad_decide" | jq -e '.ok == false and (.error.code == "not_found_or_not_allowed" or .error.code == "critic_policy_denied")' >/dev/null; then
    log_fail "R3 approvals: wrong approver should be rejected (not_found_or_not_allowed or critic_policy_denied)"
    return
  fi

  ok_decide="$(curl -sS -X POST "$API_BASE/approvals/decide" \
    -H "Content-Type: application/json" \
    -d "{\"approval_id\":\"${approval_id}\",\"decision\":\"approved\",\"decided_by_role\":\"finance\",\"reason\":\"approved in reliability scenario\"}")"
  if ! echo "$ok_decide" | jq -e '.ok == true and .data.status == "approved"' >/dev/null; then
    log_fail "R3 approvals: correct approver could not approve pending request"
    return
  fi

  dup_decide="$(curl -sS -X POST "$API_BASE/approvals/decide" \
    -H "Content-Type: application/json" \
    -d "{\"approval_id\":\"${approval_id}\",\"decision\":\"rejected\",\"decided_by_role\":\"finance\",\"reason\":\"duplicate decision\"}")"
  if echo "$dup_decide" | jq -e '.ok == false and (.error.code == "not_found_or_not_allowed" or .error.code == "critic_policy_denied")' >/dev/null; then
    log_pass "R3 approvals decision flow: wrong approver blocked, correct approver accepted, duplicate blocked"
  else
    log_fail "R3 approvals decision flow: duplicate decision should not be allowed"
  fi
}

scenario_r4_task_retry_lock_and_reopen() {
  local task_id block_resp retry_resp claim_locked claim_ok complete_resp reopen_resp
  task_id="$(create_rel_task)"
  if [ -z "$task_id" ]; then
    log_fail "R4 task flow: failed to create task"
    return
  fi
  REL_TASK_IDS+=("$task_id")

  block_resp="$(curl -sS -X POST "$API_BASE/tasks/${task_id}/block" \
    -H "Content-Type: application/json" \
    -d '{"actor_role":"pmo","reason":"blocked for retry lock test"}')"
  if ! echo "$block_resp" | jq -e '.ok == true and .data.status == "blocked"' >/dev/null; then
    log_fail "R4 task flow: block transition failed"
    return
  fi

  retry_resp="$(curl -sS -X POST "$API_BASE/tasks/${task_id}/retry" \
    -H "Content-Type: application/json" \
    -d '{"actor_role":"pmo","reason":"queue retry","retry_after":"2099-01-01T00:00:00.000Z"}')"
  if ! echo "$retry_resp" | jq -e '.ok == true and .data.status == "todo" and (.data.retry_attempt | tonumber) >= 1' >/dev/null; then
    log_fail "R4 task flow: retry transition failed"
    return
  fi

  claim_locked="$(curl -sS -X POST "$API_BASE/tasks/${task_id}/claim" \
    -H "Content-Type: application/json" \
    -d '{"actor_role":"pmo"}')"
  if ! echo "$claim_locked" | jq -e '.ok == false and .error.code == "retry_not_ready"' >/dev/null; then
    log_fail "R4 task flow: claim before retry_after must be blocked"
    return
  fi

  psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
    update tasks set retry_after = now() - interval '1 minute' where id = '$(printf "%s" "$task_id" | sed "s/'/''/g")';
  " >/dev/null

  claim_ok="$(curl -sS -X POST "$API_BASE/tasks/${task_id}/claim" \
    -H "Content-Type: application/json" \
    -d '{"actor_role":"pmo"}')"
  if ! echo "$claim_ok" | jq -e '.ok == true and .data.status == "in_progress"' >/dev/null; then
    log_fail "R4 task flow: claim should pass after retry window"
    return
  fi

  complete_resp="$(curl -sS -X POST "$API_BASE/tasks/${task_id}/complete" \
    -H "Content-Type: application/json" \
    -d '{"actor_role":"pmo","summary":"task completed in reliability scenario"}')"
  if ! echo "$complete_resp" | jq -e '.ok == true and .data.status == "done"' >/dev/null; then
    log_fail "R4 task flow: complete transition failed"
    return
  fi

  reopen_resp="$(curl -sS -X POST "$API_BASE/tasks/${task_id}/reopen" \
    -H "Content-Type: application/json" \
    -d '{"actor_role":"pmo"}')"
  if echo "$reopen_resp" | jq -e '.ok == true and .data.status == "todo"' >/dev/null; then
    log_pass "R4 task flow: retry lock, claim, complete, reopen transitions are consistent"
  else
    log_fail "R4 task flow: reopen transition failed"
  fi
}

scenario_r5_memory_validation_guards() {
  local now user_id resp_sensitive_hint resp_sensitive_ttl
  now="$(date +%s)"
  user_id="rel_memory_user_${now}"
  REL_MEMORY_USERS+=("$user_id")

  resp_sensitive_hint="$(curl -sS -X POST "$API_BASE/memory/cards" \
    -H "Content-Type: application/json" \
    -d "{\"agent_role\":\"orchestrator\",\"user_id\":\"${user_id}\",\"topic\":\"sensitive guard\",\"content\":\"password=123456\",\"is_sensitive\":false}")"
  if ! echo "$resp_sensitive_hint" | jq -e '.ok == false and .error.code == "validation_error"' >/dev/null; then
    log_fail "R5 memory validation: sensitive markers must require is_sensitive=true"
    return
  fi

  resp_sensitive_ttl="$(curl -sS -X POST "$API_BASE/memory/cards" \
    -H "Content-Type: application/json" \
    -d "{\"agent_role\":\"orchestrator\",\"user_id\":\"${user_id}\",\"topic\":\"sensitive ttl\",\"content\":\"password=123456\",\"is_sensitive\":true,\"expires_at\":\"2099-01-01T00:00:00.000Z\"}")"
  if echo "$resp_sensitive_ttl" | jq -e '.ok == false and .error.code == "validation_error"' >/dev/null; then
    log_pass "R5 memory validation: sensitive content and ttl guards are enforced"
  else
    log_fail "R5 memory validation: sensitive ttl guard should reject oversized ttl"
  fi
}

scenario_r6_runtime_status_machine_contract() {
  local now trigger_id tr_resp run_id complete_before_start start_ok start_again complete_ok retry_after_success
  now="$(date +%s)"
  trigger_id="rel_runtime_${now}"
  REL_TRIGGER_IDS+=("$trigger_id")

  tr_resp="$(curl -sS -X POST "$API_BASE/runtime/trigger" \
    -H "Content-Type: application/json" \
    -d "{\"trigger_id\":\"${trigger_id}\",\"role\":\"strategy\",\"actor_role\":\"orchestrator\"}")"
  run_id="$(echo "$tr_resp" | jq -r '.data.run_id // empty')"
  if [ -z "$run_id" ]; then
    log_fail "R6 runtime status machine: failed to create run"
    return
  fi
  REL_RUN_IDS+=("$run_id")

  complete_before_start="$(curl -sS -X POST "$API_BASE/runtime/runs/${run_id}/complete" \
    -H "Content-Type: application/json" \
    -d '{"actor_role":"orchestrator","status":"success","result":{"ok":true}}')"
  if ! echo "$complete_before_start" | jq -e '.ok == false and .error.code == "invalid_status"' >/dev/null; then
    log_fail "R6 runtime status machine: complete before start should fail"
    return
  fi

  start_ok="$(curl -sS -X POST "$API_BASE/runtime/runs/${run_id}/start" \
    -H "Content-Type: application/json" \
    -d '{"actor_role":"orchestrator"}')"
  if ! echo "$start_ok" | jq -e '.ok == true and .data.status == "running"' >/dev/null; then
    log_fail "R6 runtime status machine: start from pending failed"
    return
  fi

  start_again="$(curl -sS -X POST "$API_BASE/runtime/runs/${run_id}/start" \
    -H "Content-Type: application/json" \
    -d '{"actor_role":"orchestrator"}')"
  if ! echo "$start_again" | jq -e '.ok == false and .error.code == "invalid_status"' >/dev/null; then
    log_fail "R6 runtime status machine: second start should fail"
    return
  fi

  complete_ok="$(curl -sS -X POST "$API_BASE/runtime/runs/${run_id}/complete" \
    -H "Content-Type: application/json" \
    -d '{"actor_role":"orchestrator","status":"success","result":{"ok":true}}')"
  if ! echo "$complete_ok" | jq -e '.ok == true and .data.status == "success"' >/dev/null; then
    log_fail "R6 runtime status machine: complete from running failed"
    return
  fi

  retry_after_success="$(curl -sS -X POST "$API_BASE/runtime/runs/${run_id}/retry" \
    -H "Content-Type: application/json" \
    -d '{"actor_role":"orchestrator","reason":"should fail"}')"
  if echo "$retry_after_success" | jq -e '.ok == false and .error.code == "invalid_status"' >/dev/null; then
    log_pass "R6 runtime status machine: invalid transitions are blocked"
  else
    log_fail "R6 runtime status machine: retry after success must be rejected"
  fi
}

scenario_r7_runtime_runs_filters_and_actions_feed() {
  local now trigger_id tr_resp run_id list_resp bad_feed feed_human feed_json
  now="$(date +%s)"
  trigger_id="rel_runtime_filter_${now}"
  REL_TRIGGER_IDS+=("$trigger_id")

  tr_resp="$(curl -sS -X POST "$API_BASE/runtime/trigger" \
    -H "Content-Type: application/json" \
    -d "{\"trigger_id\":\"${trigger_id}\",\"role\":\"finance\",\"actor_role\":\"orchestrator\"}")"
  run_id="$(echo "$tr_resp" | jq -r '.data.run_id // empty')"
  if [ -z "$run_id" ]; then
    log_fail "R7 runtime filters/actions feed: failed to create run"
    return
  fi
  REL_RUN_IDS+=("$run_id")

  list_resp="$(curl -sS "$API_BASE/runtime/runs?actor_role=orchestrator&trigger_id=${trigger_id}&limit=5")"
  if ! echo "$list_resp" | jq -e '.ok == true and (.data.runs | length) >= 1' >/dev/null; then
    log_fail "R7 runtime filters/actions feed: runtime/runs filter contract failed"
    return
  fi

  bad_feed="$(curl -sS "$API_BASE/actions/feed?format=bad")"
  if ! echo "$bad_feed" | jq -e '.ok == false and .error.code == "validation_error"' >/dev/null; then
    log_fail "R7 runtime filters/actions feed: invalid feed format should fail"
    return
  fi

  feed_human="$(curl -sS "$API_BASE/actions/feed?format=human&limit=5")"
  feed_json="$(curl -sS "$API_BASE/actions/feed?format=json&limit=5")"
  if echo "$feed_human" | jq -e '.ok == true and .data.format == "human" and (.data.items | type == "array")' >/dev/null &&
     echo "$feed_json" | jq -e '.ok == true and .data.format == "json" and (.data.items | type == "array")' >/dev/null; then
    log_pass "R7 runtime filters/actions feed: filter + feed contracts are stable"
  else
    log_fail "R7 runtime filters/actions feed: feed contract mismatch"
  fi
}

scenario_r8_claim_race_condition() {
  local task_id f1 f2 ok_count fail_count
  task_id="$(create_rel_task)"
  if [ -z "$task_id" ]; then
    log_fail "R8 claim race: failed to create task"
    return
  fi
  REL_TASK_IDS+=("$task_id")

  f1="$(mktemp)"
  f2="$(mktemp)"

  curl -sS -X POST "$API_BASE/tasks/${task_id}/claim" \
    -H "Content-Type: application/json" \
    -d '{"actor_role":"pmo"}' >"$f1" &
  local p1=$!

  curl -sS -X POST "$API_BASE/tasks/${task_id}/claim" \
    -H "Content-Type: application/json" \
    -d '{"actor_role":"pmo"}' >"$f2" &
  local p2=$!

  wait "$p1" || true
  wait "$p2" || true

  ok_count=0
  fail_count=0

  if jq -e '.ok == true and .data.status == "in_progress"' "$f1" >/dev/null 2>&1; then
    ok_count=$((ok_count + 1))
  else
    fail_count=$((fail_count + 1))
  fi
  if jq -e '.ok == true and .data.status == "in_progress"' "$f2" >/dev/null 2>&1; then
    ok_count=$((ok_count + 1))
  else
    fail_count=$((fail_count + 1))
  fi

  if [ "$ok_count" -eq 1 ] && [ "$fail_count" -eq 1 ]; then
    log_pass "R8 claim race: exactly one claimant wins task lock"
  else
    log_fail "R8 claim race: expected 1 winner and 1 reject, got ok=${ok_count} fail=${fail_count}"
  fi

  rm -f "$f1" "$f2"
}

echo "Running reliability scenarios against $API_BASE"
echo "---"

scenario_r1_health_readiness_diagnostics
scenario_r2_handoff_validate_contract
scenario_r3_approval_decision_flow
scenario_r4_task_retry_lock_and_reopen
scenario_r5_memory_validation_guards
scenario_r6_runtime_status_machine_contract
scenario_r7_runtime_runs_filters_and_actions_feed
scenario_r8_claim_race_condition

echo "---"
echo "Summary: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
