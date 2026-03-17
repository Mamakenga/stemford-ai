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
Verdict: pending
P1 items: pending
P2 items: pending
