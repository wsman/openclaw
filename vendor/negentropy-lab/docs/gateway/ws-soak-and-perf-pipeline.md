# WebSocket 长稳与性能管线（WF-3）

## 目标

- SP-01: 固化 WebSocket 长稳（soak）脚本
- SP-02: 固化吞吐/延迟性能基线脚本
- SP-03: 固化 CI 双层门禁（Level A / Level B）

## 本地执行

### 1. Soak 测试

```bash
./scripts/ws-soak.sh --iterations 48 --interval-sec 1800
```

快速冒烟（CI 用）:

```bash
./scripts/ws-soak.sh --iterations 1 --interval-sec 1
```

输出:
- `reports/ws-soak-<timestamp>.log`
- `reports/ws-soak-<timestamp>.json`

### 2. 性能基线

```bash
./scripts/ws-perf-baseline.sh
```

输出:
- `reports/ws-perf-baseline-<timestamp>.log`
- `reports/ws-perf-baseline-<timestamp>.json`

## CI 门禁

工作流文件: `.github/workflows/gateway-dual-gates.yml`

- Level A（PR/Push）
  - 主干 Gateway 回归
  - `check:constitution`
  - `check:consistency --strict`

- Level B（main 分支/定时）
  - 全量回归
  - E2E
  - soak smoke（1次）
  - 性能基线

## 验收口径

- Level A 必须全绿，作为 PR 合并门禁。
- Level B 每日定时执行，失败需在下一工作日修复或登记风险。
- 产物必须上传用于趋势比对和回溯。
