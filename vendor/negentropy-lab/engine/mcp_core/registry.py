"""
监察部-逆熵实验室 MCP Core Registry
版本: v6.2.0 (Storage Restructuring)
职责: 动态工具注册与管理
宪法依据: §130 (MCP 微内核神圣公理), §331 (工具注册规范)
"""

import sys
import io

import logging
import functools
from typing import Callable, Dict, Any, Optional
from mcp.server.fastmcp import FastMCP

logger = logging.getLogger("Entropy-Registry")

class ToolRegistry:
    """去中心化工具注册表"""
    _instance = None
    
    def __init__(self):
        self._tools: Dict[str, Callable] = {}
        self._mcp_instance: Optional[FastMCP] = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def bind_server(self, mcp: FastMCP):
        """绑定 FastMCP 实例并注册所有已加载的工具"""
        self._mcp_instance = mcp
        for name, func in self._tools.items():
            try:
                mcp.tool()(func)
                logger.info(f"Tool Registered: {name}")
            except Exception as e:
                logger.error(f"Failed to register tool {name}: {e}")

    def get_tool_count(self) -> int:
        """返回已注册工具的数量"""
        return len(self._tools)

    def register(self, name: Optional[str] = None):
        """装饰器：注册工具"""
        def decorator(func: Callable):
            tool_name = name or func.__name__
            self._tools[tool_name] = func
            # 如果服务器已绑定，立即注册
            if self._mcp_instance:
                self._mcp_instance.tool()(func)
            return func
        return decorator

# 全局单例
registry = ToolRegistry.get_instance()
