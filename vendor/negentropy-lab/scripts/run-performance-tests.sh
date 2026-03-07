#!/bin/bash
# =============================================================================
# 性能测试运行脚本
# 
# 宪法依据:
# - §110 协作效率公理: 性能基准测试验证
# - §306 零停机协议: 高负载稳定性测试
# - §190 网络韧性公理: 错误恢复能力测试
# 
# 用法:
#   ./scripts/run-performance-tests.sh          # 运行所有性能测试
#   ./scripts/run-performance-tests.sh --quick  # 快速运行（缩短持续时间）
# =============================================================================

set -e

echo "📊 Negentropy-Lab 性能测试套件"
echo "=================================="

# 配置
QUICK_MODE=false
TEST_TIMEOUT_MS="${PERF_TEST_TIMEOUT_MS:-180000}"
if [[ "$1" == "--quick" ]]; then
  QUICK_MODE=true
  echo "⚡ 快速模式启用"
fi

# 设置环境变量
export ENABLE_PERF_TESTS=true
export NODE_ENV=test

if [ "$QUICK_MODE" = true ]; then
  # 快速模式：缩短测试持续时间
  export PERF_PROFILE=quick
  export PERF_TEST_DURATION=10
  export PERF_LONG_RUN_DURATION=12
  export PERF_CONCURRENT_USERS=1,5,20
fi

echo ""
echo "📋 测试配置:"
echo "  - ENABLE_PERF_TESTS=true"
echo "  - NODE_ENV=test"
echo "  - PERF_TEST_TIMEOUT_MS=${TEST_TIMEOUT_MS}"
if [ "$QUICK_MODE" = true ]; then
  echo "  - PERF_PROFILE=quick"
  echo "  - PERF_TEST_DURATION=10s (快速模式)"
  echo "  - PERF_LONG_RUN_DURATION=12s"
  echo "  - PERF_CONCURRENT_USERS=1,5,20"
fi
echo ""

# 运行性能测试
echo "🚀 启动性能测试..."
echo ""

if npm test -- --run --testTimeout="${TEST_TIMEOUT_MS}" tests/performance/benchmark.test.ts; then
  echo ""
  echo "✅ 性能测试完成"
  echo ""
  echo "📊 宪法合规验证:"
  echo "  ├── §110 协作效率公理: API响应延迟测试"
  echo "  ├── §306 零停机协议: 高负载稳定性测试"
  echo "  └── §190 网络韧性公理: 错误恢复能力测试"
  echo ""
  exit 0
else
  echo ""
  echo "❌ 性能测试失败"
  echo ""
  echo "请检查测试输出了解详情"
  exit 1
fi
