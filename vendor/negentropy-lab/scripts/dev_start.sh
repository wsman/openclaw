#!/bin/bash

# Negentropy-Lab Dev Startup Script (Phase 4.1-Lite)
# Parallel start for Node.js Gateway, Python MCP, and Entropy Service
# 依据: Phase 4.1-Lite 本地环境对接要求

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 1. 环境配置
export QDRANT_URL=mock
export NODE_ENV=development
export PORT=4514
export MCP_PORT=2567
export ENTROPY_SERVICE_URL=http://localhost:8001
export PYTHONPATH="$PROJECT_ROOT:$PROJECT_ROOT/engine"

# 端口配置
GATEWAY_PORT=4514
MCP_PORT=2567
ENTROPY_PORT=8001

echo "🚀 [Negentropy-Lab] 正在初始化本地开发环境..."

# 2. 检查端口占用
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo "❌ 错误: 端口 $port 已被占用。请先关闭冲突进程。"
        return 1
    fi
    return 0
}

echo "🔍 检查端口可用性..."
check_port $GATEWAY_PORT || exit 1
check_port $MCP_PORT || exit 1
check_port $ENTROPY_PORT || exit 1

# 3. 准备存储目录
echo "📁 准备本地存储目录..."
mkdir -p storage/qdrant_local
mkdir -p storage/corpus
mkdir -p memory_bank

# 4. 启动服务
# 清理子进程的函数
cleanup() {
    echo ""
    echo "🛑 [Negentropy-Lab] 正在停止所有服务..."
    # 杀死当前进程组中的所有子进程
    kill $(jobs -p) 2>/dev/null
    echo "✅ 已完成清理。"
    exit
}

trap cleanup SIGINT SIGTERM

echo "📡 1. 启动 Entropy Service 于端口 $ENTROPY_PORT..."
# 使用 python3 -m 运行以确保包路径正确
python3 -m engine.entropy_service.app > entropy_service.log 2>&1 &
ENTROPY_PID=$!

echo "🤖 2. 启动 Python MCP 于端口 $MCP_PORT..."
# 注意: 如果本地环境缺少 mcp 库，此步骤可能会报错
# 我们通过环境变量告诉 server.py 使用 SSE 模式 (如果代码已适配)
# 暂时直接后台运行，日志输出到文件
python3 engine/mcp_core/server.py > mcp_server.log 2>&1 &
MCP_PID=$!

echo "🌐 3. 启动 Node.js Gateway 于端口 $GATEWAY_PORT..."
# 设置 PORT 环境变量以覆盖默认 3000
npm run dev -- --port $GATEWAY_PORT > gateway.log 2>&1 &
GATEWAY_PID=$!

echo ""
echo "✅ 所有服务已启动！"
echo "------------------------------------------------"
echo "  - Gateway: http://localhost:$GATEWAY_PORT"
echo "  - MCP (SSE): http://localhost:$MCP_PORT"
echo "  - Entropy: http://localhost:$ENTROPY_PORT"
echo "  - Qdrant Mode: Mock (Local Path: storage/qdrant_local)"
echo "------------------------------------------------"
echo "📜 日志文件: gateway.log, mcp_server.log, entropy_service.log"
echo "💡 按 Ctrl+C 停止所有服务。"

# 等待子进程
wait
