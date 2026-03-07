#!/usr/bin/env bash
set -euo pipefail

# 回滚后验证脚本（OPS-32.2）
# 默认仅做离线/静态校验；传 --live 会额外执行 HTTP 健康检查。

HEALTH_URL="http://localhost:3000/health"
LIVE_CHECK="false"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_DIR="reports"
REPORT_FILE="${REPORT_DIR}/rollback-verify-${TIMESTAMP}.json"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --health-url)
      HEALTH_URL="$2"
      shift 2
      ;;
    --live)
      LIVE_CHECK="true"
      shift
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

mkdir -p "${REPORT_DIR}"

CHECKS=()
FAILS=0

record_check() {
  local name="$1"
  local status="$2"
  local detail="$3"
  CHECKS+=("{\"name\":\"${name}\",\"status\":\"${status}\",\"detail\":\"${detail}\"}")
  if [[ "${status}" == "FAIL" ]]; then
    FAILS=$((FAILS+1))
  fi
}

if node scripts/contract-count-check.js --enforce >/dev/null 2>&1; then
  record_check "contract_guard" "PASS" "contract guard passed after rollback"
else
  record_check "contract_guard" "FAIL" "contract guard failed after rollback"
fi

if npm run check:constitution >/dev/null 2>&1; then
  record_check "constitution" "PASS" "constitution check passed"
else
  record_check "constitution" "FAIL" "constitution check failed"
fi

if [[ "${LIVE_CHECK}" == "true" ]]; then
  if curl --silent --show-error --fail --max-time 5 "${HEALTH_URL}" >/tmp/rollback-health-${TIMESTAMP}.json 2>/dev/null; then
    record_check "http_health" "PASS" "health endpoint reachable: ${HEALTH_URL}"
  else
    record_check "http_health" "FAIL" "health endpoint unreachable: ${HEALTH_URL}"
  fi
else
  record_check "http_health" "SKIP" "live health check disabled"
fi

STATUS="PASS"
if [[ "${FAILS}" -gt 0 ]]; then
  STATUS="FAIL"
fi

{
  echo "{";
  echo "  \"timestamp\": \"$(date -Iseconds)\",";
  echo "  \"status\": \"${STATUS}\",";
  echo "  \"live_check\": ${LIVE_CHECK},";
  echo "  \"health_url\": \"${HEALTH_URL}\",";
  echo "  \"checks\": [";
  for i in "${!CHECKS[@]}"; do
    if [[ "$i" -gt 0 ]]; then
      echo "    ,${CHECKS[$i]}";
    else
      echo "    ${CHECKS[$i]}";
    fi
  done
  echo "  ]";
  echo "}";
} > "${REPORT_FILE}"

echo "rollback verification report: ${REPORT_FILE}"
echo "status: ${STATUS}"

if [[ "${STATUS}" != "PASS" ]]; then
  exit 1
fi
