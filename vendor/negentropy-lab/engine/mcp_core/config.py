"""
监察部-逆熵实验室 MCP Core Configuration
版本: v5.1.3 (Tri-Core Path Correction)
职责: 统一配置管理与环境初始化
依据: 宪法 §124 (编码一致性), §130 (MCP 微内核神圣公理)
"""

import sys
import os
import io
import logging
from pathlib import Path
try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(*args, **kwargs): pass


# ==========================================
# ⚖️ 宪法 §124 编码一致性公理 (CRITICAL)
# ==========================================
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
except AttributeError:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# ==========================================
# 🌍 环境路径适配 (Tri-Core 修正版)
# ==========================================
# 物理路径: root/engine/mcp_core/config.py
CURRENT_DIR = Path(__file__).parent.absolute() # .../engine/mcp_core
APP_PYTHON_DIR = CURRENT_DIR.parent            # .../engine
PROJECT_ROOT = APP_PYTHON_DIR.parent           # .../root (修复: 之前多了一个 .parent)

# 确保 engine 在 sys.path 中
if str(APP_PYTHON_DIR) not in sys.path:
    sys.path.append(str(APP_PYTHON_DIR))

# 日志配置 (强制 stderr)
LOG_LEVEL = logging.INFO
LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'

def setup_logging(name: str = "Entropy-MCP-Core"):
    # 强制 stream=sys.stderr，防止污染 MCP 协议通道
    logging.basicConfig(level=LOG_LEVEL, format=LOG_FORMAT, stream=sys.stderr, force=True)
    return logging.getLogger(name)

logger = setup_logging()

# 多路径扫描 .env 文件
CONFIG_ENV_PATH = PROJECT_ROOT / 'config' / 'environment' / '.env'
ROOT_ENV_PATH = PROJECT_ROOT / '.env'

env_file_loaded = None
if CONFIG_ENV_PATH.exists():
    load_dotenv(CONFIG_ENV_PATH, override=True)
    env_file_loaded = str(CONFIG_ENV_PATH)
    logger.info(f"加载配置目录环境文件: {env_file_loaded}")
elif ROOT_ENV_PATH.exists():
    load_dotenv(ROOT_ENV_PATH, override=True)
    env_file_loaded = str(ROOT_ENV_PATH)
    logger.info(f"加载根目录环境文件: {env_file_loaded}")
else:
    logger.warning(f"未找到 .env 文件，将在默认路径搜索: {ROOT_ENV_PATH}")

# ==========================================
# ⚙️ 全局配置常量
# ==========================================

# 服务配置
MCP_SERVER_NAME = "Entropy-Lab-Inspector-v2"
ENTROPY_SERVICE_URL = os.getenv("ENTROPY_SERVICE_URL", "http://localhost:8001")
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")

# Mock Qdrant 逻辑
if QDRANT_URL.lower() in ["mock", "local", "memory"]:
    logger.info(f"检测到 QDRANT_URL={QDRANT_URL}，启用本地 Mock 模式")
    # 使用本地文件存储以实现持久化，符合 Phase 4.1-Lite 要求
    QDRANT_PATH = str(Path(__file__).parent.parent.parent / "storage" / "qdrant_local")
    os.makedirs(QDRANT_PATH, exist_ok=True)
    QDRANT_MODE = "local"
else:
    QDRANT_PATH = None
    QDRANT_MODE = "remote"

# 宪法级约束
STRICT_DIMENSION = 4096
EMBEDDING_MODE = os.getenv('EMBEDDING_MODE', 'UNKNOWN')

# 存储路径
STORAGE_DIR = PROJECT_ROOT / "storage"
CORPUS_DIR = STORAGE_DIR / "corpus"  # 双存储架构: 全文本数据库 (§114)
MEMORY_BANK_DIR = STORAGE_DIR / "memory_bank"  # 活跃状态与系统公理
DATA_DIR = STORAGE_DIR / "config"
PROJECTS_FILE = DATA_DIR / "projects.json"

# 确保基础目录存在 (如果 PROJECT_ROOT 计算错误，这一步会因权限问题崩溃)
try:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
except Exception as e:
    sys.stderr.write(f"[FATAL] Failed to create config directory at {DATA_DIR}: {e}\n")
    sys.exit(1)

logger.info(f"Core Config Loaded (v5.1.3): Root={PROJECT_ROOT}, Mode={EMBEDDING_MODE}")
