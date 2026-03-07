#!/usr/bin/env bash
set -euo pipefail

# 部署预检脚本（OPS-31.2）
# 默认做静态校验，不依赖在线服务。

ENVIRONMENT="staging"
SKIP_TESTS="false"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_DIR="reports"
REPORT_FILE="${REPORT_DIR}/deploy-preflight-${ENVIRONMENT}-${TIMESTAMP}.json"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --skip-tests)
      SKIP_TESTS="true"
      shift
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

REPORT_FILE="${REPORT_DIR}/deploy-preflight-${ENVIRONMENT}-${TIMESTAMP}.json"
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

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
  if [[ "${NODE_MAJOR}" -ge 18 ]]; then
    record_check "node_version" "PASS" "node=$(node -v)"
  else
    record_check "node_version" "FAIL" "node=$(node -v), require >=18"
  fi
else
  record_check "node_version" "FAIL" "node command not found"
fi

if command -v npm >/dev/null 2>&1; then
  record_check "npm_exists" "PASS" "npm=$(npm -v)"
else
  record_check "npm_exists" "FAIL" "npm command not found"
fi

if [[ -f package.json ]]; then
  record_check "package_json" "PASS" "package.json present"
else
  record_check "package_json" "FAIL" "package.json missing"
fi

if node scripts/contract-count-check.js --enforce >/dev/null 2>&1; then
  record_check "contract_guard" "PASS" "93/19 + canonical implementation complete"
else
  record_check "contract_guard" "FAIL" "contract guard failed"
fi

if npm run check:constitution >/dev/null 2>&1; then
  record_check "constitution" "PASS" "constitution check passed"
else
  record_check "constitution" "FAIL" "constitution check failed"
fi

if npm run check:consistency -- --strict --timeout-ms 120000 >/dev/null 2>&1; then
  record_check "consistency" "PASS" "consistency strict passed"
else
  record_check "consistency" "FAIL" "consistency strict failed"
fi

if [[ "${SKIP_TESTS}" == "true" ]]; then
  record_check "mainline_tests" "SKIP" "--skip-tests enabled"
else
  LEGACY_TESTS=(
    tests/unit/gateway/WebSocketHandler.batch1-rpc.test.ts
    tests/unit/gateway/WebSocketHandler.batch2-performance.test.ts
    tests/unit/gateway/WebSocketHandler.batch3-4.test.ts
    tests/unit/gateway/WebSocketHandler.batch4-ui.test.ts
    tests/unit/gateway/WebSocketHandler.batch5-p0-gap.test.ts
    tests/unit/gateway/WebSocketHandler.batch6-p1-p2-gap.test.ts
    tests/integration/gateway/gateway-e2e.test.ts
  )

  LEGACY_TESTS_AVAILABLE="true"
  for f in "${LEGACY_TESTS[@]}"; do
    if [[ ! -f "${f}" ]]; then
      LEGACY_TESTS_AVAILABLE="false"
      break
    fi
  done

  if [[ "${LEGACY_TESTS_AVAILABLE}" == "true" ]]; then
    if npx vitest run "${LEGACY_TESTS[@]}" >/dev/null 2>&1; then
      record_check "mainline_tests" "PASS" "legacy gateway suites passed"
    else
      record_check "mainline_tests" "FAIL" "legacy gateway suites failed"
    fi
  else
    if npm run phase14:e2e >/dev/null 2>&1 && npm run check:integration:config >/dev/null 2>&1; then
      record_check "mainline_tests" "PASS" "phase14:e2e + integration config checks passed"
    else
      record_check "mainline_tests" "FAIL" "phase14:e2e or integration config checks failed"
    fi
  fi
fi

STATUS="PASS"
if [[ "${FAILS}" -gt 0 ]]; then
  STATUS="FAIL"
fi

{
  echo "{";
  echo "  \"timestamp\": \"$(date -Iseconds)\",";
  echo "  \"environment\": \"${ENVIRONMENT}\",";
  echo "  \"status\": \"${STATUS}\",";
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

echo "preflight report: ${REPORT_FILE}"
echo "status: ${STATUS}"

if [[ "${STATUS}" != "PASS" ]]; then
  exit 1
fi
