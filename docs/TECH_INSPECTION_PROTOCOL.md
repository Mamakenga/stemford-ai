# Tech Inspection Protocol v2

Status: Active
Updated: 2026-03-20
Scope: VPS coder pipeline (executor -> reviewer -> deployer) via Telegram command /техосмотр

## Purpose
Run a fast and safe health check of the full coding pipeline before real tasks.

## Primary Command (Telegram)
Send to @stemford_coder:
 /техосмотр

## Fallback Command (Terminal)
cd /opt/stemford/app/control-api
npm run test:gate

## PASS Criteria
A run is considered healthy only if all of the following are true:
1. Gate includes: Summary: PASS=12 FAIL=0 SKIP=0
2. Gate includes: Summary: PASS=8 FAIL=0 SKIP=0
3. No FAIL lines in smoke or reliability blocks
4. Exit status is success

## Stop Signals
Stop real tasks and fix the system first if any of the following appears:
- Status: PREFLIGHT_FAILED
- Status: NO_DIFF (for a task that must produce changes)
- Status: BLOCKED_BY_REVIEW
- Any FAIL in test:gate output

## Operator Note
Run /техосмотр before important production-like tasks or after infra/script changes.
