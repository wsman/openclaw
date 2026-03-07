#!/usr/bin/env bash
set -euo pipefail

# WebSocket performance baseline runner (SP-02)
# Produces reproducible baseline artifacts for CI/nightly comparison.

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
START_ISO="$(date -Iseconds)"
REPORT_DIR="reports"
LOG_FILE="${REPORT_DIR}/ws-perf-baseline-${TIMESTAMP}.log"
JSON_FILE="${REPORT_DIR}/ws-perf-baseline-${TIMESTAMP}.json"
mkdir -p "${REPORT_DIR}"

TARGET_CMD=(
  npx vitest run
  tests/unit/gateway/WebSocketHandler.batch2-performance.test.ts
  tests/performance/benchmark.test.ts
)

echo "[perf] start=${START_ISO}" | tee -a "${LOG_FILE}"
START_EPOCH="$(date +%s)"

if "${TARGET_CMD[@]}" >>"${LOG_FILE}" 2>&1; then
  STATUS="PASS"
else
  STATUS="FAIL"
fi

END_EPOCH="$(date +%s)"
END_ISO="$(date -Iseconds)"
DURATION_SEC=$((END_EPOCH-START_EPOCH))

cat > "${JSON_FILE}" <<JSON
{
  "started_at": "${START_ISO}",
  "ended_at": "${END_ISO}",
  "duration_sec": ${DURATION_SEC},
  "status": "${STATUS}",
  "log_file": "${LOG_FILE}"
}
JSON

echo "[perf] status=${STATUS} duration_sec=${DURATION_SEC}" | tee -a "${LOG_FILE}"
echo "[perf] summary=${JSON_FILE}" | tee -a "${LOG_FILE}"

if [[ "${STATUS}" != "PASS" ]]; then
  exit 1
fi
