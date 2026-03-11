#!/usr/bin/env python3
import asyncio
import contextlib
import importlib
import inspect
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple


ROOT = Path(__file__).resolve().parents[1]
ENGINE_ROOT = ROOT / "engine"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ENGINE_ROOT) not in sys.path:
    sys.path.insert(1, str(ENGINE_ROOT))

DEFAULT_MODULES = [
    "engine.mcp_core.tools.resources",
]


def read_payload() -> Dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    return json.loads(raw)


def normalize_module_names(values: List[str]) -> List[str]:
    normalized: List[str] = []
    for value in values:
        if value.startswith("engine."):
            normalized.append(value)
        else:
            normalized.append(f"engine.mcp_core.tools.{value}")
    return normalized


def load_registry(module_names: List[str]) -> Tuple[Any, List[str], Dict[str, str]]:
    with contextlib.redirect_stdout(sys.stderr):
        registry_module = importlib.import_module("engine.mcp_core.registry")
        registry = registry_module.registry

        loaded: List[str] = []
        errors: Dict[str, str] = {}
        for module_name in normalize_module_names(module_names or DEFAULT_MODULES):
            try:
                importlib.import_module(module_name)
                loaded.append(module_name)
            except Exception as exc:  # pragma: no cover - defensive bridge behavior
                errors[module_name] = str(exc)

        return registry, loaded, errors


def annotation_to_schema(annotation: Any) -> Dict[str, Any]:
    origin = getattr(annotation, "__origin__", None)
    if annotation in (int,):
        return {"type": "number"}
    if annotation in (float,):
        return {"type": "number"}
    if annotation in (bool,):
        return {"type": "boolean"}
    if annotation in (dict, Dict, Any):
        return {"type": "object"}
    if annotation in (list, List) or origin in (list, List):
        return {"type": "array"}
    return {"type": "string"}


def build_input_schema(func: Any) -> Dict[str, Any]:
    signature = inspect.signature(func)
    properties: Dict[str, Any] = {}
    required: List[str] = []

    for name, parameter in signature.parameters.items():
        if name in {"self", "cls"}:
            continue
        schema = annotation_to_schema(parameter.annotation)
        if parameter.default is inspect._empty:
            required.append(name)
        else:
            try:
                json.dumps(parameter.default)
                schema["default"] = parameter.default
            except TypeError:
                schema["default"] = str(parameter.default)
        properties[name] = schema

    return {
        "type": "object",
        "properties": properties,
        "required": required,
    }


def sanitize(value: Any) -> Any:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, dict):
        return {str(key): sanitize(val) for key, val in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [sanitize(item) for item in value]
    return str(value)


def describe_tools(registry: Any, loaded_modules: List[str]) -> List[Dict[str, Any]]:
    discovered = []
    module_tags = {module_name.split(".")[-1] for module_name in loaded_modules}
    for tool_name, func in sorted(registry._tools.items()):
        description = inspect.getdoc(func) or ""
        module_name = getattr(func, "__module__", "unknown")
        discovered.append({
            "toolName": tool_name,
            "description": description.splitlines()[0] if description else tool_name,
            "module": module_name,
            "inputSchema": build_input_schema(func),
            "outputSchema": {"type": "string"},
            "tags": sorted({"authority-transport", "mcp-core", *module_tags, module_name.split(".")[-1]}),
            "metadata": {
                "bridge": "authority-subprocess",
                "module": module_name,
                "doc": description,
            },
        })
    return discovered


def call_tool(registry: Any, tool_name: str, args: Dict[str, Any]) -> Any:
    func = registry._tools.get(tool_name)
    if not func:
        raise KeyError(f"tool not found: {tool_name}")

    with contextlib.redirect_stdout(sys.stderr):
        if inspect.iscoroutinefunction(func):
            return asyncio.run(func(**args))
        result = func(**args)
        if inspect.isawaitable(result):
            return asyncio.run(result)
        return result


def main() -> int:
    operation = sys.argv[1] if len(sys.argv) > 1 else "discover"
    payload = read_payload()
    modules = payload.get("modules") or DEFAULT_MODULES
    registry, loaded_modules, module_errors = load_registry(modules)

    try:
        if operation == "discover":
            response = {
                "ok": True,
                "healthy": len(loaded_modules) > 0 and len(registry._tools) > 0,
                "toolCount": len(registry._tools),
                "loadedModules": loaded_modules,
                "moduleErrors": module_errors,
                "tools": describe_tools(registry, loaded_modules),
            }
        elif operation == "health":
            response = {
                "ok": True,
                "healthy": len(loaded_modules) > 0 and len(registry._tools) > 0,
                "toolCount": len(registry._tools),
                "loadedModules": loaded_modules,
                "moduleErrors": module_errors,
            }
        elif operation == "call":
            tool_name = str(payload.get("toolName") or "")
            args = payload.get("args") or {}
            response = {
                "ok": True,
                "healthy": True,
                "toolCount": len(registry._tools),
                "toolName": tool_name,
                "result": sanitize(call_tool(registry, tool_name, args)),
                "loadedModules": loaded_modules,
                "moduleErrors": module_errors,
            }
        else:
            response = {
                "ok": False,
                "error": f"unsupported operation: {operation}",
            }
            print(json.dumps(response, ensure_ascii=False))
            return 1

        print(json.dumps(response, ensure_ascii=False, default=str))
        return 0
    except Exception as exc:  # pragma: no cover - defensive bridge behavior
        print(json.dumps({
            "ok": False,
            "error": str(exc),
            "operation": operation,
            "moduleErrors": module_errors,
        }, ensure_ascii=False, default=str))
        return 1


if __name__ == "__main__":
    sys.exit(main())
