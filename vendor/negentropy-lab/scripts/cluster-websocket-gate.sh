#!/usr/bin/env bash
set -euo pipefail

MODE="local"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_DIR="reports"
REPORT_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="$2"
      shift 2
      ;;
    --report-file)
      REPORT_FILE="$2"
      shift 2
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

mkdir -p "${REPORT_DIR}"

if [[ -z "${REPORT_FILE}" ]]; then
  REPORT_FILE="${REPORT_DIR}/cluster-websocket-gate-${MODE}-${TIMESTAMP}.json"
fi

CHECKS=()
FAILS=0

record_check() {
  local name="$1"
  local status="$2"
  local duration_ms="$3"
  local command="$4"
  CHECKS+=("{\"name\":\"${name}\",\"status\":\"${status}\",\"durationMs\":${duration_ms},\"command\":\"${command}\"}")
  if [[ "${status}" == "FAIL" ]]; then
    FAILS=$((FAILS + 1))
  fi
}

run_check() {
  local name="$1"
  local command_label="$2"
  shift 2
  local start_ms end_ms duration_ms
  start_ms="$(date +%s%3N)"
  if "$@"; then
    end_ms="$(date +%s%3N)"
    duration_ms=$((end_ms - start_ms))
    record_check "${name}" "PASS" "${duration_ms}" "${command_label}"
  else
    end_ms="$(date +%s%3N)"
    duration_ms=$((end_ms - start_ms))
    record_check "${name}" "FAIL" "${duration_ms}" "${command_label}"
    return 1
  fi
}

STATUS="PASS"

if ! run_check "typecheck" "npx tsc -p tsconfig.json --noEmit" npx tsc -p tsconfig.json --noEmit; then
  STATUS="FAIL"
fi

if [[ "${STATUS}" == "PASS" ]]; then
  if ! run_check "cluster_regression" "npm run test:cluster" npm run test:cluster; then
    STATUS="FAIL"
  fi
fi

if [[ "${STATUS}" == "PASS" ]]; then
  if ! run_check "cluster_e2e" "npm run test:cluster:e2e" npm run test:cluster:e2e; then
    STATUS="FAIL"
  fi
fi

if [[ "${STATUS}" == "PASS" ]]; then
  if ! run_check "build" "npm run build" npm run build; then
    STATUS="FAIL"
  fi
fi

{
  echo "{"
  echo "  \"timestamp\": \"$(date -Iseconds)\","
  echo "  \"mode\": \"${MODE}\","
  echo "  \"status\": \"${STATUS}\","
  echo "  \"checks\": ["
  for index in "${!CHECKS[@]}"; do
    if [[ "${index}" -gt 0 ]]; then
      echo "    ,${CHECKS[$index]}"
    else
      echo "    ${CHECKS[$index]}"
    fi
  done
  echo "  ]"
  echo "}"
} > "${REPORT_FILE}"

echo "cluster websocket gate report: ${REPORT_FILE}"
echo "cluster websocket gate status: ${STATUS}"

if [[ "${STATUS}" != "PASS" ]]; then
  exit 1
fi
