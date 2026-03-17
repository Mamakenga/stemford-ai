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
Checks: <what was verified — tests, smoke, logs>
Open risks: <what remains risky or unverified>
Review ask: <specific focus for reviewer>
Verdict: <P1=N, P2=N — filled by Reviewer>
P1 items: <list, or "none">
P2 items: <list — goes to backlog>
```

## Rules

1. **Every commit** that is part of a handoff includes `Handoff: H-...` in the commit message.
2. **Merge gate**: merge to main only when the Verdict line reads `P1=0`.
3. **Deploy gate**: after merge, a separate entry in DEPLOY_LOG.md with sha, migrate, restart, smoke results.
4. **Reviewer** appends the Verdict block — does not modify Changes/Checks/Open risks.

---

## H-2026-03-17-01
Role: Codex=Executor, Claude=Reviewer
Scope: Retry flow + stall watchdog (steps A+B)
Commits: ebba862, 0fcfced, 3309edb, cfe53fd, 57a9004
Changes:
- POST /tasks/:id/retry — two-layer check, MAX_RETRY_ATTEMPTS from env, race condition guard
- POST /tasks/:id/claim — retry_after barrier (AND retry_after IS NULL OR retry_after <= now())
- Migration 007: retry_attempt + retry_after columns, wrapped in BEGIN/COMMIT
- Migration 008: system_watchdog role
- Rollback script for 007
- stall_watchdog.sh — atomic CTE (UPDATE tasks → INSERT actions_log)
Checks: node --check OK, VPS smoke (health, db/ping, tasks list), migration applied
Open risks: rollback script not tested on prod data
Review ask: retry flow correctness, transaction safety
Verdict: P1=0, P2=1
P1 items: none
P2 items: retry_after barrier in /claim — was already implemented by Codex in 3309edb, confirmed during review

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
Review ask: (a) fallback catches only retry columns? (b) cron→systemd transition correct?
Verdict: P1=0, P2=1
P1 items: none
P2 items: fallback condition was too broad (42703 catches any missing column) — narrowed to regex check on retry_attempt|retry_after

---

## H-2026-03-17-03
Role: Codex=Executor, Claude=Reviewer
Scope: Narrow GET /tasks fallback condition (P2 from H-02)
Commits: pending (server.js fix applied locally)
Changes:
- Fallback condition narrowed: `e.code === "42703" && /retry_attempt|retry_after/i.test(msg)`
Checks: code review — logic confirmed correct
Open risks: none
Review ask: confirm narrowed condition is sufficient
Verdict: P1=0, P2=0
P1 items: none
P2 items: none

---

## H-2026-03-17-04
Role: Codex=Executor, Claude=Reviewer
Scope: OI-6 — formalize Role Definition (6 fields) in agent SOUL files
Commits: 87d3d3d
Changes:
- Added explicit `Role Definition (6 полей)` blocks to all role profiles:
  - `agents/orchestrator/SOUL.md`
  - `agents/pmo/SOUL.md`
  - `agents/finance-kpi/SOUL.md`
  - `agents/strategy-gatekeeper/SOUL.md`
- Each block now defines: Title, Duties, Authority, Boundaries, Standards, Reporting.
Checks:
- Presence check by grep: all 4 files contain `Role Definition (6 полей)` section.
Open risks:
- Approval Gates progressive weakening (Weeks 1-4 / Month 2-6 / Month 6+) is not yet formalized as a separate policy artifact.
Review ask:
- Verify that Duties/Authority/Boundaries are specific enough and non-overlapping across the 4 roles.
Verdict: pending
P1 items: pending
P2 items: pending

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
Verdict: pending
P1 items: pending
P2 items: pending

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
Verdict: pending
P1 items: pending
P2 items: pending
