# MC-009: MCP服务器配置与运维

**父索引**: [MCP参考索引](../mcp_reference_index.md)
**版本**: v7.0.0 (Negentropy-Lab)
**宪法依据**: §131 (MCP绝对冷启动原则), §132 (MCP架构原则)
**开发标准引用**: DS-07 (MCP服务标准实现), DS-08 (依赖注入配置标准实现)
**最后更新**: 2026-02-11

---

## 1. 概述

MCP服务器配置与运维文档提供MCP微内核的安装、配置、启动、监控和故障排除指南。本文档遵循 **§131 MCP绝对冷启动原则** 和 **§132 MCP架构原则**，确保MCP服务的稳定运行和宪法合规性。

### 1.1 服务定位
- **微内核层**: 位于七层架构的L1.5感知层
- **协议桥梁**: 连接Python智能层与外部AI工具
- **工具治理**: 实现三级工具治理体系

### 1.2 架构拓扑
```
用户 → Node.js编排层 → 文件系统(全文本) ↔ Python智能层 → Qdrant(语义索引)
```

---

## 2. 安装与配置

### 2.1 环境要求
- **Python**: 3.9+
- **依赖项**: 参见 `engine/entropy_service/requirements.txt`（当前仓库未单独维护 mcp_core 专用 requirements 文件）
- **编码配置**: 必须配置UTF-8输出编码（遵循§301.1）

### 2.2 安装步骤
```bash
# 1. 进入项目目录（假设在项目根目录执行）
cd .  # 或 cd Negentropy-Lab

# 2. 安装Python依赖
pip install -r engine/entropy_service/requirements.txt

# 3. 验证安装
python -c "from mcp_core.server import MCP_SERVER; print('MCP服务器就绪')"
```

### 2.3 配置文件
```yaml
# storage/config/negentropy.yaml 中的MCP配置节
mcp:
  server:
    host: "127.0.0.1"
    port: 8080
    encoding: "utf-8"
    log_level: "INFO"
  tools:
    registry_file: "storage/config/tool_registry.json"
    auto_discover: true
```

---

## 3. 启动与运行

### 3.1 冷启动流程（遵循§131）
```python
# engine/mcp_core/server.py 中的冷启动代码
def cold_start_mcp():
    """遵循§131 MCP绝对冷启动原则的启动流程"""
    # 1. 编码配置（§124编码一致性公理）
    configure_utf8_encoding()
    
    # 2. 路径计算（七层架构兼容性）
    root_path = compute_project_root()
    
    # 3. 依赖注入（§333依赖注入标准）
    container = setup_dependency_injection()
    
    # 4. 工具注册（§331工具注册规范）
    registry = register_all_tools()
    
    # 5. 服务启动
    server = MCP_SERVER(registry)
    server.start()
    
    return server
```

### 3.2 启动命令
```bash
# 使用Python直接启动（假设在项目根目录执行）
python engine/mcp_core/server.py

# 或通过生态系统配置（PM2）
pm2 start config/cli/ecosystem.config.js --name mcp-server
```

### 3.3 健康检查
```bash
# 检查服务状态
curl http://127.0.0.1:8080/health

# 预期响应
{
  "status": "healthy",
  "version": "v7.0.0",
  "tools_registered": 25,
  "uptime_seconds": 3600
}
```

---

## 4. 工具治理

### 4.1 三级治理体系（遵循§132）
| 层级 | 工具类型 | 调用时机 | 示例工具 |
|------|----------|----------|----------|
| Tier 1 | 核心工具 | CDD强制调用 | `judicial_verify_structure` |
| Tier 2 | 辅助工具 | 按需调用 | `consult_oracle` |
| Tier 3 | 管理工具 | 基础设施运维 | `list_projects` |

### 4.2 工具注册规范
```python
# 工具注册示例（遵循§331）
from mcp_core.registry import registry

@registry.register()
def judicial_verify_structure(system_patterns_path=None):
    """架构同构性验证工具"""
    # 工具实现
    pass
```

---

## 5. 监控与日志

### 5.1 监控指标
- **服务健康度**: HTTP 200响应率
- **工具调用统计**: 调用次数、成功率、平均响应时间
- **资源使用**: 内存、CPU、网络IO
- **协议完整性**: JSON-RPC协议合规率

### 5.2 日志配置
```python
# logging_config.py
import logging

def setup_mcp_logging():
    """MCP专用日志配置"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [MCP] %(levelname)s: %(message)s',
        handlers=[
            logging.FileHandler('logs/mcp_server.log'),
            logging.StreamHandler(sys.stderr)  # 注意：日志到stderr，遵循§337
        ]
    )
```

---

## 6. 故障排除

### 6.1 常见问题

#### 问题1: 编码错误（Linux环境）
**症状**: `UnicodeEncodeError: 'ascii' codec can't encode character...`

**解决方案**:
```python
# 确保在server.py开头配置UTF-8编码
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
```

#### 问题2: 工具注册失败
**症状**: `Tool registration failed: duplicate name`

**解决方案**:
```bash
# 清理工具注册表
python -c "from mcp_core.registry import registry; registry.clear()"
# 重启MCP服务
```

#### 问题3: 协议污染
**症状**: MCP客户端连接失败，发现非JSON输出

**解决方案**:
```python
# 检查所有print语句，确保日志使用logging模块
# 而不是直接print到stdout
import logging
logging.info("信息日志")  # 正确
print("直接输出")  # 错误！会污染JSON-RPC协议
```

---

## 7. 相关资源

### 7.1 文档链接
- [DS-200: MCP概览与宪法基础](./DS-200_mcp_overview.md)
- [DS-06: MCP工具策略标准实现](./DS-06_mcp_tool_strategy.md)
- [DS-07: MCP服务标准实现](./DS-07_mcp_service.md)
- [DS-08: 依赖注入配置标准实现](./DS-08_dependency_injection_config.md)

### 7.2 宪法依据
- [基本法 §130-§132](../t0_core/basic_law_index.md)
- [技术法 §331-§337](../t0_core/technical_law_index.md)

---

**文档状态**: ✅ 完整  
**宪法合规**: ✅ 符合§131-§132 MCP运维标准  
**操作指南**: ✅ 提供完整安装、配置、运维流程  
**故障排除**: ✅ 覆盖常见问题和解决方案  
**移植来源**: MY-DOGE-DEMO v5.5.0

*遵循逆熵实验室宪法约束: 运维即保障，稳定即生命线。*
