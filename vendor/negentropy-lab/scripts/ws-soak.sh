#!/usr/bin/env bash
set -euo pipefail

# WebSocket soak regression runner (SP-01)
# Default profile approximates 24h soak: 48 iterations x 30m interval.

ITERATIONS=48
INTERVAL_SEC=1800

while [[ $# -gt 0 ]]; do
  case "$1" in
    --iterations)
      ITERATIONS="$2"
      shift 2
      ;;
    --interval-sec)
      INTERVAL_SEC="$2"
      shift 2
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_DIR="reports"
LOG_FILE="${REPORT_DIR}/ws-soak-${TIMESTAMP}.log"
JSON_FILE="${REPORT_DIR}/ws-soak-${TIMESTAMP}.json"
mkdir -p "${REPORT_DIR}"

PASS_COUNT=0
FAIL_COUNT=0

TARGET_CANDIDATES=(
  tests/unit/gateway/WebSocketHandler.batch1-rpc.test.ts
  tests/unit/gateway/WebSocketHandler.batch2-performance.test.ts
  tests/unit/gateway/WebSocketHandler.batch3-4.test.ts
  tests/unit/gateway/WebSocketHandler.batch4-ui.test.ts
  tests/unit/gateway/WebSocketHandler.batch5-p0-gap.test.ts
  tests/unit/gateway/WebSocketHandler.batch6-p1-p2-gap.test.ts
  tests/integration/gateway/gateway-e2e.test.ts
  server/gateway/openclaw-decision/__tests__/fallback-adapter.test.ts
  server/gateway/openclaw-decision/__tests__/openclaw-bridge.test.ts
  server/gateway/openclaw-decision/__tests__/controller.test.ts
)

TARGET_ARGS=()
for candidate in "${TARGET_CANDIDATES[@]}"; do
  if [[ -f "${candidate}" ]]; then
    TARGET_ARGS+=("${candidate}")
  fi
done

if [[ ${#TARGET_ARGS[@]} -eq 0 ]]; then
  TARGET_CMD=(npm test -- --run)
else
  TARGET_CMD=(npx vitest run "${TARGET_ARGS[@]}")
fi

echo "[soak] start=${TIMESTAMP} iterations=${ITERATIONS} interval_sec=${INTERVAL_SEC}" | tee -a "${LOG_FILE}"

for ((i=1; i<=ITERATIONS; i++)); do
  RUN_TS="$(date -Iseconds)"
  echo "[soak][${i}/${ITERATIONS}] ts=${RUN_TS} running..." | tee -a "${LOG_FILE}"

  if "${TARGET_CMD[@]}" >>"${LOG_FILE}" 2>&1; then
    PASS_COUNT=$((PASS_COUNT+1))
    echo "[soak][${i}/${ITERATIONS}] result=PASS" | tee -a "${LOG_FILE}"
  else
    FAIL_COUNT=$((FAIL_COUNT+1))
    echo "[soak][${i}/${ITERATIONS}] result=FAIL" | tee -a "${LOG_FILE}"
    break
  fi

  if [[ "$i" -lt "$ITERATIONS" ]]; then
    sleep "${INTERVAL_SEC}"
  fi
done

END_TS="$(date -Iseconds)"
cat > "${JSON_FILE}" <<JSON
{
  "started_at": "${TIMESTAMP}",
  "ended_at": "${END_TS}",
  "iterations": ${ITERATIONS},
  "interval_sec": ${INTERVAL_SEC},
  "pass_count": ${PASS_COUNT},
  "fail_count": ${FAIL_COUNT},
  "log_file": "${LOG_FILE}",
  "status": "$( [[ ${FAIL_COUNT} -eq 0 ]] && echo PASS || echo FAIL )"
}
JSON

echo "[soak] summary=${JSON_FILE}" | tee -a "${LOG_FILE}"

if [[ ${FAIL_COUNT} -gt 0 ]]; then
  exit 1
fi
