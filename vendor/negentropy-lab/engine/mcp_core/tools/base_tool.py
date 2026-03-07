"""
MCP Core BaseTool Abstraction
版本: v4.2
职责: 定义工具抽象基类与统一接口契约
"""


import sys
import io

import abc
import inspect
import logging
from typing import Any, Dict, List, Optional, Type, get_type_hints
from ..config import logger as core_logger

class BaseTool(abc.ABC):
    """
    抽象工具基类，强制执行 MCP 工具契约。
    
    契约条款:
    1. 每个工具必须定义 name, description, input_schema, output_schema
    2. 必须实现 execute 方法
    3. 必须通过 validate_input 进行输入验证
    4. 必须通过 sanitize_output 进行输出消毒
    """
    
    @property
    @abc.abstractmethod
    def name(self) -> str:
        """工具名称（全局唯一标识符）"""
        pass
    
    @property
    @abc.abstractmethod
    def description(self) -> str:
        """工具功能描述"""
        pass
    
    @property
    @abc.abstractmethod
    def input_schema(self) -> Dict[str, Any]:
        """
        输入参数模式定义
        返回: JSON Schema 格式的字典
        """
        pass
    
    @property
    @abc.abstractmethod
    def output_schema(self) -> Dict[str, Any]:
        """
        输出模式定义
        返回: JSON Schema 格式的字典
        """
        pass
    
    @abc.abstractmethod
    def execute(self, **kwargs) -> Any:
        """
        执行工具的核心逻辑
        返回: 原始执行结果
        """
        pass
    
    def validate_input(self, **kwargs) -> bool:
        """
        输入验证（默认实现：检查必填参数）
        可被子类覆盖以提供更复杂的验证逻辑
        """
        required_params = []
        for param_name, param_info in self.input_schema.get("properties", {}).items():
            if param_info.get("required", False):
                required_params.append(param_name)
        
        for param in required_params:
            if param not in kwargs:
                core_logger.error(f"Missing required parameter: {param}")
                return False
        
        core_logger.debug(f"Input validation passed for {self.name}")
        return True
    
    def sanitize_output(self, raw_output: Any) -> Any:
        """
        输出消毒（默认实现：直接返回）
        子类可以覆盖以应用逆熵消毒或其他处理
        """
        return raw_output
    
    def run(self, **kwargs) -> Dict[str, Any]:
        """
        工具运行总入口：验证 → 执行 → 消毒
        返回: {"success": bool, "data": Any, "error": Optional[str]}
        """
        try:
            # 1. 输入验证
            if not self.validate_input(**kwargs):
                return {
                    "success": False,
                    "error": "Input validation failed",
                    "data": None
                }
            
            # 2. 执行核心逻辑
            raw_result = self.execute(**kwargs)
            
            # 3. 输出消毒
            sanitized_result = self.sanitize_output(raw_result)
            
            core_logger.info(f"Tool {self.name} executed successfully")
            return {
                "success": True,
                "data": sanitized_result,
                "error": None
            }
            
        except Exception as e:
            core_logger.error(f"Tool {self.name} failed: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "data": None
            }
    
    @classmethod
    def from_function(cls, func, name: str, description: str, 
                      input_schema: Dict, output_schema: Dict) -> 'BaseTool':
        """
        工厂方法：从普通函数创建工具实例
        
        数学基础: $T_{tool} = \Phi(f_{func})$ 其中 $\Phi$ 为包装变换
        """
        class FunctionTool(BaseTool):
            def __init__(self):
                self._func = func
                self._name = name
                self._description = description
                self._input_schema = input_schema
                self._output_schema = output_schema
            
            @property
            def name(self):
                return self._name
            
            @property
            def description(self):
                return self._description
            
            @property
            def input_schema(self):
                return self._input_schema
            
            @property
            def output_schema(self):
                return self._output_schema
            
            def execute(self, **kwargs):
                return self._func(**kwargs)
        
        return FunctionTool()


class ToolRegistry:
    """
    工具注册表（单例模式）
    
    职责:
    1. 管理工具注册与发现
    2. 提供工具查找与执行接口
    3. 支持动态工具加载与卸载
    """
    
    _instance = None
    
    def __init__(self):
        if ToolRegistry._instance is not None:
            raise RuntimeError("ToolRegistry is a singleton, use get_instance()")
        
        self._tools: Dict[str, BaseTool] = {}
        self._logger = logging.getLogger("ToolRegistry")
    
    @classmethod
    def get_instance(cls) -> 'ToolRegistry':
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def register(self, tool: BaseTool) -> bool:
        """注册工具"""
        if tool.name in self._tools:
            self._logger.warning(f"Tool {tool.name} already registered, overwriting")
        
        self._tools[tool.name] = tool
        self._logger.info(f"Registered tool: {tool.name}")
        return True
    
    def register_function(self, func, name: str, description: str,
                         input_schema: Dict, output_schema: Dict) -> bool:
        """注册函数为工具"""
        tool = BaseTool.from_function(func, name, description, input_schema, output_schema)
        return self.register(tool)
    
    def unregister(self, tool_name: str) -> bool:
        """注销工具"""
        if tool_name not in self._tools:
            return False
        
        del self._tools[tool_name]
        self._logger.info(f"Unregistered tool: {tool_name}")
        return True
    
    def get(self, tool_name: str) -> Optional[BaseTool]:
        """获取工具"""
        return self._tools.get(tool_name)
    
    def list_tools(self) -> List[Dict[str, str]]:
        """列出所有已注册工具"""
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.input_schema
            }
            for tool in self._tools.values()
        ]
    
    def execute(self, tool_name: str, **kwargs) -> Dict[str, Any]:
        """执行指定工具"""
        tool = self.get(tool_name)
        if tool is None:
            return {
                "success": False,
                "error": f"Tool {tool_name} not found",
                "data": None
            }
        
        return tool.run(**kwargs)


# 全局注册表实例
registry = ToolRegistry.get_instance()


def tool(name: str, description: str, input_schema: Dict, output_schema: Dict):
    """
    工具注册装饰器
    
    使用方法:
        @tool(name="example", description="...", input_schema={...}, output_schema={...})
        def example_function(param1: str) -> str:
            return "result"
    """
    def decorator(func):
        registry.register_function(func, name, description, input_schema, output_schema)
        return func
    return decorator
