# 配置模板库

本目录包含Agent配置模板。

## 标准模板

### l1-simple.json
L1简单任务配置模板 - 适合快速原型开发和简单分析

**配置**:
- 超时: 900秒（15分钟）
- 深度: 3
- 模型: google-antigravity/gemini-3-flash

### l2-medium.json
L2中等任务配置模板 - 适合中等复杂度的数据处理和分析

**配置**:
- 超时: 1800秒（30分钟）
- 深度: 4
- 模型: google-antigravity/gemini-3-pro-high

### l3-complex.json
L3复杂任务配置模板 - 适合系统集成、架构设计、复杂业务逻辑

**配置**:
- 超时: 2700秒（45分钟）
- 深度: 5
- 模型: google-antigravity/gemini-3-pro-high

### l4-ultra.json
L4超复杂任务配置模板 - 适合长期项目、大规模开发、战略级任务

**配置**:
- 超时: 无限制
- 深度: 6
- 模型: google-antigravity/gemini-3-pro-high

## 自定义模板

将自定义模板保存到 `custom/` 目录。

自定义模板会自动包含在模板列表中。

## 模板格式

所有模板必须遵循以下格式：

```json
{
  "templateVersion": "1.0.0",
  "templateId": "unique-template-id",
  "description": "Template description",
  "taskComplexity": "L1|L2|L3|L4",
  "createdAt": "2026-02-12T17:10:00.000Z",
  "updatedAt": "2026-02-12T17:10:00.000Z",
  "model": "model-name",
  "runTimeoutSeconds": 900,
  "maxSpawnDepth": 3,
  "tags": ["tag1", "tag2"],
  "author": "author-name",
  "category": "standard|custom"
}
```

## 创建新模板

### 使用CLI

```bash
npx ts-node config/config-cli.ts create \
  --name my-template \
  --complexity L2 \
  --model google-antigravity/gemini-3-pro-high \
  --timeout 1800 \
  --depth 4 \
  --custom
```

### 手动创建

1. 复制一个标准模板
2. 修改配置参数
3. 保存到 `custom/` 目录
4. 使用CLI验证: `npx ts-node config/config-cli.ts validate my-template`

## 验证模板

```bash
# 验证单个模板
npx ts-node config/config-cli.ts validate l2-medium

# 验证所有模板
npx ts-node config/config-cli.ts validate-batch
```

## 更多信息

- [完整文档](../../docs/CONFIG_TEMPLATE_SYSTEM.md)
- [配置系统README](../README.md)
