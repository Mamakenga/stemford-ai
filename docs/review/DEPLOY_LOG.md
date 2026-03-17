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
