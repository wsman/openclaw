# LLM集成规范目录

**宪法依据**: §108 异构模型策略、§192 模型选择器公理、§193 模型选择器更新公理

本目录定义Negentropy-Lab系统中LLM（大语言模型）集成的标准和规范。

## 支持的LLM提供商

| 提供商 | 模型 | 能力类型 | 成本等级 |
|--------|------|----------|----------|
| **DeepSeek** | deepseek-chat | reasoning, coding | 低 |
| **OpenAI** | gpt-4, gpt-3.5-turbo | general, creative | 高 |
| **Anthropic** | claude-3 | reasoning, creative | 中 |
| **Ollama** | 本地模型 | general | 免费 |

## 核心服务组件

- **LLMService**: 统一的LLM调用服务
- **ModelSelectorService**: 智能模型选择器
- **PythonWorkerBridge**: Python MCP桥接服务

## 接口标准

- `IModelSelector`: 模型选择器接口
- `ILLMService`: LLM服务接口
- `IProviderAdapter`: 提供商适配器接口

---

*最后更新: 2026-02-25*