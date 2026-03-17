# AUDIT LOG REVIEW RITUAL

Purpose: make `actions_log` review repeatable, fast, and useful for decisions.

## Cadence

1. Weekly review: 30 minutes.
2. Monthly deep dive: 60 minutes, one agent at a time.
3. Exception-based review: immediate check after critical alerts.

## Access

Run from VPS:

```bash
cd /opt/stemford/app/control-api
set -a && source /opt/stemford/run/.env && set +a
```

`$RAILWAY_DATABASE_URL` must be available.

## Weekly review (30 min)

### Step 1. Volume by action type (last 7 days)

```bash
psql "$RAILWAY_DATABASE_URL" -c "
select action_type, count(*) as cnt
from actions_log
where created_at >= now() - interval '7 days'
group by action_type
order by cnt desc;"
```

### Step 2. Exceptions and failures (last 7 days)

```bash
psql "$RAILWAY_DATABASE_URL" -c "
select created_at, action_type, entity_type, entity_id, actor_role, left(payload::text, 200) as payload
from actions_log
where created_at >= now() - interval '7 days'
  and action_type in ('task_failed','retry_limit_exceeded','task_stalled_auto_blocked','approval_rejected')
order by created_at desc
limit 100;"
```

### Step 3. Top actors and unusual activity

```bash
psql "$RAILWAY_DATABASE_URL" -c "
select actor_role, count(*) as cnt
from actions_log
where created_at >= now() - interval '7 days'
group by actor_role
order by cnt desc;"
```

### Step 4. Duplicate idempotency signals

```bash
psql "$RAILWAY_DATABASE_URL" -c "
select idempotency_key, count(*) as cnt
from actions_log
where created_at >= now() - interval '7 days'
  and idempotency_key is not null
group by idempotency_key
having count(*) > 1
order by cnt desc;"
```

### Step 5. Open blockers snapshot

```bash
psql "$RAILWAY_DATABASE_URL" -c "
select id, title, status, status_reason, assignee
from tasks
where status in ('blocked','failed')
order by id;"
```

## Monthly deep dive (60 min)

Pick one agent role (for example `pmo`) and inspect full trace for last 30 days:

```bash
psql "$RAILWAY_DATABASE_URL" -c "
select created_at, action_type, entity_type, entity_id, run_id, idempotency_key, left(payload::text, 250) as payload
from actions_log
where created_at >= now() - interval '30 days'
  and actor_role = 'pmo'
order by created_at desc
limit 300;"
```

Then answer:
1. Where does this role create most value?
2. Which errors repeat and why?
3. Which guardrail should be tightened or relaxed?

## Exception-based review (immediate)

Trigger immediate review when any of these appears:
1. `task_failed`
2. `retry_limit_exceeded`
3. `task_stalled_auto_blocked`
4. Repeated approval rejections on the same entity

Minimum check:
1. Last 50 related events in `actions_log`
2. Current task/entity status
3. Decision: retry, block, escalate, or policy update

## Output format (store in HANDOFF or weekly note)

1. Findings (top 3 patterns)
2. Risks (top 3)
3. Actions (owner + due date)
4. Policy changes (if any)
