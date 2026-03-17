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
