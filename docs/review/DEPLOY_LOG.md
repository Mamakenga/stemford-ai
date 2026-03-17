# DEPLOY LOG

Each deploy to VPS gets a separate entry.

## Format

```
## D-YYYY-MM-DD-NN
Handoff: H-...
SHA: <commit sha deployed>
Steps:
- [ ] git pull
- [ ] migrate (if needed)
- [ ] restart service(s)
- [ ] smoke: health
- [ ] smoke: db/ping
- [ ] smoke: functional test
Result: OK / FAILED (details)
```

---

## D-2026-03-17-01
Handoff: H-2026-03-17-01
SHA: 57a9004 (includes retry + watchdog + migrations)
Steps:
- [x] git pull
- [x] migrate 007 + 008 applied
- [x] restart stemford-control-api
- [x] smoke: health — OK
- [x] smoke: db/ping — OK
- [x] smoke: GET /tasks — OK
- [x] enable stemford-stall-watchdog.timer
Result: OK

## D-2026-03-17-02
Handoff: H-2026-03-17-02
SHA: 73a60ca (GET /tasks fallback + systemd timer artifacts)
Steps:
- [x] git pull
- [x] migrate: not needed
- [x] restart stemford-control-api
- [x] smoke: timer active, service exits 0/SUCCESS
Result: OK

## D-2026-03-17-03
Handoff: H-2026-03-17-06
SHA: 236fdfe (includes a4ab705 runtime fix + H-06 log finalize)
Steps:
- [x] git pull
- [x] migrate: not needed
- [x] restart stemford-control-api
- [x] smoke: POST /tasks/:id/retry returns `retry_limit_exceeded` at cap
- [x] smoke: `actions_log` has `action_type='retry_limit_exceeded'` with payload
Result: OK

## D-2026-03-17-04
Handoff: H-2026-03-17-11
SHA: 5779191 (EC-3 runtime tool access enforcement)
Steps:
- [x] git pull
- [x] migrate: not needed
- [x] restart stemford-control-api
- [x] smoke: `POST /approvals/request` as `pmo` with `financial_change` returns `403 forbidden`
- [x] smoke: `actions_log` has `action_type='tool_access_denied'` with `action_key='approvals.request.financial_change'`
Result: OK

## D-2026-03-17-05
Handoff: H-2026-03-17-12
SHA: 287486a (EC-2 webhook alerts for critical events)
Steps:
- [x] git pull
- [x] migrate: not needed
- [x] restart stemford-control-api
- [x] smoke: `POST /approvals/request` with explicit approver returns `ok:true`
- [x] smoke: `POST /tasks/:id/retry` at cap returns `retry_limit_exceeded`
- [x] smoke: `actions_log` includes `approval_requested`, `task_failed`, `retry_limit_exceeded` for EC-2 test entities
Result: OK (API + actions_log path verified; Telegram receipt to be confirmed by operator)

## D-2026-03-17-06
Handoff: H-2026-03-17-13
SHA: 4455ee7 (EC-2 follow-up: Telegram API reject logging)
Steps:
- [x] git pull
- [x] migrate: not needed
- [x] restart stemford-control-api
- [x] smoke: `systemctl is-active stemford-control-api` -> `active`
Result: OK

## D-2026-03-17-07
Handoff: H-2026-03-17-14
SHA: e0a9bd1 (EC-4 readiness/diagnostics endpoints)
Steps:
- [x] git pull
- [x] migrate: not needed
- [x] restart stemford-control-api
- [x] smoke: `GET /readiness` returns `ok:true` + `status:"ready"`
- [x] smoke: `GET /diagnostics` returns `ok:true` + queue/webhook/uptime fields
Result: OK

## D-2026-03-17-08
Handoff: H-2026-03-17-15
SHA: 5f82c1c (TaskSpecify-lite skill update)
Steps:
- [x] git pull
- [x] runtime restart (`stemford-openclaw-runtime`)
- [x] first smoke failed (stale session behavior)
- [x] session backup + reset (`~/.openclaw-stemford/agents/main/sessions/*`)
- [x] runtime restart
- [x] second smoke passed: bot returns draft + confirmation `Ок?`
Result: OK (behavior fixed after session reset; latency remains high and tracked in handoff)

## D-2026-03-17-09
Handoff: H-2026-03-17-16
SHA: adcc467 (TaskSpecify-lite tie-break rule)
Steps:
- [x] git pull
- [x] sync skill file to workspace path
- [x] restart stemford-openclaw-runtime
- [x] smoke: conflict phrase `бюджет на презентацию` -> draft assignee `Finance`
Result: OK

## D-2026-03-17-10
Handoff: H-2026-03-17-17
SHA: b57798f (Cookbook smoke scenarios script)
Steps:
- [x] git pull
- [x] migrate: not needed
- [x] run `bash ./scripts/smoke_scenarios.sh`
- [x] smoke summary: `PASS=6 FAIL=0 SKIP=1`
- [x] passed scenarios: `S1..S6`
- [x] skipped scenarios: `S7` (memory cards not implemented yet, planned in §29.4.3)
Result: OK

## D-2026-03-17-11
Handoff: H-2026-03-17-19
SHA: 95029c2 (includes `faa180b` smoke compatibility fix)
Steps:
- [x] git pull
- [x] migrate: not needed
- [x] run `bash ./scripts/smoke_scenarios.sh`
- [x] smoke summary: `PASS=6 FAIL=0 SKIP=1`
- [x] passed scenarios: `S1..S6`
- [x] skipped scenarios: `S7` (memory cards not implemented yet, planned in §29.4.3)
Result: OK

## D-2026-03-17-12
Handoff: H-2026-03-17-20
SHA: 62ffc7d (includes `9e81239` actions feed endpoint + skill wiring)
Steps:
- [x] git pull
- [x] migrate: not needed
- [x] restart `stemford-control-api`
- [x] smoke: `GET /actions/feed?limit=5&format=human` returns `ok:true` + `HTTP:200`
- [x] smoke: payload includes `data.format="human"` and non-empty `data.items`
Result: OK

## D-2026-03-17-13
Handoff: H-2026-03-17-21
SHA: 0e1c8b7 (includes `ad94b28` Russian localization for human feed text)
Steps:
- [x] git pull
- [x] migrate: not needed
- [x] restart `stemford-control-api`
- [x] smoke: `GET /actions/feed?limit=5&format=human` returns `HTTP:200`, `ok:true`
- [x] smoke: `data.items[*].text` localized in Russian (`запросил одобрение`, `создал`, `доступ запрещён`, `достиг лимита повторов`)
Result: OK

## D-2026-03-17-14
Handoff: H-2026-03-17-22
SHA: 6179960 (includes `41a3a2b` memory cards MVP + maintenance + S7 smoke)
Steps:
- [x] git pull
- [x] migrate: `009_memory_cards.sql` applied
- [x] restart `stemford-control-api`
- [x] first smoke attempt failed with transient connect race (`curl: (7)` right after restart)
- [x] service status verified active/listening on `127.0.0.1:3210`
- [x] smoke rerun: `PASS=7 FAIL=0 SKIP=0`
Result: OK

## D-2026-03-17-15
Handoff: H-2026-03-17-23
SHA: db691f0 (includes `bf759a1` P2 follow-up + H-23 finalize)
Steps:
- [x] git pull
- [x] migrate: not needed
- [x] restart `stemford-control-api`
- [x] first smoke attempt failed with transient connect race (`curl: (7)` right after restart)
- [x] smoke rerun after short wait: `PASS=7 FAIL=0 SKIP=0`
Result: OK

## D-2026-03-17-16
Handoff: H-2026-03-17-24
SHA: 3757cb3 (includes `96f46f6` hard-policy critic MVP + S8 smoke)
Steps:
- [x] git pull
- [x] migrate: not needed
- [x] restart `stemford-control-api`
- [x] wait 3s to avoid restart race
- [x] run `bash ./scripts/smoke_scenarios.sh`
- [x] smoke summary: `PASS=8 FAIL=0 SKIP=0`
- [x] S8 passed: class-A approval request without reason -> `critic_policy_denied` + `actions_log`
Result: OK

## D-2026-03-17-17
Handoff: H-2026-03-17-25
SHA: 2665095 (includes `42c4c6f` Guarded-profile protocol + S9 smoke)
Steps:
- [x] git pull
- [x] migrate: not needed
- [x] restart `stemford-control-api`
- [x] run `bash ./scripts/smoke_scenarios.sh`
- [x] smoke summary: `PASS=9 FAIL=0 SKIP=0`
- [x] S9 passed: `/critic/check` deny path (`critic_reason_required`) + allow path (`tasks.write`)
Result: OK
