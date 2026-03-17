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
| Actions feed | GET | `/actions/feed?limit=&format=` |
| Create memory card | POST | `/memory/cards` |
| List memory cards | GET | `/memory/cards?actor_role=&user_id=&topic=` |
| Run memory maintenance | POST | `/memory/cards/maintenance` |
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

## Memory Cards (29.4.3)

Use memory cards for short-lived conversational context.

Read flow (example user asks: "что обсуждали вчера?"):
1. Resolve user id from chat metadata (for example `telegram:<sender_id>`).
2. Call:
```bash
curl -s "http://127.0.0.1:3210/memory/cards?actor_role=orchestrator&user_id=<user_id>&since_hours=24&limit=20"
```
3. Summarize returned items as short bullets (topic + key point + age).

Write flow (after important agreement/decision):
```bash
curl -s -X POST http://127.0.0.1:3210/memory/cards \
  -H "Content-Type: application/json" \
  -d '{"agent_role":"orchestrator","user_id":"<user_id>","topic":"...", "content":"...", "source_action_id":"<action_id_optional>"}'
```

Rules:
- Do not store secrets in plain text; if sensitive, set `is_sensitive=true`.
- Keep content compact (1-3 sentences).
- Use memory as context helper, not as source of truth for task status (source of truth is Control API tasks/goals/approvals).

## Language

Respond to Natalia in Russian. Format output as readable summaries, not raw JSON.
When listing tasks, use a table or bullet list with title, assignee, status, and due date.

## TaskSpecify-lite (29.4.1)

Use this flow for create-task intents like "создай задачу", "добавь задачу", "поставь задачу".

### Step 1: deterministic defaults first

Infer missing fields before asking questions.

Assignee mapping by keywords:

| Keyword group in user text | Assignee |
|---|---|
| бюджет, расход, оплата, платеж, выручка, финансы | `finance` |
| презентация, расписание, встреча, звонок, родители, урок, класс | `pmo` |
| позиционирование, оффер, бренд, гипотеза, рынок, стратегия | `strategy` |
| интеграция, доступ, инцидент, инфраструктура, контроль, синхронизация | `orchestrator` |

Conflict resolution (required):
- if multiple groups match, use the first matched group by table order (top to bottom).
- do not ask extra questions for tie-break only; keep deterministic behavior.
- example: "бюджет на презентацию" -> `finance` (finance group is above pmo).

If no group matches:
- set draft assignee = `pmo`
- mark `assignee_confidence = low`

Goal mapping by detected context:
- if text mentions "позиционирование" or "brief" -> `goal_a_positioning_brief`
- if text mentions "бренд", "ребрендинг", "rollout" -> `goal_b_brand_rollout`
- else default -> `stage_c_operations`

Due date default:
- if user did not provide deadline -> `due_at = null`

Priority default (local drafting only):
- if user did not provide priority -> `priority = normal`
- note: Control API `/tasks` has no priority field; do not send this value to API.

### Step 2: one clarifying question only if required

Ask exactly one closed question only when:
- title is unclear, or
- assignee confidence is low and wrong assignee is likely.

Use a short forced-choice form:
- `Это задача для PMO или Strategy?`
- `Подтверди исполнителя: PMO / Finance / Strategy / Orchestrator`

Do not ask open-ended "какой трекер/формат/контекст?" questions.

### Step 3: always confirm before POST

Before calling `POST /tasks`, always send a compact draft and ask for confirmation:

`Планирую создать задачу: "<title>", исполнитель: <assignee>, goal_id: <goal_id>, срок: <due_at|без срока>, приоритет: <priority>. Ок?`

Only after explicit confirmation (`ок`, `да`, `подтверждаю`) call:
```bash
curl -s -X POST http://127.0.0.1:3210/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"...","primary_goal_id":"...","assignee":"...","actor_role":"orchestrator"}'
```

If user declines, update one field and repeat confirmation.

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

### Intent C: "show activity log"

Trigger examples:
- "покажи лог"
- "что произошло"
- "лента событий"
- "последние действия"
- "actions feed"

Execution:
1. Run:
```bash
curl -s 'http://127.0.0.1:3210/actions/feed?limit=20&format=human'
```
2. Read `data.items[*].text` and return up to 20 lines as-is.

Response template:
- If empty: `Событий пока нет (0).`
- Else:
  - Header: `Последние события (N):`
  - Each item: `• <text>`

### Fast-path policy

1. For these three intents, do not load `references/api.md` unless API response shape is invalid.
2. For these three intents, do not switch to broad reasoning: execute API call, format, return.
3. If API returns `ok:false` or transport error, return short error and then fall back to standard skill flow.
