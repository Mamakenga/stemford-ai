---
name: stemford-data
description: >
  Manage Stemford school tasks, goals, approvals, org chart, and handoff validation
  via the local Control API. Use when: (1) creating, listing, or updating tasks,
  (2) checking goal ancestry or KPI targets, (3) requesting or deciding approvals,
  (4) viewing org structure or validating agent handoffs, (5) any question about
  "what tasks are open", "what needs approval", "who is assigned to what".
  Trigger phrases: "создай задачу", "покажи задачи", "что в работе", "кто отвечает",
  "одобри", "отклони", "какие цели", "оргструктура", "передача задачи".
---

# Stemford Data — Control API Skill

## API Base

Default: `http://127.0.0.1:3210`. Port comes from `CONTROL_API_PORT` in `/opt/stemford/run/.env` (fallback: 3210).
If connection refused, check: `grep CONTROL_API_PORT /opt/stemford/run/.env` and use that port.
No auth token needed (loopback only).

Use `curl -s` for GET, `curl -s -X POST -H "Content-Type: application/json" -d '{...}'` for POST.

Every response has the shape `{ ok: true/false, data: {...}, meta: {...} }`.
Always check `ok` field before presenting results.

## Quick Reference

| Action | Method | Endpoint |
|--------|--------|----------|
| List tasks | GET | `/tasks?status=&assignee=&goal_id=` |
| Create task | POST | `/tasks` |
| Claim task | POST | `/tasks/:id/claim` |
| Complete task | POST | `/tasks/:id/complete` |
| Block task | POST | `/tasks/:id/block` |
| Fail task | POST | `/tasks/:id/fail` |
| Reopen task | POST | `/tasks/:id/reopen` |
| Retry failed/blocked task | POST | `/tasks/:id/retry` |
| Goal ancestry | GET | `/goals/:id/ancestry` |
| Org chart | GET | `/org/chart` |
| Validate handoff | POST | `/handoff/validate` |
| Request approval | POST | `/approvals/request` |
| Pending approvals | GET | `/approvals/pending?approver_role=` |
| Decide approval | POST | `/approvals/decide` |
| Health check | GET | `/health` |
| DB ping | GET | `/db/ping` |

## Roles

Four agent roles exist: `orchestrator`, `strategy`, `finance`, `pmo`.
Always use `actor_role` from this set when creating/claiming/completing tasks.
If role/action is forbidden by runtime policy, API returns `403` with `error.code = "forbidden"`.

## Task Lifecycle

```
backlog → todo → in_progress → done
                 ↕              ↑
              blocked ──────────┘
                 ↓
              failed ─┬─ (reopen) → todo
                      └─ (retry)  → todo
```

## Approval Classes

`safe_read`, `internal_write`, `external_comm`, `financial_change`, `policy_change`.

Default approvers: `external_comm` → strategy, `financial_change` → finance, `policy_change` → orchestrator.

## POST Payloads (required fields)

**POST /tasks** — create task:
```json
{ "title": "...", "primary_goal_id": "...", "assignee": "strategy", "actor_role": "orchestrator", "due_at": "2026-03-20T18:00:00Z" }
```
`due_at` is optional. Known goal IDs: `mission_stemford`, `stage_a_repositioning`, `stage_b_rebranding`, `stage_c_operations`, `goal_a_positioning_brief`, `goal_b_brand_rollout`, `goal_c_ops_dashboard`.

**POST /tasks/:id/claim, /complete, /block, /fail, /reopen**:
```json
{ "actor_role": "strategy" }
```
`/complete` also accepts optional `"summary"`. `/block` and `/fail` accept optional `"reason"`.

**POST /handoff/validate**:
```json
{ "caller_role_id": "orchestrator", "callee_role_id": "finance" }
```

**POST /approvals/request**:
```json
{ "action_class": "financial_change", "entity_type": "task", "entity_id": "tg_123", "requested_by_role": "pmo", "reason": "..." }
```
`approver_role` optional (auto-selected by action_class). `reason` optional.

**POST /approvals/decide**:
```json
{ "approval_id": "apr_123_abc", "decision": "approved", "decided_by_role": "finance", "reason": "..." }
```
`decision`: `approved` or `rejected`. `reason` optional.

## Detailed API Docs

For full request/response schemas with curl examples, read [references/api.md](references/api.md).

## Language

Respond to Natalia in Russian. Format output as readable summaries, not raw JSON.
When listing tasks, use a table or bullet list with title, assignee, status, and due date.

## Fast-path Router (EC-1 MVP)

For two frequent read intents, use deterministic fast-path first. Do not ask clarifying questions unless data is missing.

### Intent A: "show open tasks"

Trigger examples:
- "покажи открытые задачи"
- "что в работе"
- "open tasks"
- "покажи задачи в работе"
- "какие задачи"
- "список задач"
- "задачи"

Execution:
1. Run:
```bash
curl -s 'http://127.0.0.1:3210/tasks'
```
2. From `data.tasks`, keep only statuses: `todo`, `in_progress`, `blocked`.
3. Sort by `due_at` (nulls last), then by `id`.

Response template:
- If empty: `Открытых задач нет (0).`
- Else:
  - Header: `Открытые задачи (N):`
  - Each item: `• <title> — <assignee> — status: <status> — срок: <due_at|—>`

### Intent B: "show pending approvals"

Trigger examples:
- "покажи pending approvals"
- "какие ждут одобрения"
- "что на одобрении"
- "pending approvals"

Execution:
1. If message mentions role (`strategy`, `finance`, `pmo`, `orchestrator`), call:
```bash
curl -s 'http://127.0.0.1:3210/approvals/pending?approver_role=<role>'
```
2. Otherwise call:
```bash
curl -s 'http://127.0.0.1:3210/approvals/pending'
```

Response template:
- If empty: `Ожидающих одобрений нет (0).`
- Else:
  - Header: `Ожидающие одобрения (N):`
  - Each item: `• <approval_id> — <action_class> — <entity_type>:<entity_id> — approver: <approver_role>`

### Fast-path policy

1. For these two intents, do not load `references/api.md` unless API response shape is invalid.
2. For these two intents, do not switch to broad reasoning: execute API call, format, return.
3. If API returns `ok:false` or transport error, return short error and then fall back to standard skill flow.
