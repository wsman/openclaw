# Negentropy-Lab 部署指南

**版本**: v7.6.0-dev
**更新日期**: 2026-03-07
**维护者**: 科技部

---

## 1. 概述

本文档提供 Negentropy-Lab Gateway 系统的生产环境部署指南。

### 1.1 系统要求

| 组件 | 最低要求 | 推荐配置 |
|------|----------|----------|
| Node.js | v18.x | v20.x LTS |
| 内存 | 2GB | 4GB+ |
| 存储 | 10GB | 20GB+ |
| CPU | 2核 | 4核+ |

### 1.2 依赖服务

- **Redis**: 会话存储和缓存（可选，可在当前环境回退到 mock/本地模式）
- **Qdrant**: 向量数据库（向量检索/知识图谱链路使用）
- **PostgreSQL**: 非默认运行时依赖，仅作为外部扩展存储规划

---

## 2. 快速部署

### 2.1 使用 Docker Compose（推荐）

```bash
# 克隆仓库
git clone https://github.com/wsman/Negentropy-Lab.git
cd Negentropy-Lab

# 准备环境变量
# 仓库未维护统一 `.env.example`，请按第 3 节手动创建 `.env`
# 或在部署系统中直接注入所需环境变量

# 启动服务
docker compose -f docker-compose.production.yml up -d

# 查看日志
docker compose -f docker-compose.production.yml logs -f gateway
```

### 2.2 手动部署

```bash
# 安装依赖
npm ci --production

# 构建项目
npm run build

# 启动服务
npm start
```

---

## 3. 环境配置

### 3.1 必需环境变量

```bash
# 服务配置
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# 认证配置
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=24h

# LLM 配置
OPENAI_API_KEY=your-openai-api-key
DEEPSEEK_API_KEY=your-deepseek-api-key

# Redis 配置
REDIS_URL=redis://localhost:6379
```

### 3.2 可选环境变量

```bash
# 日志级别
LOG_LEVEL=info

# 性能监控
ENABLE_PERF_METRICS=true

# 宪法合规检查
ENABLE_CONSTITUTION_CHECK=true

# WebSocket 配置
WS_HEARTBEAT_INTERVAL=30000
WS_MAX_CONNECTIONS=10000
```

---

## 4. 服务管理

### 4.1 启动服务

```bash
# 开发模式（主入口，Colyseus/API-only）
npm run dev:colyseus

# 开发模式（轻量 HTTP + /ws）
npm run dev

# 生产模式（主入口）
npm run start:colyseus

# 生产模式（轻量入口）
npm start

# 使用 PM2
pm2 start node --name "negentropy-colyseus" -- dist/server/index.js
```

### 4.2 停止服务

```bash
# PM2 优雅停止
pm2 stop negentropy-gateway

# 直接进程停止（无 PM2）
pkill -f "node.*dist/index.js"
```

### 4.3 健康检查

```bash
# HTTP 健康检查
curl http://localhost:3000/health

# 如独立 Gateway(4514) 已单独启动，可额外检查
curl http://localhost:4514/health
```

---

## 5. 监控与日志

### 5.1 日志位置

```
logs/
├── application.log    # 应用日志
├── error.log         # 错误日志
├── access.log        # 访问日志
└── constitution.log  # 宪法合规日志
```

### 5.2 Prometheus 指标

默认运行态不暴露统一 `/metrics` 端点。若独立 Gateway 进程已启动，可通过 `/api/websocket/stats` 查看连接统计：

```bash
curl http://localhost:4514/api/websocket/stats
```

### 5.3 关键指标

| 指标名称 | 说明 | 告警阈值 |
|----------|------|----------|
| `gateway_requests_total` | 总请求数 | - |
| `gateway_request_duration_ms` | 请求延迟 | P95 > 500ms |
| `gateway_active_connections` | 活跃连接数 | > 8000 |
| `gateway_error_rate` | 错误率 | > 1% |

---

## 6. 安全配置

### 6.1 TLS/SSL

推荐使用反向代理（如 Nginx）处理 TLS：

```nginx
server {
    listen 443 ssl;
    server_name gateway.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 6.2 防火墙配置

```bash
# 开放端口
ufw allow 3000/tcp
ufw allow 443/tcp
```

---

## 7. 故障排查

### 7.1 常见问题

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 服务无法启动 | 端口被占用 | 检查端口占用，修改配置 |
| 连接超时 | 网络问题 | 检查防火墙和网络配置 |
| 内存不足 | 连接数过多 | 增加内存或限制连接数 |
| 认证失败 | JWT 配置错误 | 检查 JWT_SECRET 配置 |

### 7.2 诊断命令

```bash
# 检查服务状态
npm run launch -- preflight

# 查看实时日志
tail -f logs/application.log

# 检查宪法合规
npm run check:constitution
npm run check:consistency -- --strict --timeout-ms 120000
npm run check:contract:strict

# Phase 14 联调与性能基线
npm run check:integration:config   # 需先配置 OPENCLAW_PROJECT_PATH / OPENDOGE_UI_PATH
npm run phase14:e2e
npm run phase14:perf
```

---

## 8. 发布前预检与回滚验证（Phase 6）

### 8.1 部署前预检（staging/production）

```bash
# staging 预检（默认包含主干核心回归）
npm run ops:preflight

# production 预检（可选跳过测试，仅做静态门禁）
bash ./scripts/deploy-preflight-check.sh --env production --skip-tests
```

### 8.2 回滚后验证

```bash
# 离线验证（契约/合规门禁）
npm run ops:rollback:verify

# 在线验证（额外检查健康探针）
bash ./scripts/rollback-verify.sh --live --health-url http://localhost:3000/health
```

---

## 9. 宪法合规

系统部署必须遵循以下宪法条款：

- **§101 同步公理**: 确保状态同步配置正确
- **§102 熵减原则**: 监控系统熵值变化
- **§306 零停机协议**: 配置优雅关闭和健康检查
- **§504 监控系统公理**: 启用 Prometheus 指标收集

---

## 10. 联系支持

如有问题，请联系：
- GitHub Issues: https://github.com/wsman/Negentropy-Lab/issues
- 文档: `/docs` 目录
