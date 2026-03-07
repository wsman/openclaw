# 工作流JSON架构设计标准 (DS-08)

**版本**: v1.0.0  
**状态**: 🟢 活跃  
**类型**: 开发标准 (Development Standard)  
**宪法依据**: §201 Agent协作流程、§206 三位一体收敛协议  
**来源文档**: WORKFLOW_FEATURE_DESIGN.md (核心数据结构部分)  
**制定者**: 办公厅主任 (Director of General Office)  
**批准人**: 元首 (User)  
**执行者**: 科技部 (Technology Ministry)

---

## 🎯 标准目标

规范自定义智能体工作流 (UDAW) 的 JSON Schema 设计标准，确保工作流模板的数据结构一致性、可扩展性和可验证性，为用户定义、执行和监控复杂工作流提供标准化的数据格式。

## 📋 核心要求

### 1. 数据完整性
- **Schema 验证**: 所有工作流模板必须通过 JSON Schema 验证
- **类型安全**: 严格的类型定义和约束检查
- **引用完整性**: 步骤间依赖关系正确性验证
- **输入输出约束**: 明确的输入输出变量定义

### 2. 可扩展性
- **向后兼容**: Schema 变更保持向后兼容
- **插件机制**: 支持自定义步骤类型和验证器
- **元数据扩展**: 支持自定义元数据字段
- **版本管理**: 清晰的 Schema 版本标识

### 3. 可读性
- **文档内联**: Schema 中包含完整的文档注释
- **示例丰富**: 提供典型使用场景的示例
- **工具支持**: 支持 IDE 智能提示和验证
- **错误清晰**: 验证失败提供清晰的错误信息

## 🛠️ JSON Schema 规范

### 1. WorkflowTemplate 根对象
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://negentropy-lab.org/schemas/workflow-template/v1.0.0",
  "title": "工作流模板",
  "description": "定义自定义智能体工作流的模板结构",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[a-z0-9-_]+$",
      "description": "工作流唯一标识符，仅允许小写字母、数字、连字符和下划线"
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100,
      "description": "工作流显示名称"
    },
    "version": {
      "type": "string",
      "pattern": "^v\\d+\\.\\d+\\.\\d+$",
      "description": "模板版本号，遵循语义化版本规范"
    },
    "trigger": {
      "type": "string",
      "enum": ["manual", "webhook", "schedule"],
      "description": "工作流触发方式：manual(手动)、webhook(Webhook触发)、schedule(定时触发)"
    },
    "inputs": {
      "$ref": "#/definitions/inputDefinitions"
    },
    "steps": {
      "$ref": "#/definitions/workflowSteps"
    },
    "checkpoints": {
      "$ref": "#/definitions/checkpointDefinitions"
    }
  },
  "required": ["id", "name", "version", "steps"],
  "additionalProperties": false
}
```

### 2. 输入定义 (Input Definitions)
```json
{
  "inputDefinitions": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "pattern": "^[a-zA-Z_][a-zA-Z0-9_]*$",
          "description": "输入变量名称，遵循变量命名规范"
        },
        "type": {
          "type": "string",
          "enum": ["string", "number", "boolean", "object", "array"],
          "description": "输入数据类型"
        },
        "description": {
          "type": "string",
          "description": "输入变量的详细说明"
        },
        "required": {
          "type": "boolean",
          "default": true,
          "description": "是否为必填输入"
        },
        "default": {
          "description": "默认值，类型需与type字段匹配"
        },
        "validation": {
          "type": "object",
          "description": "输入验证规则"
        }
      },
      "required": ["name", "type", "description"]
    }
  }
}
```

### 3. 工作流步骤 (Workflow Steps)
```json
{
  "workflowSteps": {
    "type": "array",
    "minItems": 1,
    "items": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-z0-9-_]+$",
          "description": "步骤唯一标识符"
        },
        "name": {
          "type": "string",
          "description": "步骤显示名称"
        },
        "agent": {
          "type": "string",
          "pattern": "^agent:[a-z_]+$",
          "description": "执行此步骤的Agent标识符，格式：agent:{agent_type}"
        },
        "instruction": {
          "type": "string",
          "description": "执行指令，支持变量插值语法 {{variable.name}}"
        },
        "output_var": {
          "type": "string",
          "pattern": "^[a-zA-Z_][a-zA-Z0-9_]*$",
          "description": "步骤输出的变量名称"
        },
        "depends_on": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z0-9-_]+$"
          },
          "description": "依赖的步骤ID列表，确保执行顺序"
        },
        "timeout": {
          "type": "integer",
          "minimum": 1,
          "description": "步骤执行超时时间（秒）"
        },
        "retry_policy": {
          "type": "object",
          "properties": {
            "max_attempts": {
              "type": "integer",
              "minimum": 1,
              "default": 1
            },
            "backoff_factor": {
              "type": "number",
              "minimum": 1
            },
            "retry_on": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": ["timeout", "error", "validation_failed"]
              }
            }
          }
        }
      },
      "required": ["id", "agent", "instruction"]
    }
  }
}
```

### 4. 检查点定义 (Checkpoint Definitions)
```json
{
  "checkpointDefinitions": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^chk_[a-z0-9-_]+$",
          "description": "检查点唯一标识符，前缀chk_"
        },
        "target_step": {
          "type": "string",
          "pattern": "^[a-z0-9-_]+$",
          "description": "验收的目标步骤ID"
        },
        "validator": {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "enum": ["llm", "human", "automated"],
              "description": "验证器类型：llm(LLM模型)、human(人工验收)、automated(自动规则)"
            },
            "model": {
              "type": "string",
              "description": "当type为llm时，指定使用的模型标识符"
            },
            "temperature": {
              "type": "number",
              "minimum": 0,
              "maximum": 2,
              "default": 0.1
            },
            "prompt_template": {
              "type": "string",
              "description": "验证提示词模板，支持变量插值"
            }
          },
          "required": ["type"]
        },
        "criteria": {
          "type": "string",
          "description": "验收标准描述，人类可读的验收条件"
        },
        "on_pass": {
          "type": "string",
          "enum": ["proceed", "notify", "pause"],
          "default": "proceed",
          "description": "通过后的动作：proceed(继续)、notify(通知并继续)、pause(暂停等待确认)"
        },
        "on_fail": {
          "type": "string",
          "enum": ["retry_step", "abort_workflow", "notify_and_pause"],
          "default": "retry_step",
          "description": "失败后的动作：retry_step(重试步骤)、abort_workflow(终止工作流)、notify_and_pause(通知并暂停)"
        },
        "max_retries": {
          "type": "integer",
          "minimum": 0,
          "default": 3,
          "description": "最大重试次数"
        },
        "failure_threshold": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "default": 0.7,
          "description": "验收通过阈值（0-1）"
        }
      },
      "required": ["id", "target_step", "validator", "criteria"]
    }
  }
}
```

## 📝 变量插值语法

### 1. 变量引用格式
- **输入变量**: `{{inputs.variable_name}}`
- **步骤输出**: `{{step_id.output_var}}`
- **系统变量**: `{{system.timestamp}}`, `{{system.workflow_id}}`
- **环境变量**: `{{env.VARIABLE_NAME}}`

### 2. 插值规则
- **类型安全**: 变量类型必须与上下文匹配
- **作用域**: 变量作用域限制在当前工作流实例
- **解析时机**: 运行时动态解析，支持嵌套引用
- **错误处理**: 变量不存在时提供清晰错误信息

## ✅ 验收标准

### 功能验收
1. **Schema 验证**: 所有工作流模板必须通过 JSON Schema 验证
2. **变量插值**: 变量插值语法正确解析和执行
3. **依赖检查**: 步骤间依赖关系正确性验证
4. **检查点工作**: 验收检查点正确触发和执行

### 质量验收
1. **类型安全**: 完整的 TypeScript 类型定义
2. **文档完整**: Schema 包含完整的文档注释和示例
3. **工具支持**: 支持主流 IDE 的智能提示和验证
4. **错误友好**: 验证错误信息清晰、可操作

### 性能验收
1. **验证速度**: JSON Schema 验证时间 < 100ms
2. **解析效率**: 变量插值解析时间 < 50ms
3. **内存使用**: 大型工作流模板内存占用 < 10MB
4. **序列化**: JSON 序列化/反序列化性能达标

## 🔄 实施流程

### 步骤 1: Schema 定义
1. **创建完整 JSON Schema**: 基于上述规范
2. **生成 TypeScript 类型**: 使用 json-schema-to-typescript 工具
3. **验证工具实现**: 创建命令行验证工具
4. **文档生成**: 自动生成 API 文档

### 步骤 2: 运行时集成
1. **解析器实现**: 工作流模板解析器
2. **变量引擎**: 变量插值引擎实现
3. **验证集成**: 集成到 WorkflowEngine
4. **测试套件**: 完整的单元和集成测试

### 步骤 3: 工具链建设
1. **CLI 工具**: 工作流模板验证和格式化工具
2. **IDE 插件**: VS Code 扩展支持
3. **模板库**: 官方工作流模板库
4. **迁移工具**: 版本迁移工具

## 📊 质量指标

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| Schema 覆盖率 | 100% | 功能点检查 |
| 类型安全度 | 100% | TypeScript 编译检查 |
| 验证通过率 | > 99% | 测试用例通过率 |
| 文档完整性 | > 95% | 文档检查清单 |
| 性能达标率 | > 95% | 性能测试结果 |

## 🔗 相关标准

- **DS-09**: Agent调度器设计标准
- **WF-04**: UDAW核心引擎开发流程
- **AS-101**: Agent接口规范标准
- **LS-301**: Agent能力增强标准
- **TS-102**: 消息序列化格式标准

---

**更新记录**:
- **2026-02-09**: 标准创建，基于 WORKFLOW_FEATURE_DESIGN.md 核心数据结构部分

**实施状态**:
- [ ] JSON Schema 完整定义
- [ ] TypeScript 类型生成
- [ ] 验证工具实现
- [ ] 运行时集成完成
- [ ] 文档和示例完成

*遵循宪法约束: 数据即结构，Schema即契约，标准即信任。*