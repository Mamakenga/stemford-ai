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

All requests go to `http://127.0.0.1:3210`. No auth token needed (loopback only).
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

## Detailed API Docs

For full request/response schemas with examples, read [references/api.md](references/api.md).

## Language

Respond to Natalia in Russian. Format output as readable summaries, not raw JSON.
When listing tasks, use a table or bullet list with title, assignee, status, and due date.
