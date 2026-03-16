# Stemford Control API — Full Reference

Base URL: `http://127.0.0.1:3210`

---

## GET /tasks

List tasks with optional filters.

Query params (all optional):
- `status` — one of: backlog, todo, in_progress, blocked, done, failed
- `assignee` — role_id (orchestrator, strategy, finance, pmo)
- `goal_id` — primary_goal_id

Example:
```bash
curl -s 'http://127.0.0.1:3210/tasks?status=in_progress'
```

Response: `{ ok: true, data: { count: N, tasks: [...] } }`

Task fields include:
- `id`, `title`, `primary_goal_id`, `status`, `assignee`, `due_at`
- `retry_attempt` (integer, starts from 0)
- `retry_after` (datetime or null)

---

## POST /tasks

Create a new task (status defaults to `todo`).

Body (all required except due_at):
```json
{
  "title": "Подготовить бриф позиционирования",
  "primary_goal_id": "goal_a_positioning_brief",
  "assignee": "strategy",
  "actor_role": "orchestrator",
  "due_at": "2026-03-20T18:00:00Z"
}
```

Example:
```bash
curl -s -X POST http://127.0.0.1:3210/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Подготовить бриф","primary_goal_id":"goal_a_positioning_brief","assignee":"strategy","actor_role":"orchestrator"}'
```

---

## POST /tasks/:id/claim

Take a task into work. Only works on tasks with status `todo` or `blocked`.

Body: `{ "actor_role": "strategy" }`

Sets status to `in_progress`, records `claimed_by` and `claimed_at`.

---

## POST /tasks/:id/complete

Mark task as done. Works on `in_progress`, `blocked`, or `todo`.

Body: `{ "actor_role": "strategy", "summary": "Бриф готов, отправлен на ревью" }`

`summary` is optional.

---

## POST /tasks/:id/block

Block a task. Works on `todo` or `in_progress`.

Body: `{ "actor_role": "pmo", "reason": "Ждём данные от финансиста" }`

---

## POST /tasks/:id/fail

Mark task as failed. Works on `todo`, `in_progress`, or `blocked`.

Body: `{ "actor_role": "finance", "reason": "Нет доступа к данным" }`

---

## POST /tasks/:id/reopen

Reopen a done/failed/blocked task back to `todo`.

Body: `{ "actor_role": "orchestrator" }`

---

## POST /tasks/:id/retry

Queue retry for a `failed` or `blocked` task and return it to `todo`.

Body:
```json
{
  "actor_role": "orchestrator",
  "reason": "Повтор после исправления входных данных",
  "retry_after": "2026-03-17T08:30:00Z"
}
```

`reason` and `retry_after` are optional.

Effects:
- increments `retry_attempt`
- sets `retry_after` (or null if omitted)
- resets `claimed_by`, `claimed_at`, `completed_at`
- writes `task_retry_queued` into `actions_log`

Example:
```bash
curl -s -X POST http://127.0.0.1:3210/tasks/tg_123456/retry \
  -H "Content-Type: application/json" \
  -d '{"actor_role":"orchestrator","reason":"Повтор после фикса","retry_after":"2026-03-17T08:30:00Z"}'
```

---

## GET /goals/:id/ancestry

Get the full parent chain for a goal (recursive up to 10 levels).

Example:
```bash
curl -s 'http://127.0.0.1:3210/goals/goal_a_positioning_brief/ancestry'
```

Response: `{ ok: true, data: { goal_id: "...", chain: [{ depth, id, parent_id, title, stage, status }, ...] } }`

Known goal IDs:
- `mission_stemford` — top-level mission
- `stage_a_repositioning`, `stage_b_rebranding`, `stage_c_operations`
- `goal_a_positioning_brief`, `goal_b_brand_rollout`, `goal_c_ops_dashboard`

---

## GET /org/chart

Returns all roles and reporting edges.

```bash
curl -s http://127.0.0.1:3210/org/chart
```

Response: `{ ok: true, data: { roles: [...], edges: [...] } }`

Roles: orchestrator, strategy, finance, pmo.
Edges: strategy/finance/pmo all report_to orchestrator.

---

## POST /handoff/validate

Check if one role can hand off work to another.

Body: `{ "caller_role_id": "orchestrator", "callee_role_id": "finance" }`

Response includes `allowed: true/false` and `reason`.

Rules: direct handoffs only through orchestrator. Finance↔strategy and pmo↔strategy are forbidden (must go via orchestrator).

---

## POST /approvals/request

Request approval for a sensitive action.

Body:
```json
{
  "action_class": "financial_change",
  "entity_type": "task",
  "entity_id": "tg_123456",
  "requested_by_role": "pmo",
  "approver_role": "finance",
  "reason": "Нужно утвердить бюджет на рекламу"
}
```

`approver_role` is optional — defaults by action_class:
- external_comm → strategy
- financial_change → finance
- policy_change → orchestrator

---

## GET /approvals/pending

List pending approvals, optionally filtered by approver.

```bash
curl -s 'http://127.0.0.1:3210/approvals/pending?approver_role=finance'
```

---

## POST /approvals/decide

Approve or reject a pending request.

Body:
```json
{
  "approval_id": "apr_123456_abc",
  "decision": "approved",
  "decided_by_role": "finance",
  "reason": "Бюджет в рамках лимита"
}
```

`decision`: `approved` or `rejected`.

---

## GET /health

Returns `{ ok: true, data: { service: "stemford-control-api", PORT: 3210 } }`.

## GET /db/ping

Returns `{ ok: true, data: { db: "up", ts: "..." } }` if database is reachable.
