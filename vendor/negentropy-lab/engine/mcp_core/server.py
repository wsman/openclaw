"""
监察部-逆熵实验室 MCP Core Server
版本: v6.2.0 (Storage Restructuring)
职责: 服务器入口与组件组装
宪法依据: §124 (编码一致性公理), §131 (MCP绝对冷启动原则), §130 (MCP微内核神圣公理)
开发标准引用: DS-001 (通用输出编码规范), DS-011 (MCP工具策略标准实现), DS-012 (依赖注入标准)
数学公理: 冷启动确定性原则 $S_{runtime} ≡ S_{disk}$

更新日志:
- v6.2.0: 升级至宪法v6.2.0版本，支持storage目录重构
- v5.1.2: 修复 Tri-Core 架构下的 sys.path 路径计算问题，防止启动崩溃
- v5.1.0: 实现三位一体架构，遵循增强级三级验证协议 (§155)
- v4.4.0: 初始版本，支持 L5 接口层

架构位置: 微内核层 (Microkernel Layer) - 位于 /engine/mcp_core/
拓扑约束: 作为系统与外部AI工具的桥梁，负责工具注册、依赖注入和协议转换
"""
import sys
import os
import logging
from pathlib import Path

# ==========================================
# 🏗️ 宪法 §124 编码一致性公理 (开发标准 DS-001)
# ==========================================
# 强制 UTF-8 输出，防止 Windows 环境下编码错误
# 同时重定向 stdout 到 stderr 以保护 MCP 协议 (JSON-RPC)
# 任何非 JSON 的 stdout 输出都会导致 -32000 Connection Closed
# 数学基础: 编码确定性定理 $E_{output} = UTF8(E_{input})$
# 根据技术法 §301.1 增强 Windows 兼容性
if sys.platform == "win32":
    # Windows 特定编码修复
    try:
        # Windows 10/11 支持 reconfigure
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8')
        if hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        # 回退到 TextIOWrapper，使用 errors='replace' 防止编码错误崩溃
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
else:
    # Linux/macOS 也确保 UTF-8
    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8')
        if hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# ==========================================
# 📍 路径初始化 (宪法 §131 冷启动原则, 开发标准 DS-012)
# ==========================================
# 动态计算根目录，适配 v5.1 Tri-Core 扁平化架构
# 物理路径: root/engine/mcp_core/server.py
# 数学基础: $P_{abs} = resolve(P_{rel})$
_current_file = Path(__file__).resolve()

# 1. 识别 Python 根目录 (对应 engine/)
# _current_file.parents[0] = mcp_core
# _current_file.parents[1] = engine
_python_root = _current_file.parents[1]

# 2. 识别项目根目录 (root/)
# _current_file.parents[2] = root
_project_root = _current_file.parents[2]

# 3. 注入 sys.path (依赖注入容器初始化)
# 优先加入 engine 根目录，以支持绝对导入 (e.g. import negentropy_engine_simple)
# 遵循开发标准 DS-012: 依赖注入标准，确保模块解析确定性
if str(_python_root) not in sys.path:
    sys.path.insert(0, str(_python_root))

# 加入项目根目录，以支持跨层级导入
if str(_project_root) not in sys.path:
    sys.path.insert(1, str(_project_root))

# ==========================================
# 🔐 日志安全守卫 (开发标准 DS-011)
# ==========================================
# 在加载任何业务逻辑前，确保 Logging 不会污染 Stdout
# 强制所有 INFO 及以上日志输出到 stderr
# 遵循开发标准 DS-011: MCP服务标准，确保输出消毒和协议完整性
logging.basicConfig(stream=sys.stderr, level=logging.INFO, force=True)

# ==========================================
# 📦 依赖注入与模块加载 (开发标准 DS-012)
# ==========================================
# 现在可以安全导入 mcp_core 模块（使用绝对导入，避免相对导入问题）
# 遵循开发标准 DS-012: 依赖注入标准，确保单例模式和生命周期管理
try:
    from engine.mcp_core.config import setup_logging
    from engine.mcp_core.dependencies import container
    from engine.mcp_core.registry import registry
    
    # 工具链加载 (按宪法 §130 MCP微内核神圣公理注册)
    # 工具注册遵循 §331 工具注册规范，确保全局唯一标识
    from engine.mcp_core.tools import iab          # 监察部工具
    from engine.mcp_core.tools import knowledge    # 知识库工具
    from engine.mcp_core.tools import genesis      # 创世工具
    from engine.mcp_core.tools import judiciary    # 司法工具
    from engine.mcp_core.tools import judiciary_dual_store  # 双存储同构验证工具
    from engine.mcp_core.tools import historian    # 史官工具
    from engine.mcp_core.tools import archaeologist # 考古学家工具
    from engine.mcp_core.tools import oracle       # 预言家工具
    from engine.mcp_core.tools import neural_agent  # [v5.0] 神经连接工具
    from engine.mcp_core.tools import resources    # [v5.5.0] 开发标准库资源工具
except ImportError as e:
    # 捕获导入期间的致命错误，打印到 stderr 并退出
    sys.stderr.write(f"[FATAL] Import failed during startup: {e}\n")
    sys.stderr.write(f"sys.path: {sys.path}\n")
    sys.exit(1)

def main():
    """
    MCP 服务器主函数
    遵循宪法 §131 (MCP绝对冷启动原则) 和 §332 (冷启动规范)
    数学公理: $S_{启动} = f(S_{配置}, S_{依赖}, S_{注册})$
    
    执行流程:
    1. 日志初始化 (输出到 stderr)
    2. 工具注册表绑定 (遵循 §331 工具注册规范)
    3. MCP 服务启动 (FastMCP 接管 stdio)
    
    异常处理: 任何未捕获的异常将导致进程退出，确保冷启动确定性
    """
    try:
        # 1. 初始化日志 (再次确认使用 stderr)
        logger = setup_logging()
        logger.info("🚀 正在启动 v6.2.0 MCP 服务器 (Storage Restructuring)...")
        logger.info(f"Python Root: {_python_root}")
        logger.info(f"Project Root: {_project_root}")
        logger.info(f"宪法依据: §124, §130, §131")
        logger.info(f"开发标准: DS-001, DS-011, DS-012")
        
        # 2. 绑定注册表 (遵循 §331 工具注册规范)
        # 数学约束: $R_{bound} = bind(R_{tools}, S_{mcp})$
        registry.bind_server(container.mcp)
        logger.info(f"工具注册完成: {registry.get_tool_count()} 个工具已注册")
        
        # 3. 启动服务
        # FastMCP 会接管 stdio，所有后续 print 必须严格禁止
        # 遵循开发标准 DS-011: MCP服务标准，确保协议完整性
        logger.info("启动 MCP 服务主循环...")
        container.mcp.run()
        
    except Exception as e:
        sys.stderr.write(f"[CRASH] Server main loop failed: {e}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
