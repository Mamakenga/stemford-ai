#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

API_BASE="${CONTROL_API_BASE_URL:-http://127.0.0.1:${CONTROL_API_PORT:-3210}}"
ACTOR_ROLE="${MEMORY_CARDS_MAINTENANCE_ROLE:-system_watchdog}"

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required"
  exit 1
fi

resp="$(curl -sS -X POST "$API_BASE/memory/cards/maintenance" \
  -H "Content-Type: application/json" \
  -d "{\"actor_role\":\"${ACTOR_ROLE}\"}")"

if ! echo "$resp" | jq -e '.ok == true' >/dev/null; then
  echo "memory_cards_maintenance failed: $resp"
  exit 1
fi

echo "$resp" | jq -r '
  "expired_deleted=\(.data.expired_deleted // 0) compacted_count=\(.data.compacted_count // 0)"
'
