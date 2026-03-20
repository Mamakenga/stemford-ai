#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

MODE="${1:-full}"

echo "[GATE] CI/CD-back reliability gate started (mode=${MODE})"
echo "---"

if [ "${MODE}" != "skip-migrate" ]; then
  echo "[GATE] migrate pass 1"
  bash ./scripts/migrate.sh
  echo "[GATE] migrate pass 2 (idempotence check)"
  bash ./scripts/migrate.sh
fi

echo "[GATE] smoke scenarios (S1-S12)"
bash ./scripts/smoke_scenarios.sh

echo "[GATE] reliability scenarios (R1-R8)"
bash ./scripts/reliability_scenarios.sh

echo "---"
echo "[GATE] PASS: all reliability checks are green"
