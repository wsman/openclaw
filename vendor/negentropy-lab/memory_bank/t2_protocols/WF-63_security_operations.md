---
type: Workflow
id: WF-210
status: Active
relationships:
  implements: [LAW-PROC#§210]
  requires: [DS-016, DS-003, DS-005]
  related_to: [WF-207, WF-204]
tags: [security, ops, safety, incident-response]
---
# WF-210: 安全操作流程工作流程实现

**父索引**: [Development Workflow Index](../DEVELOPMENT_WORKFLOW.md)
**对应程序法条款**: §210
**宪法依据**: §161 (零信任权限模型), §396 (用户系统技术标准)
**版本**: v5.5.0 (Dual-Store Isomorphism)
**状态**: 🟡 规范定义成熟（运行态需按当前认证入口适配）

> **运行态说明**: 当前仓默认未提供独立的 `/api/auth/login` REST 登录端点；认证入口以 WebSocket RPC `auth.login`、`server/gateway/auth/*.ts` 中的网关认证模块，以及 `server/middleware/auth.ts` 提供的 Bearer JWT 中间件为主。

---

**适用场景**: 所有涉及用户认证、授权、前端安全、API安全、数据安全的操作。

### 概述

本流程定义系统在认证、授权、前端开发、API安全、数据保护等方面的标准操作程序。基于《基本法》§160（用户主权公理）、§161（零信任权限模型）和《技术法》§396（用户系统技术标准）制定，确保系统安全状态的合规性和低熵性。

### 核心安全原则

1. **零信任模型**: 默认拒绝所有未经明确授权的访问
2. **最小权限**: 用户仅获完成其任务所需的最小权限
3. **纵深防御**: 多层安全控制，单一防线失效不影响整体安全
4. **审计追踪**: 所有安全相关操作必须记录可审计的日志

### 认证与授权标准流程

#### 子流程1: 用户认证 (Authentication)

**输入**: 用户凭证 (用户名/密码)
**输出**: JWT令牌或错误响应

**步骤**:

1. [ ] **凭证接收**: 客户端通过安全连接发起认证；当前仓运行态以 WebSocket RPC `auth.login` 或 Bearer JWT 保护的 HTTP API 为主
2. [ ] **输入验证**: 
   - 验证用户名格式（如邮箱格式）
   - 验证密码复杂度（最小长度8字符）
   - 防止SQL注入和XSS攻击
3. [ ] **凭证验证**:
   - 查询认证配置（环境变量与网关配置，参考 `server/gateway/auth.ts`、`server/gateway/auth/index.ts`、`server/middleware/auth.ts`）
   - 使用 JWT 校验或网关口令校验；当前实现未维护独立用户数据库
   - 检查用户状态与权限范围（scope / permissions）
4. [ ] **令牌生成/校验**:
   - 若启用 `JWTAuthManager`，使用标准 JWT 配置生成/验证令牌
   - 令牌载荷应包含: `sub`(用户ID), `role`(角色), `permissions`(权限列表)
   - 有效期、issuer、audience 由网关 JWT 配置统一控制
5. [ ] **响应返回**:
   - 成功: HTTP 200，返回 `{ "token": "jwt_token", "user": { "id", "role" } }`
   - 失败: HTTP 401，返回错误信息（不泄露具体原因）

#### 子流程2: 权限验证中间件 (Authorization Middleware)

**应用范围**: 所有受保护的API路由

**实现模式**:

```javascript
// 中间件实现示例
const authMiddleware = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      // 1. 提取令牌
      const token = extractToken(req);
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }
      
      // 2. 验证令牌
      const decoded = verifyToken(token, process.env.JWT_SECRET);
      
      // 3. 检查过期时间
      if (decoded.exp < Date.now() / 1000) {
        return res.status(401).json({ error: 'Token expired' });
      }
      
      // 4. 权限检查
      if (requiredPermission && !decoded.permissions.includes(requiredPermission)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      // 5. 注入用户信息到请求上下文
      req.user = {
        id: decoded.sub,
        role: decoded.role,
        permissions: decoded.permissions
      };
      
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
};
```

**配置要求**:
- [ ] 所有受保护路由必须通过 `authenticateJWT`、`authAndPermission` 或等价鉴权中间件
- [ ] 敏感操作需要额外权限检查（如`admin`角色）
- [ ] 审计日志必须记录所有权限验证事件

### 前端安全标准流程

#### 子流程3: 页面保护 (Page Protection)

**适用**: 所有受保护的前端页面 (`supervision.html`, `lobby.html`等)

**实现步骤**:

1. [ ] **AuthGuard集成**:
   - 在 `<head>` 中引入 `auth.js`
   - 调用 `AuthGuard.init()` 初始化
2. [ ] **路由守卫**:
   ```javascript
   // 页面加载时检查
   document.addEventListener('DOMContentLoaded', () => {
     if (!AuthGuard.isAuthenticated()) {
       window.location.href = '/index.html?redirect=' + encodeURIComponent(window.location.pathname);
       return;
     }
     
     // 角色特定UI控制
     const userRole = AuthGuard.getUserRole();
     updateUIForRole(userRole);
   });
   ```
3. [ ] **权限感知UI**:
   - 根据用户角色动态显示/隐藏界面元素
   - 禁用无权限的操作按钮
   - 提供友好的"Access Denied"提示

#### 子流程4: 安全头配置 (Security Headers)

**要求**:
- [ ] 所有HTTP响应必须包含安全头:
  - `Content-Security-Policy`: 限制资源加载
  - `X-Frame-Options`: 防止点击劫持
  - `X-Content-Type-Options`: 防止MIME类型嗅探
  - `Strict-Transport-Security`: 强制HTTPS

### API安全标准流程

#### 子流程5: 端点分类与保护

**分类标准**:

| 端点类型 | 认证要求 | 示例 |
|---------|---------|------|
| 公开端点 | 无 | `/api/auth/*`, `/api/health` |
| 受保护端点 | JWT必需 | `/api/knowledge/*`, `/api/management/*` |
| 管理员端点 | JWT + admin角色 | `/api/admin/*`, `/api/system/*` |

**实施步骤**:
1. [ ] 在路由定义中明确指定权限要求
2. [ ] 使用中间件链确保多层验证
3. [ ] 定期审查端点权限配置

#### 子流程6: 输入验证与消毒

**要求**:
- [ ] 所有用户输入必须验证和消毒
- [ ] 使用参数化查询防止SQL注入
- [ ] 对输出进行HTML编码防止XSS
- [ ] 限制文件上传类型和大小

### 数据安全标准流程

#### 子流程7: 密码存储标准

**强制要求**:
- [ ] 使用 `bcrypt` 哈希算法（盐轮次 ≥ 10）
- [ ] **严禁明文存储**密码
- [ ] 定期评估哈希算法强度

**实现示例**:
```javascript
const bcrypt = require('bcrypt');
const saltRounds = 10;

// 密码哈希
async function hashPassword(password) {
  return await bcrypt.hash(password, saltRounds);
}

// 密码验证
async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}
```

#### 子流程8: 用户数据管理

**存储标准**:
- [ ] 认证配置来源明确（环境变量 + `server/gateway/config.ts`）
- [ ] 遵循 §302.1 原子写入标准
- [ ] 定期备份用户数据

**操作要求**:
- [ ] 所有用户操作必须通过 `AuthService` 进行
- [ ] 记录用户创建、修改、删除操作
- [ ] 支持用户禁用而非删除（软删除）

### 紧急响应流程

#### 子流程9: 安全事件处理

**检测阶段**:
- [ ] 监控异常登录尝试（如频繁失败）
- [ ] 检测权限滥用模式
- [ ] 审计日志异常分析

**响应阶段**:
1. [ ] **立即行动**: 撤销受影响用户的令牌
2. [ ] **调查分析**: 分析审计日志，确定攻击向量
3. [ ] **修复措施**: 修补安全漏洞，更新安全策略
4. [ ] **通知报告**: 通知相关人员和记录事件报告

**恢复阶段**:
- [ ] **数据泄露**: 强制所有用户重新认证
- [ ] **权限错误**: 回滚到最近的已知安全状态
- [ ] **服务中断**: 保持认证服务高可用性

### 审计要求

**对应宪法条款**: §136 (强制审计)

#### 审计日志字段

**强制记录字段**:
- **事件类型**: `[AUTH]`, `[DENY]`, `[WARN]`, `[INFO]`
- **用户ID**: 操作用户标识
- **操作描述**: 具体的安全操作
- **资源标识**: 访问的资源（如知识库ID）
- **权限检查**: 请求的权限与授予的权限
- **时间戳**: 操作时间（ISO 8601）
- **IP地址**: 请求来源IP
- **结果状态**: 成功/失败

#### 审计频率
- **实时记录**: 所有安全操作必须实时记录
- **每日审查**: 安全团队每日审查关键安全事件
- **月度报告**: 生成月度安全审计报告

### 开发检查清单

#### 创建新页面时
- [ ] 在 `<head>` 中引入 `auth.js`
- [ ] 验证 AuthGuard 自动保护功能
- [ ] 测试未登录时的重定向行为
- [ ] 验证角色特定UI控制

#### 创建新 API 端点时
- [ ] 添加认证中间件验证
- [ ] 实现适当的权限检查
- [ ] 添加输入验证和消毒
- [ ] 添加审计日志记录

#### 处理用户数据时
- [ ] 使用 `bcrypt` 哈希密码
- [ ] 通过 `AuthService` 进行用户操作
- [ ] 遵循原子写入原则
- [ ] 记录所有用户数据变更

### 测试与验证

#### 安全测试场景

1. **认证测试**:
   - 有效凭证应成功认证
   - 无效凭证应被拒绝（不泄露具体原因）
   - 过期令牌应被拒绝

2. **授权测试**:
   - 无令牌访问受保护端点应被拒绝
   - 无效令牌应被拒绝
   - 权限不足应返回403

3. **前端安全测试**:
   - 未认证用户访问受保护页面应重定向
   - UI元素应根据用户角色正确显示/隐藏
   - 客户端验证不能替代服务器验证

#### 测试频率
- **单元测试**: 每次代码变更时执行安全测试
- **集成测试**: 每周执行完整安全流程测试
- **渗透测试**: 每季度执行第三方安全审计

### 维护指南

1. **定期审查**: 每月审查安全策略和配置
2. **依赖更新**: 及时更新安全相关依赖
3. **员工培训**: 定期进行安全意识和最佳实践培训
4. **应急演练**: 每半年进行安全应急响应演练

---

**遵循逆熵实验室宪法约束: 代码即数学证明，架构即宪法约束。**
