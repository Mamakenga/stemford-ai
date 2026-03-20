# control-api scripts

## Migrations
- apply: `bash ./scripts/migrate.sh`

## Rollback
- 007: `bash ./scripts/rollback_007_task_retry_fields.sh`

## Watchdog
- run once: `bash ./scripts/stall_watchdog.sh`

## Memory cards maintenance
- run once: `bash ./scripts/memory_cards_maintenance.sh`
- actor role is configurable via `MEMORY_CARDS_MAINTENANCE_ROLE` (default: `system_watchdog`)

## Smoke Scenarios (§29.4.5)
- e2e_noop.sh — E2E smoke helper
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
  - S7 memory cards create/read/maintenance
  - S8 critic class-A request without reason -> denied + audit
  - S9 critic/check contract (deny path + allow path)
  - S10 runtime dedup
  - S11 runtime retry + duplicate retry block
  - S12 runtime dead-letter after max attempts

## Reliability Scenarios
- run extended reliability checks: `bash ./scripts/reliability_scenarios.sh`
- extends smoke with:
  - R1 health/readiness/diagnostics contracts
  - R2 handoff validate contract
  - R3 approval decision flow (wrong approver blocked, correct approver accepted, duplicate blocked)
  - R4 task lifecycle with retry lock and reopen
  - R5 memory validation guards (sensitive marker + ttl)
  - R6 runtime status machine invalid transitions
  - R7 runtime runs filters + actions feed contracts
  - R8 task claim race (exactly one winner)

## Reliability Gate
- run full gate (migrate idempotence + smoke + reliability):
  - `bash ./scripts/reliability_gate.sh`
- optional mode to skip migrations:
  - `bash ./scripts/reliability_gate.sh skip-migrate`
