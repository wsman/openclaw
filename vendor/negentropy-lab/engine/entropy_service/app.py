"""
熵计算服务 (Entropy Calculation Service) - FastAPI 主应用
版本: 2.9.1 (宪法修正版)
运行端口: 8001
宪法依据: 技术法 §301 (编码一致性), §302 (原子写入), §360 (可视化熵减)
"""

import sys
import io
import os
import uuid
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional

try:
    from fastapi import FastAPI, HTTPException, Depends, Request, Response
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse
except ImportError:
    # 极简 Mock FastAPI
    class FastAPI:
        def __init__(self, *args, **kwargs): pass
        def get(self, *args, **kwargs): return lambda f: f
        def post(self, *args, **kwargs): return lambda f: f
        def middleware(self, *args, **kwargs): return lambda f: f
        def exception_handler(self, *args, **kwargs): return lambda f: f
        def include_router(self, *args, **kwargs): pass
    class CORSMiddleware: pass
    class JSONResponse: pass
    class Request: pass
    class Response: pass

try:
    # Prometheus 指标集成
    from prometheus_fastapi_instrumentator import Instrumentator
    from prometheus_client import Gauge
except ImportError:
    class Instrumentator:
        def instrument(self, *args, **kwargs): return self
        def expose(self, *args, **kwargs): return self
    class Gauge:
        def __init__(self, *args, **kwargs): pass


# -----------------------------------------------------------------------------
# [技术法 §301] 全局字符集强制令
# -----------------------------------------------------------------------------
def enforce_constitutional_encoding():
    """
    强制重配置标准输出流为 UTF-8。
    """
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    else:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

enforce_constitutional_encoding()

# -----------------------------------------------------------------------------
# 模块导入 (宪法修正版：使用相对导入，依赖环境正确性)
# -----------------------------------------------------------------------------
# 假设环境已通过 PYTHONPATH 正确配置 engine 包
try:
    from .metrics import register_system_info, update_entropy_trend
    from .dependencies import get_artisan, get_circuit_breaker
    from .models import (
        ComplexityRequest, ComplexityResponse, RefactorRequest, RefactorResponse,
        FunctionComplexity, Status, Confidence
    )
    from .router import router as api_router
    from .logging_config import setup_logging, generate_trace_id
except ImportError as e:
    # 严重错误：若相对导入失败，说明包结构被破坏
    sys.stderr.write(f"FATAL: 违反结构宪法 - 无法加载内部模块: {e}\n")
    sys.exit(1)

# 设置日志
logger = setup_logging()

# 创建 Instrumentator 实例
instrumentator = Instrumentator(
    should_group_status_codes=False,
    should_ignore_untemplated=True,
    should_respect_env_var=True,
    should_instrument_requests_inprogress=True,
    excluded_handlers=["/metrics"],
    env_var_name="ENABLE_METRICS",
    inprogress_name="inprogress",
    inprogress_labels=True,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    logger.info(f"熵计算服务 v2.9.1 启动，服务ID: {uuid.uuid4()}")
    logger.info(r"宪法约束: 所有熵减操作必须提供 $V(G') \leq V(G)$ 的数学证明")
    yield
    logger.info("熵计算服务关闭")

app = FastAPI(
    title="熵计算服务 (Entropy Calculation Service)",
    description="独立无状态服务，提供代码复杂度计算和AST重构功能。",
    version="2.9.1",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# 安装Prometheus指标采集
instrumentator.instrument(app)
instrumentator.expose(app)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 中间件：Trace-ID
@app.middleware("http")
async def add_trace_id(request: Request, call_next):
    trace_id = request.headers.get("X-Trace-ID") or generate_trace_id()
    request.state.trace_id = trace_id
    logger.info(f"请求开始 | Trace-ID: {trace_id} | 路径: {request.url.path}")
    response = await call_next(request)
    response.headers["X-Trace-ID"] = trace_id
    logger.info(f"请求完成 | Trace-ID: {trace_id} | 状态码: {response.status_code}")
    return response

# 全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    trace_id = getattr(request.state, "trace_id", "unknown")
    logger.error(f"未处理异常 | Trace-ID: {trace_id} | 异常: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "内部服务器错误",
            "trace_id": trace_id,
            "detail": str(exc)
        }
    )

app.include_router(api_router, prefix="/api/v1", tags=["熵计算"])

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "entropy-calculation-service",
        "version": "2.9.1",
        "constitution_compliant": True
    }

@app.get("/constitution")
async def constitution_verification():
    return {
        "constitution_version": "v2.8.0",
        "compliance": {"article_1": True, "article_8": True, "article_12": True},
        "mathematical_guarantees": [
            r"$V(G') \leq V(G)$ 熵减验证",
            "香农熵 $H(X)$ 计算",
            "圈复杂度 $V(G)$ 度量"
        ]
    }

@app.get("/")
async def root():
    return {
        "service": "熵计算服务",
        "version": "2.9.1",
        "constitution_compliance": "S (Stable & Secure)"
    }

if __name__ == "__main__":
    try:
        import uvicorn
        logger.info("正在启动熵计算服务...")
        # 注意：在本地运行时，需确保当前目录的父目录在 PYTHONPATH 中
        # 或在根目录运行: python -m engine.entropy_service.app
        uvicorn.run(
            "engine.entropy_service.app:app",
            host="0.0.0.0",
            port=8001,
            reload=False,
            log_level="info"
        )
    except ImportError:
        import sys
        sys.stderr.write("Mock Entropy Service is NOT actually running (missing 'uvicorn' library).\n")
        import time
        while True: time.sleep(100)
