#!/bin/bash
# 测试覆盖率提升任务 - 测试执行脚本
# 宪法依据: §401-§404 环境锚定公理

set -e

echo "🧪 Negentropy-Lab 测试覆盖率提升任务"
echo "===================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查环境
echo "📍 当前目录: $(pwd)"
echo ""

# 切换到项目根目录
cd "$(dirname "$0")/.."
echo "📁 项目根目录: $(pwd)"
echo ""

# 运行新增的测试
echo "🧪 运行新增的P0优先级测试..."
echo "-----------------------------------"
npm test -- --testPathPattern="WebSocketHandler|MessageHandler|AgentCoordinator|RPCMethods" --passWithNoTests --testTimeout=10000 --verbose

echo ""
echo "📊 生成覆盖率报告..."
echo "-----------------------------------"
npm test -- --testPathPattern="WebSocketHandler|MessageHandler|AgentCoordinator|RPCMethods" --coverage --coverageReporters="text-summary" --coverageReporters="html" --passWithNoTests

echo ""
echo "✅ 测试执行完成！"
echo ""
echo "📄 覆盖率报告位置:"
echo "   - HTML报告: coverage/lcov-report/index.html"
echo "   - 报告文档: tests/coverage-report.md"
echo "   - 数据文件: tests/coverage-data.json"
echo ""
echo "🎯 覆盖率目标:"
echo "   - Agent系统: 70% → 85% (当前预估: ~78%)"
echo "   - 前端组件: 60% → 80% (当前预估: ~72%)"
echo ""
