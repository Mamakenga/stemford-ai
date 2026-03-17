# control-api scripts

## Migrations
- apply: `bash ./scripts/migrate.sh`

## Rollback
- 007: `bash ./scripts/rollback_007_task_retry_fields.sh`

## Watchdog
- run once: `bash ./scripts/stall_watchdog.sh`

## Smoke Scenarios (§29.4.5)
- run cookbook smoke: `bash ./scripts/smoke_scenarios.sh`
- exits non-zero if any scenario fails
- auto-cleans created smoke entities (`tasks`, `approval_requests`, `actions_log`) at script exit
- current coverage:
  - S1 tasks read
  - S2 task create
  - S3 class-A approval request (pending)
  - S4 stalled watchdog log
  - S5 retry limit
  - S6 forbidden PMO financial command + audit
  - S7 memory cards (currently `SKIP`, planned in §29.4.3)
