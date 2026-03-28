# HANDOFF LOG

Single source of truth for every Executor/Reviewer cycle.

## Format

Each handoff entry uses this template:

```
## H-YYYY-MM-DD-NN
Role: Codex=Executor, Claude=Reviewer  (or vice versa)
Scope: <short description>
Commits: <sha list>
Changes: <what was changed>
Checks: <what was verified вЂ” tests, smoke, logs>
Open risks: <what remains risky or unverified>
Review ask: <specific focus for reviewer>
Verdict: <P1=N, P2=N вЂ” filled by Reviewer>
P1 items: <list, or "none">
P2 items: <list вЂ” goes to backlog>
```

## Rules

1. **Every commit** that is part of a handoff includes `Handoff: H-...` in the commit message.
2. **Merge gate**: merge to main only when the Verdict line reads `P1=0`.
3. **Deploy gate**: after merge, a separate entry in DEPLOY_LOG.md with sha, migrate, restart, smoke results.
4. **Reviewer** appends the Verdict block вЂ” does not modify Changes/Checks/Open risks.

---

## H-2026-03-17-01
Role: Codex=Executor, Claude=Reviewer
Scope: Retry flow + stall watchdog (steps A+B)
Commits: ebba862, 0fcfced, 3309edb, cfe53fd, 57a9004
Changes:
- POST /tasks/:id/retry вЂ” two-layer check, MAX_RETRY_ATTEMPTS from env, race condition guard
- POST /tasks/:id/claim вЂ” retry_after barrier (AND retry_after IS NULL OR retry_after <= now())
- Migration 007: retry_attempt + retry_after columns, wrapped in BEGIN/COMMIT
- Migration 008: system_watchdog role
- Rollback script for 007
- stall_watchdog.sh вЂ” atomic CTE (UPDATE tasks в†’ INSERT actions_log)
Checks: node --check OK, VPS smoke (health, db/ping, tasks list), migration applied
Open risks: rollback script not tested on prod data
Review ask: retry flow correctness, transaction safety
Verdict: P1=0, P2=1
P1 items: none
P2 items: retry_after barrier in /claim вЂ” was already implemented by Codex in 3309edb, confirmed during review

---

## H-2026-03-17-02
Role: Codex=Executor, Claude=Reviewer
Scope: GET /tasks fallback + systemd watchdog timer
Commits: 042df99, 73a60ca
Changes:
- GET /tasks: defensive fallback when retry_attempt/retry_after columns missing (pre-migration)
- systemd: stemford-stall-watchdog.service + .timer (replaces cron)
- OPEN_ISSUES.md: closed retry/watchdog items moved to done-block
Checks: node --check OK, VPS: timer active, service exits 0/SUCCESS
Open risks: none significant
Review ask: (a) fallback catches only retry columns? (b) cronв†’systemd transition correct?
Verdict: P1=0, P2=1
P1 items: none
P2 items: fallback condition was too broad (42703 catches any missing column) вЂ” narrowed to regex check on retry_attempt|retry_after

---

## H-2026-03-17-03
Role: Codex=Executor, Claude=Reviewer
Scope: Narrow GET /tasks fallback condition (P2 from H-02)
Commits: pending (server.js fix applied locally)
Changes:
- Fallback condition narrowed: `e.code === "42703" && /retry_attempt|retry_after/i.test(msg)`
Checks: code review вЂ” logic confirmed correct
Open risks: none
Review ask: confirm narrowed condition is sufficient
Verdict: P1=0, P2=0
P1 items: none
P2 items: none

---

## H-2026-03-17-04
Role: Codex=Executor, Claude=Reviewer
Scope: OI-6 вЂ” formalize Role Definition (6 fields) in agent SOUL files
Commits: 87d3d3d
Changes:
- Added explicit `Role Definition (6 РїРѕР»РµР№)` blocks to all role profiles:
  - `agents/orchestrator/SOUL.md`
  - `agents/pmo/SOUL.md`
  - `agents/finance-kpi/SOUL.md`
  - `agents/strategy-gatekeeper/SOUL.md`
- Each block now defines: Title, Duties, Authority, Boundaries, Standards, Reporting.
Checks:
- Presence check by grep: all 4 files contain `Role Definition (6 РїРѕР»РµР№)` section.
Open risks:
- Approval Gates progressive weakening (Weeks 1-4 / Month 2-6 / Month 6+) is not yet formalized as a separate policy artifact.
Review ask:
- Verify that Duties/Authority/Boundaries are specific enough and non-overlapping across the 4 roles.
Verdict: P1=0, P2=1
P1 items: none
P2 items: clarify Finance escalation path to Human Owner (direct or via Orchestrator?) вЂ” follow-up

---

## H-2026-03-17-05
Role: Codex=Executor, Claude=Reviewer
Scope: OI-7 - formalize actions_log review ritual (weekly/monthly/exception)
Commits: bc80c1c
Changes:
- Added `docs/review/AUDIT_LOG_REVIEW_RITUAL.md` with:
  - weekly 30-min review flow;
  - monthly deep dive flow per agent;
  - exception-based immediate review triggers;
  - ready-to-run SQL commands for actions_log and tasks.
- Updated `OPEN_ISSUES.md`:
  - moved OI-6/OI-7 to done context;
  - marked Headcount Zero P2 backlog as no open items.
Checks:
- File presence check for `docs/review/AUDIT_LOG_REVIEW_RITUAL.md`.
- Manual content check: cadence + commands + output format present.
Open risks:
- First weekly run by operations team is not yet executed (process defined, first execution pending).
Review ask:
- Confirm that ritual scope is sufficient for Stage 5 observability and that exception triggers are correct.
Verdict: P1=0, P2=1
P1 items: none
P2 items: retry_limit_exceeded was missing from writeAction in server.js (audit ritual expected it but it was never emitted) вЂ” fixed in H-06

---

## H-2026-03-17-06
Role: Codex=Executor, Claude=Reviewer
Scope: Follow-up to Claude P2: log retry_limit_exceeded in actions_log
Commits: a4ab705, 236fdfe
Changes:
- Updated `POST /tasks/:id/retry` in `app/control-api/server.js`.
- When retry limit is hit, API now writes:
  - `action_type = retry_limit_exceeded`
  - payload with `retry_attempt`, `max_retry_attempts`, `reason`, `retry_after`
  before returning HTTP 409.
Checks:
- `node --check app/control-api/server.js` passed.
- Verified watchdog action type remains `task_stalled_auto_blocked` in `scripts/stall_watchdog.sh`.
- VPS smoke passed:
  - API returns `retry_limit_exceeded` on capped retry attempt.
  - `actions_log` contains `action_type='retry_limit_exceeded'` with expected payload.
Open risks:
- none
Review ask:
- Confirm this closes the P2 mismatch between audit ritual filters and emitted action types.
Verdict: P1=0, P2=0
P1 items: none
P2 items: none вЂ” mismatch fully closed

---

## H-2026-03-17-07
Role: Codex=Executor, Claude=Reviewer
Scope: Follow-up to Claude P2 from H-04: clarify Finance escalation path
Commits: 1e55010
Changes:
- Updated `agents/finance-kpi/SOUL.md` Role Definition line 6:
  - from `escalates_to = Human Owner`
  - to `escalates_via = Orchestrator -> Human Owner`
Checks:
- Text check in file confirms escalation path is explicit and consistent with orchestration model.
Open risks:
- none
Review ask:
- Confirm that this closes the remaining H-04 P2 item (Finance escalation path ambiguity).
Verdict: P1=0, P2=0
P1 items: none
P2 items: none вЂ” H-04 P2 fully closed

---

## H-2026-03-17-08
Role: Codex=Executor, Claude=Reviewer
Scope: EC-1 MVP вЂ” fast-path router for frequent Telegram read intents in stemford-data skill
Commits: 994a742
Changes:
- Updated `skills/stemford-data/SKILL.md` with explicit deterministic fast-path section.
- Added intent matcher rules for:
  - `РїРѕРєР°Р¶Рё РѕС‚РєСЂС‹С‚С‹Рµ Р·Р°РґР°С‡Рё` / `С‡С‚Рѕ РІ СЂР°Р±РѕС‚Рµ` / `open tasks`
  - `РїРѕРєР°Р¶Рё pending approvals` / `С‡С‚Рѕ РЅР° РѕРґРѕР±СЂРµРЅРёРё` / `pending approvals`
- Added exact execution flow and response templates:
  - `/tasks` -> filter `todo|in_progress|blocked`
  - `/approvals/pending` with optional `approver_role`
- Added fast-path policy:
  - no extra clarifications,
  - no loading of full reference docs unless response shape is invalid,
  - fallback to standard flow on API error.
Checks:
- Manual validation of SKILL.md structure and trigger phrasing.
- API endpoints and fields matched against `app/control-api/server.js`.
Open risks:
- This is skill-level routing (instructional). Runtime latency improvement depends on model/tool execution behavior and requires smoke in live Telegram.
Review ask:
- Confirm trigger set and response templates are sufficient for EC-1 DoD before runtime smoke.
Verdict: P1=0, P2=1
P1 items: none
P2 items: P2-a вЂ” expand Intent A triggers: add В«РєР°РєРёРµ Р·Р°РґР°С‡РёВ», В«СЃРїРёСЃРѕРє Р·Р°РґР°С‡В», В«Р·Р°РґР°С‡РёВ» (bare form) to increase fast-path hit rate toward >40% DoD target

---

## H-2026-03-17-09
Role: Codex=Executor, Claude=Reviewer
Scope: Follow-up to H-08 P2-a - expand Intent A fast-path trigger set
Commits: 24553d7
Changes:
- Updated `skills/stemford-data/SKILL.md` Intent A trigger examples.
- Added three short high-frequency forms:
  - `РєР°РєРёРµ Р·Р°РґР°С‡Рё`
  - `СЃРїРёСЃРѕРє Р·Р°РґР°С‡`
  - `Р·Р°РґР°С‡Рё`
Checks:
- Manual diff check confirms only trigger list was changed (no execution logic changes).
Open risks:
- Runtime latency improvement still needs live Telegram smoke measurement (EC-1 DoD).
Review ask:
- Confirm P2-a from H-08 is fully closed and trigger coverage is now sufficient for fast-path hit-rate target.
Verdict: P1=0, P2=0
P1 items: none
P2 items: none — H-08 P2-a fully closed, trigger set sufficient

---

## H-2026-03-17-10
Role: Codex=Executor, Claude=Reviewer
Scope: EC-1 smoke measurement (Telegram latency, 10-request sample)
Commits: pending
Changes:
- Ran latency measurement on latest OpenClaw session after sending 10 fast-path-target queries.
- Measured distribution:
  - count: 10
  - latencies: `[2,3,4,4,4,4,5,5,5,6]`
  - p50: `4s`
  - p95: `6s`
Checks:
- Session-based parsing with jq over `/home/stemford/.openclaw-stemford/agents/main/sessions/*.jsonl`.
- 10 user/assistant pairs were captured and matched.
Open risks:
- EC-1 strict DoD (`p95 < 2s`) is not met yet.
- Current fast-path is skill-level guidance; runtime still goes through model turn handling.
Review ask:
- Confirm classification: P1=0, P2=1 and approve next implementation step: runtime-level fast-path in Telegram bridge (bypass LLM path for read intents).
Verdict: P1=0, P2=1
P1 items: none
P2 items: P2-a — EC-1 DoD not met (p95=6s vs target <2s). Next step: runtime-level fast-path bypass in telegram_bridge (OI-8). Approved.

---

## H-2026-03-17-11
Role: Codex=Executor, Claude=Reviewer
Scope: EC-3 — runtime per-agent tool access enforcement in Control API
Commits: 131a34b
Changes:
- Added deterministic role/action whitelist in `app/control-api/server.js`.
- Added helper `requireToolAccess(...)` with:
  - feature flag `CONTROL_API_ENFORCE_TOOL_ACCESS` (default ON),
  - compatibility bypass for `human_telegram`,
  - deny path: `403 forbidden` + `actions_log` record `tool_access_denied`.
- Enforced checks on mutating routes:
  - `POST /tasks`
  - `POST /tasks/:id/claim`
  - `POST /tasks/:id/complete`
  - `POST /tasks/:id/block`
  - `POST /tasks/:id/fail`
  - `POST /tasks/:id/reopen`
  - `POST /tasks/:id/retry`
  - `POST /approvals/request` (by `requested_by_role` + `action_class`)
  - `POST /approvals/decide` (by `decided_by_role`)
- Updated skill docs:
  - `skills/stemford-data/SKILL.md` — added `403 forbidden` note.
  - `skills/stemford-data/references/api.md` — added EC-3 matrix + rollback flag.
Checks:
- `node --check app/control-api/server.js` passed.
- Manual diff review: only access control + docs touched.
Open risks:
- Requires live VPS smoke for DoD: forbidden command per role -> `403` + `tool_access_denied` in `actions_log`.
Review ask:
- Validate whitelist boundaries and confirm no regressions for current Telegram bridge flow (`human_telegram` bypass).
Verdict: P1=0, P2=0
P1 items: none
P2 items: none — VPS smoke confirms `403 forbidden` + `tool_access_denied` audit trail for forbidden PMO financial approval request

---

## H-2026-03-17-12
Role: Codex=Executor, Claude=Reviewer
Scope: EC-2 — webhook alerts from Control API to Telegram for critical events
Commits: 287486a
Changes:
- Added Telegram webhook alert pipeline in `app/control-api/server.js`.
- Implemented critical event set:
  - `task_failed`
  - `retry_limit_exceeded`
  - `approval_requested`
- Alert send is configured by env with safe fallbacks:
  - `CONTROL_API_TELEGRAM_WEBHOOK_ENABLED` (default ON)
  - `CONTROL_API_TELEGRAM_BOT_TOKEN` -> fallback `TELEGRAM_BOT_TOKEN`
  - `CONTROL_API_NOTIFY_CHAT_IDS` -> fallback `TELEGRAM_NOTIFY_CHAT_IDS` -> fallback `ALLOWED_CHAT_IDS`
- Alert formatting includes actionable approval commands:
  - `/approve <approval_id> --role=<approver>`
  - `/reject <approval_id> reason --role=<approver>`
- Updated API reference:
  - `skills/stemford-data/references/api.md` with EC-2 config + rollback notes.
Checks:
- `node --check app/control-api/server.js` passed.
- Manual code review: webhook is best-effort and cannot break API response path.
- VPS smoke (2026-03-17):
  - `POST /approvals/request` (internal_write with explicit approver) -> `ok:true`, `approval_id=apr_1773753929929_456k42`.
  - `POST /tasks/:id/retry` on capped retries -> `error.code=retry_limit_exceeded`.
  - `actions_log` query confirms all three EC-2 events:
    - `approval_requested` for `ec2_smoke_approval`
    - `task_failed` for `tg_1773753961713_lgs0rg`
    - `retry_limit_exceeded` for `tg_1773753961713_lgs0rg`
Open risks:
- Explicit Telegram receipt confirmation is not captured in this thread log (API + actions_log path is confirmed end-to-end).
Review ask:
- Validate EC-2 implementation and review for regressions/risk (notably: no response blocking, no impact on actions_log writes).
Verdict: P1=0, P2=1
P1 items: none
P2 items: add explicit Telegram API reject/HTTP error logging in `sendTelegramNotification` (closed in H-13)

---

## H-2026-03-17-13
Role: Codex=Executor, Claude=Reviewer
Scope: Follow-up to H-12 P2-a — log Telegram API-level delivery failures
Commits: 4455ee7
Changes:
- Updated `sendTelegramNotification` in `app/control-api/server.js`:
  - now parses Telegram JSON response;
  - treats both transport errors (`!response.ok`) and Telegram-level rejects (`payload.ok === false`) as failures;
  - logs per-chat failure reason (chat id + description).
- Kept best-effort behavior: webhook failures are logged only and never break API response.
Checks:
- `node --check app/control-api/server.js` passed.
- Manual review confirms no changes to action semantics or route contracts.
Open risks:
- Live Telegram negative-case smoke (invalid token/chat) not executed in production thread.
Review ask:
- Confirm that H-12 P2-a is fully closed and failure observability is now sufficient.
Verdict: P1=0, P2=0
P1 items: none
P2 items: none — H-12 P2-a fully closed, EC-2 complete

---

## H-2026-03-17-14
Role: Codex=Executor, Claude=Reviewer
Scope: EC-4 — add `/readiness` and `/diagnostics` runtime checks
Commits: e0a9bd1
Changes:
- Added `GET /readiness` in `app/control-api/server.js`:
  - checks DB connectivity (`select 1`);
  - reports skill file presence (`/opt/stemford/skills/stemford-data/SKILL.md`, overridable by env);
  - reports Telegram webhook config state.
- Added `GET /diagnostics` in `app/control-api/server.js`:
  - `in_progress`, `pending_approvals`, `stalled_count`, `stalled_threshold_min`;
  - webhook config summary;
  - process `uptime_sec`.
- Added EC-4 endpoint docs in `skills/stemford-data/references/api.md`.
Checks:
- `node --check app/control-api/server.js` passed.
- VPS smoke (2026-03-17):
  - `GET /readiness` -> `ok:true`, `status:"ready"`, DB up, skill present, webhook configured.
  - `GET /diagnostics` -> `ok:true`, queue counters returned (`in_progress`, `pending_approvals`, `stalled_count`, `stalled_threshold_min`) plus webhook summary and `uptime_sec`.
Open risks:
- Negative readiness path (`503 unhealthy` when DB is down) was not simulated in production thread.
Review ask:
- Validate endpoint contracts against §28.4.4 / EC-4 and confirm no regressions in existing API paths.
Verdict: P1=0, P2=0
P1 items: none
P2 items: none — EC-4 complete, contracts and smoke checks validated

---

## H-2026-03-17-15
Role: Codex=Executor, Claude=Reviewer
Scope: §29.4.1 TaskSpecify-lite MVP in `stemford-data` skill
Commits: 5f82c1c
Changes:
- Updated `skills/stemford-data/SKILL.md` with deterministic TaskSpecify-lite flow for create-task intents:
  - keyword-based assignee mapping,
  - goal_id defaults/mapping,
  - due date and priority defaults (priority local-only),
  - single closed clarifying question policy when required,
  - mandatory confirmation prompt before `POST /tasks`.
- Added explicit anti-pattern rule: avoid open-ended clarifying questions like "какой трекер?" for task creation.
Checks:
- Manual review: section is scoped to create-task intents and does not alter EC-1 fast-path read flows.
- Telegram smoke (2026-03-17):
  - First run after deploy failed behavior check (bot still asked multi-parameter questions).
  - Root cause: stale OpenClaw session context.
  - Mitigation: backed up and reset `/home/stemford/.openclaw-stemford/agents/main/sessions/*`, restarted `stemford-openclaw-runtime`.
  - Second run passed expected behavior:
    - input: `создай задачу: подготовить презентацию для родителей`
    - output: compact draft with inferred `assignee=PMO`, `goal_id=stage_c_operations`, confirmation `Ок?`.
Open risks:
- Latency remains high (~2 minutes in latest smoke) despite correct TaskSpecify-lite behavior.
Review ask:
- Validate TaskSpecify-lite behavior after session-reset mitigation and assess whether latency should be tracked as separate P2/OI item.
Verdict: P1=0, P2=1
P1 items: none
P2 items: add deterministic conflict-resolution rule for multi-match keyword cases (closed in H-16)

---

## H-2026-03-17-16
Role: Codex=Executor, Claude=Reviewer
Scope: Follow-up to H-15 P2-a — deterministic assignee conflict resolution
Commits: adcc467
Changes:
- Updated `skills/stemford-data/SKILL.md` TaskSpecify-lite section:
  - added explicit tie-break rule when multiple keyword groups match;
  - deterministic policy: first matched group by table order wins;
  - added example: "бюджет на презентацию" -> `finance`.
Checks:
- Manual review: conflict resolution is now explicit and deterministic; no effect on existing fast-path read intents.
- Telegram smoke (2026-03-17):
  - input: `создай задачу: согласовать бюджет на презентацию для родителей`
  - output draft: `исполнитель: Finance` (expected by tie-break rule).
Open risks:
- Runtime behavior still depends on skill adherence in model/session context.
Review ask:
- Confirm that H-15 P2-a is fully closed with the new deterministic tie-break rule.
Verdict: P1=0, P2=0
P1 items: none
P2 items: none — H-15 P2-a fully closed

---

## H-2026-03-17-17
Role: Codex=Executor, Claude=Reviewer
Scope: §29.4.5 Cookbook MVP — add smoke scenarios script
Commits: b57798f
Changes:
- Added `app/control-api/scripts/smoke_scenarios.sh`:
  - S1: `GET /tasks` shape check
  - S2: `POST /tasks` create check
  - S3: class-A `POST /approvals/request` -> `pending`
  - S4: stalled watchdog simulation -> `task_stalled_auto_blocked` log
  - S5: retry cap -> `retry_limit_exceeded`
  - S6: PMO forbidden financial request -> `403` + `tool_access_denied`
  - S7: memory cards scenario -> `SKIP` (feature not implemented)
- Updated `app/control-api/scripts/README.md` with smoke script usage and scenario list.
Checks:
- Manual script review: deterministic PASS/FAIL/SKIP summary, non-zero exit on failures.
- VPS smoke run (2026-03-17):
  - `bash ./scripts/smoke_scenarios.sh`
  - result: `PASS=6 FAIL=0 SKIP=1`
  - passed: S1..S6
  - skipped: S7 (memory cards not implemented yet)
Open risks:
- Script creates smoke entities in production DB (safe, but accumulates `smoke_*` records over time).
Review ask:
- Validate script safety/usability for post-deploy smoke and confirm scenario coverage vs §29.4.5.
Verdict: P1=0, P2=2
P1 items: none
P2 items:
- Parameterize SQL in smoke script (`where id='${task_id}'` style interpolation).
- Add cleanup section to avoid smoke-data accumulation in production DB.

---

## H-2026-03-17-18
Role: Codex=Executor, Claude=Reviewer
Scope: Follow-up to H-17 P2-a/P2-b — SQL parameterization + smoke cleanup
Commits: e90efca
Changes:
- Updated `app/control-api/scripts/smoke_scenarios.sh`:
  - replaced direct SQL interpolation with parameterized `psql -v ...` variables for task/entity IDs;
  - added `cleanup_smoke_entities()` and `trap ... EXIT` to remove created smoke data from:
    - `tasks`
    - `approval_requests`
    - `actions_log`
  - tracked created IDs in arrays (`SMOKE_TASK_IDS`, `SMOKE_ENTITY_IDS`) so cleanup is scoped to current run.
- Updated `app/control-api/scripts/README.md` to document automatic smoke cleanup.
Checks:
- Manual script review: no raw task/entity ID interpolation remains in SQL queries.
- Manual script review: cleanup is best-effort (`|| true`) and runs on normal exit and failures.
Open risks:
- Cleanup covers entities created by this script run; old historical `smoke_*` rows from earlier runs remain untouched.
Review ask:
- Confirm that H-17 P2-a/P2-b are fully closed and cleanup scope is acceptable.
Verdict: pending
P1 items: pending
P2 items: pending

---

## H-2026-03-17-19
Role: Codex=Executor, Claude=Reviewer
Scope: Follow-up to H-18 — fix `psql` variable syntax compatibility in smoke script
Commits: faa180b
Changes:
- Updated `app/control-api/scripts/smoke_scenarios.sh` to replace `:'var'` SQL placeholders (which failed on target VPS `psql`) with safe escaped SQL literals via `sql_literal()` helper.
- Kept cleanup behavior from H-18 and applied compatibility fix across:
  - S4 update/check queries,
  - S5 retry-limit setup query,
  - S6 audit check query,
  - cleanup deletes for `tasks` / `approval_requests` / `actions_log`.
Checks:
- Static script review: all previous `:'task_id'` / `:'ent_id'` placeholders removed.
- VPS smoke run (2026-03-17):
  - `bash ./scripts/smoke_scenarios.sh`
  - result: `PASS=6 FAIL=0 SKIP=1`
  - passed: S1..S6
  - skipped: S7 (memory cards not implemented yet)
Open risks:
- Uses escaped SQL literals instead of true prepared statements (safe for current smoke IDs, but still string-based SQL generation).
Review ask:
- Confirm compatibility fix and assess whether escaped-literal approach is acceptable for smoke scope.
Verdict: P1=0, P2=0
P1 items: none
P2 items: none — H-17 P2-a/P2-b fully closed via H-18/H-19; VPS smoke PASS=6 FAIL=0 SKIP=1

---

## H-2026-03-17-20
Role: Codex=Executor, Claude=Reviewer
Scope: §29.4.6 JSON-log viewer — add `/actions/feed` endpoint + skill/docs wiring
Commits: 9e81239
Changes:
- Added `GET /actions/feed` in `app/control-api/server.js`:
  - query params: `limit` (default 20, max 100), `format` (`human|json`), optional filters `action_type`, `actor_role`;
  - `format=json` returns raw `actions_log` rows (including payload);
  - `format=human` returns feed lines via `toHumanFeedText(...)`.
- Added helper functions in `server.js`:
  - `parsePositiveInt(...)` for safe numeric parsing,
  - `toIsoTimestamp(...)`,
  - `toHumanFeedText(...)` for readable event text.
- Updated `skills/stemford-data/references/api.md` with new endpoint contract and curl examples.
- Updated `skills/stemford-data/SKILL.md`:
  - quick reference row for `/actions/feed`,
  - Fast-path Intent C (`покажи лог` / `что произошло` / `последние действия`).
Checks:
- `node --check app/control-api/server.js` passed.
- VPS smoke (2026-03-17):
  - after `systemctl restart stemford-control-api`
  - `curl -sS --max-time 5 -w '\nHTTP:%{http_code}\n' 'http://127.0.0.1:3210/actions/feed?limit=5&format=human'`
  - result: `HTTP:200`, `ok:true`, `data.format:"human"`, `data.count:5`.
Open risks:
- Human text mapping is currently heuristic and English-oriented; may need localization tuning for production Telegram responses.
Review ask:
- Validate API contract of `/actions/feed` and confirm fast-path wiring in SKILL.md is sufficient for §29.4.6 MVP.
Verdict: P1=0, P2=1
P1 items: none
P2 items: локализация human feed (`toHumanFeedText`) под русскоязычный Telegram (backlog)

---

## H-2026-03-17-21
Role: Codex=Executor, Claude=Reviewer
Scope: Follow-up to H-20 P2-a — localize `toHumanFeedText` for Russian Telegram
Commits: ad94b28
Changes:
- Updated `toHumanFeedText(...)` in `app/control-api/server.js`:
  - localized action phrases from English to Russian for known action types:
    `task_created`, `task_claimed`, `task_completed`, `task_failed`,
    `task_retry_queued`, `retry_limit_exceeded`, `task_stalled_auto_blocked`,
    `approval_requested`, `approval_approved`, `approval_rejected`, `tool_access_denied`.
- Kept endpoint contract unchanged (`GET /actions/feed`, same fields/shape).
Checks:
- `node --check app/control-api/server.js` passed.
- VPS smoke (2026-03-17):
  - `systemctl restart stemford-control-api`
  - `curl -sS --max-time 5 -w '\nHTTP:%{http_code}\n' 'http://127.0.0.1:3210/actions/feed?limit=5&format=human'`
  - result: `HTTP:200`, `ok:true`, human `text` lines are localized in Russian.
Open risks:
- Timestamp in text remains `HH:MM` from ISO timestamp (UTC-based formatting); if local-time display is required, follow-up conversion may be needed.
Review ask:
- Confirm that Russian localization closes H-20 P2-a without API regressions.
Verdict: P1=0, P2=1
P1 items: none
P2 items: timestamp in human feed uses UTC `HH:MM`; backlog for user-local time formatting (minor UX)

---

## H-2026-03-17-22
Role: Codex=Executor, Claude=Reviewer
Scope: §29.3 Memory cards MVP — DB schema, API routes, maintenance automation, smoke S7
Commits: 41a3a2b
Changes:
- Added migration `app/control-api/migrations/009_memory_cards.sql`:
  - new table `memory_cards` with TTL (`expires_at`), sensitive flag, optional `source_action_id` link to `actions_log`;
  - FK to `roles(role_id)` for `agent_role`;
  - indexes for user/agent lookup and expiry scans.
- Extended `app/control-api/server.js`:
  - env knobs: `MEMORY_CARD_DEFAULT_TTL_HOURS`, `MEMORY_CARD_SENSITIVE_MAX_TTL_HOURS`;
  - helpers: `parseBoolean`, `parseIsoDatetime`, `includesSensitiveMarkers`;
  - new endpoints:
    - `POST /memory/cards` (create),
    - `GET /memory/cards` (query),
    - `POST /memory/cards/maintenance` (expire+compact maintenance);
  - audit actions: `memory_card_created`, `memory_cards_maintenance_run`;
  - tool-access whitelist extended with `memory.read`/`memory.write` for core roles and `memory.write` for `system_watchdog`.
- Added maintenance runtime artifacts:
  - script: `app/control-api/scripts/memory_cards_maintenance.sh`,
  - systemd units:
    - `app/control-api/systemd/stemford-memory-cards-maintenance.service`
    - `app/control-api/systemd/stemford-memory-cards-maintenance.timer`
  - updated `app/control-api/systemd/README.md` with install/run commands.
- Upgraded cookbook smoke:
  - `app/control-api/scripts/smoke_scenarios.sh` S7 implemented:
    - create memory card via API,
    - read back via API,
    - run maintenance and assert expired cleanup;
  - cleanup trap extended for `memory_cards` and related `actions_log` rows.
- Updated docs:
  - `app/control-api/scripts/README.md`,
  - `skills/stemford-data/references/api.md`,
  - `skills/stemford-data/SKILL.md`.
Checks:
- `node --check app/control-api/server.js` passed.
- Static diff review completed for migration/routes/scripts/docs consistency.
- Local shell syntax check for `*.sh` could not run in this environment (`bash` unavailable/unstable on current host), so shell validation deferred to VPS smoke.
Open risks:
- Not yet verified on VPS:
  - migration apply for `009_memory_cards.sql`,
  - `POST /memory/cards/maintenance` with `actor_role=system_watchdog`,
  - S7 end-to-end in `smoke_scenarios.sh`.
Review ask:
- Validate memory route contracts, safety rules (sensitive TTL/content markers), and whitelist model.
- Validate maintenance script/systemd units and confirm no policy regressions from adding `system_watchdog -> memory.write`.
- Confirm S7 implementation and cleanup behavior are production-safe for repeated smoke runs.
Verdict: P1=0, P2=2
P1 items: none
P2 items:
- Compaction label should be `[truncated]` instead of `[summary]` for accuracy.
- Escape `%` / `_` in `topic ILIKE` filter to avoid wildcard interpretation from user input.

---

## H-2026-03-17-23
Role: Codex=Executor, Claude=Reviewer
Scope: Follow-up to H-22 P2-a/P2-b — compaction label clarity + safe topic search
Commits: bf759a1
Changes:
- Updated `app/control-api/server.js`:
  - added helper `escapeLikePattern(...)` to escape `\`, `%`, `_` for SQL LIKE/ILIKE patterns;
  - changed `GET /memory/cards` topic filter from:
    - `topic ilike $N`
    to:
    - `topic ilike $N escape '\'` with escaped input;
  - changed maintenance compaction marker from `' ... [summary]'` to `' ... [truncated]'`;
  - updated idempotency guard accordingly (`content not like '%[truncated]'`).
Checks:
- `node --check app/control-api/server.js` passed.
Open risks:
- Existing cards already compacted with old marker `[summary]` remain as-is (acceptable legacy, no functional break).
Review ask:
- Confirm H-22 P2-a/P2-b are fully closed with this follow-up and that the LIKE escaping strategy is correct for PostgreSQL.
Verdict: P1=0, P2=0
P1 items: none
P2 items: none — H-22 P2-a/P2-b fully closed by H-23

---

## H-2026-03-17-24
Role: Codex=Executor, Claude=Reviewer
Scope: §29.4.2 Critic pattern MVP (hard-policy layer only)
Commits: 96f46f6
Changes:
- Updated `app/control-api/server.js`:
  - new feature flag: `CONTROL_API_ENABLE_HARD_CRITIC` (default `1`);
  - new class-A set: `external_comm`, `financial_change`, `policy_change`;
  - new helper `runHardPolicyCritic(...)`:
    - blocks class-A approval request without reason (`min 5 chars`);
    - validates `approvals.decide` target before mutation (exists, pending, assigned approver);
    - for class-A `approved` decision requires reason (`min 5 chars`);
  - new wrapper `requireHardPolicyCritic(...)`:
    - on deny returns `409 critic_policy_denied`;
    - writes `critic_policy_denied` into `actions_log` with code/message.
  - new endpoint `POST /critic/check` (dry-run hard check with `allow:true/false`).
  - integrated hard-critic into:
    - `POST /approvals/request`
    - `POST /approvals/decide`
- Updated docs:
  - `skills/stemford-data/references/api.md`:
    - new `POST /critic/check` section,
    - hard-critic rules for approvals request/decide,
    - new env flag documentation.
  - `skills/stemford-data/SKILL.md`:
    - quick reference row for `/critic/check`,
    - class-A reason requirement note.
- Updated smoke:
  - `app/control-api/scripts/smoke_scenarios.sh`:
    - new `S8` checks critic deny for class-A request without reason + audit log.
  - `app/control-api/scripts/README.md`:
    - updated scenario coverage with S8.
Checks:
- `node --check app/control-api/server.js` passed.
- Static review: critic checks are deterministic and independent from LLM.
Open risks:
- Existing approval clients that send empty reason for class-A actions will now receive `409 critic_policy_denied` and need reason field.
- Full runtime verification deferred to VPS smoke (S8) after deploy.
Review ask:
- Validate hard-critic policy boundaries (false-positive/false-negative risk) and confirm class-A reason rule is acceptable.
- Validate `/critic/check` contract and audit trail (`critic_policy_denied`) semantics.
Verdict: P1=0, P2=0
P1 items: none
P2 items: none — hard-policy critic MVP accepted, S8 smoke pass confirmed

---

## H-2026-03-17-25
Role: Codex=Executor, Claude=Reviewer
Scope: §29.4 Guarded-profile gate MVP (skill protocol + critic/check smoke contract)
Commits: 42c4c6f
Changes:
- Updated `skills/stemford-data/SKILL.md`:
  - added explicit **Guarded Profile Gate** section;
  - mandatory mutation pipeline:
    1) deterministic draft,
    2) confirmation,
    3) `/critic/check`,
    4) execute mutation only on `allow:true`,
    5) deny with reason on `allow:false`;
  - mapped action keys: `tasks.write`, `tasks.retry`, `approvals.request.<class>`, `approvals.decide`.
- Updated `skills/stemford-data/references/api.md`:
  - added recommended Guarded usage for `/critic/check`.
- Updated smoke:
  - `app/control-api/scripts/smoke_scenarios.sh`:
    - new `S9` validates `/critic/check` contract:
      - deny path: class-A request without reason -> `allow:false`, `critic_reason_required`;
      - allow path: `tasks.write` -> `allow:true`.
  - `app/control-api/scripts/README.md`:
    - coverage list extended with S9.
Checks:
- Static review: Guarded profile is now explicit and deterministic in skill contract.
- Smoke script updated to validate both deny/allow response contract of `/critic/check`.
Open risks:
- Guarded profile enforcement is currently at skill/protocol level; direct API clients can still call mutation endpoints without first calling `/critic/check` unless endpoint-level checks are added per mutation.
Review ask:
- Confirm this scope is sufficient for §29.4 Guarded MVP and validate S9 expectations.
- Advise whether next increment should enforce critic gate inside task mutation endpoints (server-level mandatory chain).
Verdict: P1=0, P2=0
P1 items: none
P2 items: none — Guarded profile gate MVP accepted, S9 smoke pass confirmed

---

## H-2026-03-17-26
Role: Codex=Executor, Claude=Reviewer
Scope: Create separate Stemford business plan with 3 echelons (priority shift to real repositioning execution)
Commits: pending
Changes:
- Added new plan file: `plans/PLAN_Stemford_Three_Echelons.md`.
- Plan structure includes:
  - Echelon 1: Repositioning (first priority),
  - Echelon 2: Rebranding,
  - Echelon 3: Operational modernization.
- Echelon 1 explicitly covers required streams:
  - identity without franchise,
  - UVP,
  - target audience + parent value,
  - retention strategy,
  - parent communication,
  - competitor analysis in Bulgaria,
  - curriculum ownership audit,
  - legal de-coupling checklist.
- Added stage-gate criteria (exit conditions) between echelons.
- Added AI deputy adaptation section by role (`strategy-gatekeeper`, `pmo`, `finance-kpi`, `orchestrator`).
- Added immediate next step: launch Stage A backlog with A1-A8 tasks in Control API.
Checks:
- Manual structural check: all user-requested components are present and mapped to concrete outputs.
- Plan keeps strict sequence: repositioning -> rebranding -> modernization.
Open risks:
- Plan artifacts are defined, but Stage A tasks are not yet instantiated in Control API.
Review ask:
- Validate completeness of Echelon 1 coverage against business request.
- Validate stage-gate logic and practical executability for weekly operation.
Verdict: pending
P1 items: pending
P2 items: pending

### H-2026-03-19-OPS-01 (runtime cicd micro-fix)
- Scope: fix operational edge case in VPS runbook scripts.
- Change: `run_with_rotation.sh` now ensures log directory exists via `mkdir -p "$LOG_DIR"` before writing `rotation.log`.
- Why: manual reviewer run failed when target log folder did not exist.
- Checks:
  - `grep -n 'LOG_DIR\|mkdir -p "$LOG_DIR"' /opt/stemford/run/cicd/run_with_rotation.sh` shows guard in place.
  - `bash -n /opt/stemford/run/cicd/run_with_rotation.sh` → OK.
- Verdict: P1=0, P2=0.

---

## H-2026-03-28-01
Role: Codex=Executor
Scope: Reliability-first execution baseline: task state machine canon + unified transition rules + quality gate MVP + dashboard visibility
Commits: pending
Changes:
- Added canonical task lifecycle doc:
  - `docs/TASK_STATE_MACHINE.md`
  - fixed actual Kanban mapping for `todo` with pending/rejected start gate -> `Backlog`
- Added executable implementation plan and wired it into project navigation:
  - `plans/PLAN_Implementation_Reliability_Kanban.md`
  - updated `plans/PLAN_OpenClaw_Control_Plane.md`
  - updated `plans/ROADMAP_OpenClaw_Front_CICD_Back.md`
  - updated `START_HERE.md`
- Refactored task transition rules in `app/control-api/server.js`:
  - centralized action rules for `claim/complete/block/fail/reopen/retry`
  - replaced scattered status lists with shared helpers
- Added quality gate MVP:
  - migration `app/control-api/migrations/012_task_quality_checks.sql`
  - task fields `quality_checks_required` / `quality_checks_passed`
  - new endpoint `POST /tasks/:id/quality-checks`
  - `POST /tasks/:id/complete` now blocks with `quality_gate_failed` if required checks are missing
  - `result_summary` auto-passes when non-empty completion summary is provided
- Updated dashboard:
  - task card shows checks progress
  - added `Checks` action
  - create-task flow accepts required quality checks
Checks:
- `node --check app/control-api/server.js` passed after refactor and quality-gate changes.
- Static diff review completed for migration/API/dashboard/doc alignment.
Open risks:
- Not yet deployed to VPS; runtime behavior there still reflects previous version.
- No VPS smoke yet for migration `012_task_quality_checks.sql`.
- Dashboard currently exposes checks as a simple prompt-based control, not final UX.
Review ask:
- Validate that the quality gate contract is minimal but sufficient for MVP.
- Focus on P1 risks around completion flow and compatibility with existing tasks.
Verdict: pending
P1 items: pending
P2 items: pending

---

## H-2026-03-28-02
Role: Codex=Executor
Scope: Review gate MVP (formal P1/P2 findings + P1 block on task completion)
Commits: pending
Changes:
- Added migration `app/control-api/migrations/013_review_findings.sql`:
  - table `review_findings`
  - severities `p1|p2`
  - statuses `open|resolved`
  - task linkage + reviewer attribution
- Extended `app/control-api/server.js`:
  - task list/task detail now expose review summary (`open_p1`, `open_p2`, `resolved_total`)
  - new endpoints:
    - `GET /tasks/:id/review-findings`
    - `POST /tasks/:id/review-findings`
    - `POST /review-findings/:id/resolve`
  - `POST /tasks/:id/complete` now blocks with `review_p1_blocked` if open P1 findings exist
- Updated `app/control-api/public/dashboard.html`:
  - card meta now shows `review: P1=x, P2=y`
  - new `Review` action for quick creation of P1/P2 findings
- Updated `docs/TASK_STATE_MACHINE.md` with Review Gate rules.
Checks:
- `node --check app/control-api/server.js` passed.
- Static diff review confirms review summary is wired into task list, task detail, completion gate and dashboard card meta.
Open risks:
- Dashboard currently supports creating findings, but not resolving them yet from UI.
- P2 auto-follow-up creation is not implemented in this increment.
- VPS/runtime smoke for migration `013_review_findings.sql` not yet run.
Review ask:
- Validate that MVP review gate scope is sufficient for the next deploy cycle.
- Focus on completion-flow regressions and summary counts consistency.
Verdict: pending
P1 items: pending
P2 items: pending

---

## H-2026-03-28-03
Role: Codex=Executor
Scope: Human-first dashboard redesign (4-stage flow board with Review -> Done path)
Commits: pending
Changes:
- Rebuilt `app/control-api/public/dashboard.html` into a simplified flow board:
  - visible stages reduced to `Backlog`, `In Progress`, `Review`, `Done`
  - one primary action per card instead of many technical buttons
  - details moved into the right-side task panel
- Preserved reliability logic under the hood while hiding machine-level controls from the main board:
  - gates, checks, review blockers, approvals and chat still exist
  - they are now surfaced as compact chips and detail-panel actions
- Adjusted lane behavior so a task that already passed end review stays in `Review` until the final `Done` action:
  - this makes the visible flow match the intended human process `Backlog -> In Progress -> Review -> Done`
- Renamed detail-panel actions to more human labels:
  - `Checks` -> `Update Checks`
  - `Add Review` -> `Log Review Issue`
  - `Block` -> `Pause`
Checks:
- Static contract check against `app/control-api/server.js`:
  - confirmed `/tasks`, `/tasks/:id`, `/tasks/:id/quality-checks`, `/tasks/:id/review-findings`, `/review-findings/:id/resolve`, `/approvals/pending`, `/approvals/decide`, `/chat/messages`
  - confirmed `/tasks` default payload includes `tasks[]` with `quality` and `review` summary required by the new board
- Manual diff review completed for board lane mapping and `Review -> Done` behavior.
Open risks:
- No browser smoke yet on VPS for the redesigned board.
- Task creation still uses prompt windows; a proper inline composer is still a follow-up.
- Detail panel is human-friendlier now, but still operational rather than polished product UX.
Review ask:
- Focus on whether the simplified board now matches the intended manager workflow better than the old multi-button cards.
- Check the `Review -> Done` path and whether any hidden action became inaccessible.
Verdict: pending
P1 items: pending
P2 items: pending

Update:
- Simplified task creation flow in `app/control-api/public/dashboard.html`:
  - removed prompts for `primary_goal_id`, `assignee role`, `plan_id`, `plan_step_order`, `start approval`, `end approval`, `quality checks`
  - creation now asks only:
    - task title
    - human-readable assignee choice
  - backend defaults are injected automatically:
    - `primary_goal_id = goal_a_positioning_brief`
    - `plan_id = current board plan filter or null`
    - `plan_step_order = null`
    - `requires_start_approval = false`
    - `requires_end_approval = false`
    - `quality_checks_required = result_summary`
Checks (update):
- Manual UX check of the create-task script confirms the visible prompts are now human-readable and reduced to the minimum viable flow.
Open risks (update):
- Goal and assignee are still stored as internal ids under the hood; the next UX pass should replace defaults/prompts with an inline composer and visible human labels everywhere.

---

## H-2026-03-28-04
Role: Codex=Executor
Scope: Explicit anti-drift plan lock (Coder Factory first, Business Control Plane second)
Commits: pending
Changes:
- Updated canonical plan files to explicitly fix product order:
  - first: `Coder Factory` / software factory with `executor / reviewer / deployer`
  - second: `Business Control Plane` for Stemford, built by coder factory
  - third: reusable platform/service for other businesses
- Added anti-drift wording so current kanban/dashboard work is interpreted as coder-pipeline UX first, not as a generic business task board.
- Clarified in roadmap that Task Board MVP is initially for coder tasks and role visibility on the card/timeline is mandatory.
Files:
- `plans/PLAN_OpenClaw_Control_Plane.md`
- `plans/ROADMAP_OpenClaw_Front_CICD_Back.md`
- `plans/PLAN_Implementation_Reliability_Kanban.md`
Checks:
- Manual verification by `Select-String` on all three plan files confirms explicit presence of:
  - `Coder Factory`
  - `Business Dashboard`
  - anti-drift phrasing
  - `executor / reviewer / deployer`
Open risks:
- Dashboard UX still needs a concrete refactor from generic task board toward coder-factory board.
- Current deployed web UI still reflects the pre-lock interpretation until the next implementation step.
Review ask:
- Validate that the plan hierarchy is now unambiguous enough to stop future drift in product direction.
Verdict: pending
P1 items: pending
P2 items: pending

---

## H-2026-03-28-05
Role: Codex=Executor
Scope: Canonical UX blueprint for separate coder-factory and business dashboards
Commits: pending
Changes:
- Added new UX plan:
  - `plans/PLAN_UX_CoderFactory_and_Business_Control.md`
- The plan now explicitly fixes:
  - shared engine, separate dashboards
  - owner talks only to orchestrator in coder factory
  - left-side human-readable plan with checkboxes
  - coder role columns `executor / reviewer / deployer`
  - decision inbox + task detail tabs `Summary / Discussion / Artifacts`
  - separate business dashboard with business stages and no engineering noise
- Linked the new UX plan into canonical navigation:
  - `START_HERE.md`
  - `plans/PLAN_OpenClaw_Control_Plane.md`
  - `plans/ROADMAP_OpenClaw_Front_CICD_Back.md`
  - `plans/PLAN_Implementation_Reliability_Kanban.md`
Checks:
- Verified by `Select-String` that the new UX plan is referenced from all required route files.
- Manual read-through confirms the split between coder factory and business control plane is now explicit and detailed.
Open risks:
- Current dashboard implementation still needs to be aligned with this new UX blueprint.
- There is still in-progress code for a separate coder page that must be reviewed against the new canonical UX plan before merge.
Review ask:
- Validate that the new UX plan is complete enough to serve as the single source of truth for future dashboard work.
Verdict: pending
P1 items: pending
P2 items: pending

---

## H-2026-03-28-06
Role: Codex=Executor
Scope: Non-conflicting plan structure (product ladder + plan map)
Commits: pending
Changes:
- Added `plans/README.md` as the canonical map of all plan files with explicit categories:
  - active canon
  - business canon
  - archive/reference
- Added three separate product plans:
  - `plans/PLAN_Coder_Factory.md`
  - `plans/PLAN_Business_Control_Plane.md`
  - `plans/PLAN_Service_Productization.md`
- Wired the new structure into navigation:
  - `START_HERE.md`
  - `plans/PLAN_OpenClaw_Control_Plane.md`
- Explicitly fixed the product ladder:
  - coder factory
  - business control plane
  - reusable service
Checks:
- Manual read-through confirms each new file has one role and does not duplicate the existing technical canon.
- New files are linked from `START_HERE.md` and the control-plane plan.
Open risks:
- Historical files `CONCEPT_Stemford_AI_Deputies_Codex.md` and `PLAN_Deputies_Launch_Opus.md` are now classified as archive in the map, but their own headers are not yet rewritten.
- There is still in-progress local code for `coder_factory.html` that remains intentionally outside this planning commit.
Review ask:
- Validate that the new plan map is strict enough to remove ambiguity about which plans are active and which are historical.
Verdict: pending
P1 items: pending
P2 items: pending
## H-2026-03-28-06

### Changes
1. Rewrote `START_HERE.md` from scratch to point only to real, current files in the repository.
2. Switched `AGENTS.md` T1 context router from `PAPERCLIP_FRAMEWORK_MASTER.md` to `plans/README.md`.
3. Removed Paperclip as active navigation canon from agent SOUL files and replaced it with `plans/README.md` / `control-plane` wording where those files described live operating context.

### Checks
1. Verified current repo file map with `rg --files` before rewriting navigation.
2. Re-ran `rg` against `START_HERE.md`, `AGENTS.md`, and `agents/*/SOUL.md` to confirm dead Paperclip file references were removed from active navigation.
3. Confirmed working code drafts in `app/control-api/server.js` and `app/control-api/public/coder_factory.html` were left untouched.

### Open risks
1. Historical/comparative mentions of Paperclip still remain inside archive or analysis plans by design.
2. Some legacy agent SOUL files still have broader old-framework assumptions beyond the removed navigation references; that is a separate cleanup pass.

### Review ask
1. Reviewer focus: confirm that active-start navigation is now conflict-free and no live route points to non-existent Paperclip files.
## H-2026-03-28-07

### Changes
1. Added separate owner-facing route `/coder-factory` in `app/control-api/server.js`.
2. Added dedicated `app/control-api/public/coder_factory.html` as a separate dashboard for the coder factory.
3. Made the screen explicitly owner-facing in wording: private owner dashboard, orchestrator-only chat lane, separate owner decision inbox, separate link back to business dashboard.
4. Kept coder dashboard distinct from the generic business dashboard instead of extending `/dashboard` further.

### Checks
1. `node --check app/control-api/server.js` passed.
2. Verified route registration for `/coder-factory`.
3. Verified owner-only UX copy exists in the new page.

### Open risks
1. This slice is UI + route only; access control for web ownership is not yet hardened.
2. The page currently reads the shared task/chat engine and assumes coder tasks are identified by assignee role (`executor/reviewer/deployer`).
3. No deploy to VPS yet.

### Review ask
1. P1 focus: confirm the coder dashboard is clearly separated from the business dashboard at route, language, and workflow level.
2. P1 focus: confirm no existing business flow was changed by adding the new route.

## H-2026-03-28-08

### Changes
1. Rewrote `START_HERE.md` into a strict navigation entry point instead of a flat list of links.
2. Reworked `plans/README.md` into a clearer map with:
   - shortest safe reading route
   - product ladder
   - foundation vs runtime vs dashboards
   - question-based reading recipes
3. Updated `plans/PLAN_Coder_Factory.md` to explicitly state that coder factory is built on top of the existing reliability/control-plane skeleton and that OpenClaw is the runtime layer, not the rails.

### Checks
1. Manual read-through confirms the new active entry points now answer:
   - what to read first
   - what we are building first
   - what already exists under the product
   - where coder factory stops and business control plane begins
2. No product logic or runtime code was changed in this pass.

### Open risks
1. Historical archive files still exist by design and can still confuse if opened directly outside the active navigation path.
2. `AGENTS.md` still shows old mojibake in some Cyrillic lines in terminal output, but it no longer points to dead navigation files.

### Review ask
1. P1 focus: confirm the project can now be navigated from `START_HERE.md` without extra verbal explanation.
2. P1 focus: confirm the distinction between safe rails, OpenClaw runtime, coder factory, and business control plane is now explicit enough in the active canon.

## H-2026-03-28-09

### Changes
1. Added `plans/PLAN_Coder_Factory_Implementation.md` as a concrete execution plan for the coder factory.
2. Split the coder-factory plan stack more clearly:
   - `PLAN_Coder_Factory.md` = product definition
   - `PLAN_Coder_Factory_Implementation.md` = concrete build sequence
3. Wired the new plan into active navigation:
   - `plans/README.md`
   - `START_HERE.md`
   - `plans/PLAN_Coder_Factory.md`

### Checks
1. Manual read-through confirms the new implementation plan answers the practical question:
   - what exactly do we build next
   - in what order
   - how the runtime layer is attached to the safe rails
2. No runtime code was changed in this pass.

### Open risks
1. The implementation plan is now explicit, but the corresponding runtime code and VPS contour still have to be built stage by stage.
2. Provider routing is intentionally defined as role-based policy first; exact config values will still need a separate implementation pass.

### Review ask
1. P1 focus: confirm the new plan is concrete enough to drive the next implementation steps for coder factory.
2. P1 focus: confirm the split between product plan and implementation plan reduces confusion rather than creating another overlapping document.

## H-2026-03-28-10

### Changes
1. Folded the concrete coder-factory implementation steps back into `plans/PLAN_Coder_Factory.md`.
2. Removed `plans/PLAN_Coder_Factory_Implementation.md` as a separate active document.
3. Cleaned navigation so coder-factory work now points to one main plan again:
   - `START_HERE.md`
   - `plans/README.md`

### Checks
1. Manual read-through confirms `PLAN_Coder_Factory.md` now contains:
   - product definition
   - runtime model
   - provider routing policy
   - concrete phased build order
2. Manual read-through confirms the extra implementation file is no longer referenced from active navigation.

### Open risks
1. `PLAN_Coder_Factory.md` is now longer, so future edits must preserve section clarity.
2. Runtime implementation is still ahead of us; this pass only simplified plan structure.

### Review ask
1. P1 focus: confirm the merged plan is clearer than the previous two-file split.
2. P1 focus: confirm active navigation now points to one obvious coder-factory source of truth.

## H-2026-03-28-11

### Changes
1. Added explicit OpenClaw-readiness framing to `plans/PLAN_Coder_Factory.md`:
   - what is already ready in the control plane
   - what still must be completed before mature role runtime
2. Added a technical section describing the preferred runtime shape:
   - one dedicated coder-factory contour
   - runtime dispatcher
   - role profiles
   - one run per role action
3. Added a database contract section that explains how role separation is enforced through:
   - `tasks`
   - `approval_requests`
   - `chat_messages`
   - `review_findings`
   - `agent_runs`
4. Added explicit sub-steps for persisting executor, reviewer, and deployer as separate run stages.

### Checks
1. Manual read-through confirms the plan now answers:
   - is the control plane ready enough for OpenClaw attachment
   - what concrete gaps still remain
   - how the roles are made real through database and runtime separation
2. No application code or runtime services were changed in this pass.

### Open risks
1. The plan now clearly defines the target separation model, but the actual runtime dispatcher and role-profile implementation still remain to be built.
2. The database contract is explicit at the plan level; some fields and APIs may still need refinement during implementation.

### Review ask
1. P1 focus: confirm the plan is now explicit enough about why the roles are real subagents and not just skills of one bot.
2. P1 focus: confirm the OpenClaw-readiness statement is honest and not overstating current implementation maturity.

## H-2026-03-28-12

### Changes
1. Added task-contract persistence for coder-factory work:
   - new migration `014_task_contract.sql`
   - new `task_contract` field on tasks
2. Added server-side normalization for a formal task contract:
   - `goal`
   - `scope`
   - `forbidden_changes`
   - `definition_of_done`
   - `required_checks`
   - `risk_level`
   - `stage_summary`
3. Updated task read endpoints so every task now returns a normalized contract even when older rows have incomplete data.
4. Surfaced the task contract in both dashboards:
   - coder factory details
   - standard dashboard task details

### Checks
1. Fixed the SQL placeholder count in task creation after adding `task_contract`.
2. `node --check app/control-api/server.js` passes.
3. Manual diff review confirms the first implementation step stays additive:
   - create/read path updated
   - no runtime dispatch logic changed yet

### Open risks
1. This step stores and exposes the contract, but there is not yet a dedicated update flow for orchestrator-driven contract refinement.
2. The new contract is not yet wired into separate executor/reviewer/deployer runs; that remains the next layer.
3. Migration has not yet been applied on VPS in this pass.

### Review ask
1. P1 focus: confirm the contract shape is strict enough to become the handoff payload for role runs.
2. P1 focus: confirm default contract generation from task title is acceptable for the first live version.

## H-2026-03-28-13

### Changes
1. Resolved the dashboard XSS blocker found in review for commit `b70d367`.
2. Replaced unsafe `innerHTML` rendering with safe DOM construction in the standard dashboard for:
   - task cards
   - task details
   - review findings list
   - approvals list
   - chat log
3. Kept the lane header rendering as template HTML because it only uses static lane metadata and numeric counts.

### Checks
1. Manual scan confirms user-controlled task contract fields no longer flow into `innerHTML` in `dashboard.html`.
2. Manual scan confirms other nearby task/review/chat strings in the same file now render through `textContent`.

### Open risks
1. The migration backfill still updates all empty contracts in one transaction; acceptable for current scale, but still a known scaling risk.
2. `normalizeTextArray` duplication and fallback-column detection regex remain follow-up cleanup items, not merge blockers.

### Review ask
1. P1 focus: confirm the dashboard no longer has a user-input-to-`innerHTML` path in the touched areas.
2. P1 focus: confirm the remaining migration/perf note is acceptable as a documented follow-up rather than a release blocker.

## H-2026-03-28-14

### Changes
1. Refined `plans/PLAN_Coder_Factory.md` in response to plan review for commit `77987fc`.
2. Softened readiness wording from "already strong enough" to a more honest "structurally ready / usable scaffolding".
3. Added an explicit verification clause for the subagent-separation checklist in section `7.4`.
4. Replaced fragile substep numbering `8.1 / 9.1 / 10.1` with `8A / 9A / 10A`.
5. Reduced one repeated phrasing by pointing runtime visibility back to the canonical run model in section `7.3`.

### Checks
1. Manual read-through confirms the plan still says the same thing technically, but now overstates less.
2. Manual read-through confirms role-isolation criteria are now testable, not only descriptive.

### Open risks
1. The plan still intentionally repeats a small amount of role-isolation language because this is a working blueprint, not a minimal spec.
2. Further editorial tightening can happen later, but there is no remaining review blocker in this pass.

### Review ask
1. P1 focus: confirm the revised readiness wording no longer implies completed role orchestration.
2. P1 focus: confirm the new verification clause is specific enough to make section `7.4` testable.

## H-2026-03-28-15

### Changes
1. Added `015_agent_run_contract.sql` to persist a formal `run_contract` on `agent_runs`.
2. Added server-side normalization for `role run contract` in `app/control-api/server.js`.
3. Defined a strict run-contract shape with:
   - `role`
   - `task_id`
   - `stage_id`
   - `input_context`
   - `allowed_tools`
   - `required_output_format`
   - `timeout_budget_sec`
   - `fallback_policy`
4. Updated `/runtime/trigger` so a run can auto-enrich itself from task context when a `task_id` is provided.
5. Updated retry/start/complete/list runtime endpoints so `run_contract` survives the whole run lifecycle.
6. Added `GET /runtime/runs/:id` and list filters by `task_id` / `stage_id` for inspection.

### Checks
1. `node --check app/control-api/server.js` passes after the runtime-contract changes.
2. Manual diff review confirms actual role runs now have a first-class contract instead of relying only on generic `payload`.

### Open risks
1. The factory still does not create role runs automatically from owner actions; that bridge is the next layer.
2. `run_contract` currently enriches from task context when available, but it does not yet validate that every runtime call must be task-scoped.
3. Migration has not yet been applied on VPS in this pass.

### Review ask
1. P1 focus: confirm the `run_contract` shape is strict enough for the first executor/reviewer/deployer wiring step.
2. P1 focus: confirm the task-context enrichment in `/runtime/trigger` is additive and does not hide important caller intent.

## H-2026-03-28-16

### Changes
1. Closed the runtime-trigger race window found in review for commit `c202727`.
2. `loadTaskRuntimeContext` now accepts a database handle, so `/runtime/trigger` reads task context through the same transaction client that inserts the run.
3. This makes `run_contract` a transaction-time snapshot instead of a pre-transaction read.
4. Added an explicit code comment documenting retry behavior:
   - retry intentionally reuses the same run-contract snapshot
   - retry is a repeat of the same role assignment, not a fresh task-context rebuild

### Checks
1. Manual inspection confirms task-context read now happens after `BEGIN` and through the same `client`.
2. `node --check app/control-api/server.js` passes after the change.

### Open risks
1. Trigger-time enrichment still performs a relatively heavy task lookup per task-scoped runtime trigger; acceptable now, but a future hot-path optimization target.
2. Allowed-tool names still live as hardcoded strings; that remains a separate follow-up for runtime enforcement.

### Review ask
1. P1 focus: confirm the run snapshot is now transaction-consistent enough for the first live role dispatch layer.
2. P1 focus: confirm retry snapshot reuse is now explicit enough to be treated as intentional design, not accidental staleness.

## H-2026-03-28-17

### Changes
1. Added a first real bridge from task to role-run:
   - `POST /tasks/:id/runtime-dispatch`
2. Added task-scoped runtime run listing:
   - `GET /tasks/:id/runtime-runs`
3. Dispatch now:
   - loads task context
   - chooses executor/reviewer/deployer role
   - blocks duplicate active run for the same task stage and role
   - creates a pending `agent_run`
   - records task-level and run-level audit events
4. Updated `coder_factory.html` so the selected task now shows:
   - a `Queue <role> run` action
   - latest role runs for that task

### Checks
1. `node --check app/control-api/server.js` passes.
2. Extracted script from `app/control-api/public/coder_factory.html` passes `node --check`.
3. Manual code review confirms the new bridge is task-scoped and reuses the formal `run_contract` shape.

### Open risks
1. This queues pending runs, but does not yet start real executor/reviewer/deployer workers automatically.
2. The coder dashboard still has older `innerHTML` rendering paths outside this step; this pass focused on role-run behavior, not full DOM hardening.
3. `human_telegram` is currently used as the owner-side actor for dashboard dispatch because it is already allowed through tool-access policy.

### Review ask
1. P1 focus: confirm the task-to-run bridge is the right first dispatch shape before automatic orchestrator wiring.
2. P1 focus: confirm duplicate-run blocking by `(task_id, stage_id, role, pending/running)` is strict enough for the next step.

## H-2026-03-28-18

### Changes
1. Fixed the XSS path found in the new coder-factory run log for commit `df5946c`.
2. Replaced unsafe `innerHTML` rendering for task role runs with safe DOM construction in `coder_factory.html`.
3. Trimmed extra blank lines at the end of `server.js` to reduce diff noise.
4. Recorded a concrete follow-up from review:
   - add an index for `(run_contract->>'task_id', run_contract->>'stage_id')` on active runs in a later migration

### Checks
1. `node --check app/control-api/server.js` passes.
2. Extracted script from `app/control-api/public/coder_factory.html` passes `node --check`.

### Open risks
1. `coder_factory.html` still has older `innerHTML` paths outside the new role-run block; this pass only closed the newly introduced XSS vector.
2. Task-scoped active-run lookup still uses JSONB extraction without a dedicated index; acceptable for now, but now explicitly queued as the next performance-hardening follow-up.

### Review ask
1. P1 focus: confirm the new role-run block no longer renders task-derived stage data through `innerHTML`.
2. P1 focus: confirm the JSONB index should be handled as the next migration rather than bundled into this XSS fix.
