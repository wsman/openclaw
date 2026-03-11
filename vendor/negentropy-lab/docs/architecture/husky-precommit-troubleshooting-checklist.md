# Husky Pre-commit 误拦排查清单

## 1. 目的

本文用于排查本仓库中 `Husky pre-commit` 对 `docs-only` 或小型改动的误拦，目标是先定位真实失败点，再判断是否为检查范围过大、环境差异或规则分级不合理，最后按最小修复原则处理。

相关文档：

- `docs/architecture/husky-gate-observation-checklist.md`

一句话结论模板：

> 在 `Windows + 当前 shell` 下，提交 `docs-only` 改动时，`pre-commit` 执行 `某命令` 返回非 `0`，但失败与本次提交内容无直接关系。

## 2. 当前仓库门禁基线

当前仓库将本地门禁分为两层：

1. `.husky/pre-commit`
2. `.husky/pre-push`

对应脚本入口：

- `package.json` -> `check:constitution`: `node scripts/constitution-check.js`
- `package.json` -> `check:consistency`: `node scripts/consistency-check.js --strict`

当前行为特征：

- `pre-commit` 只执行 `git diff --cached --check` 作为 staged-only 快速检查
- `pre-commit` 会识别 `docs-only` staged 集合，并跳过仓库级治理检查
- `pre-push` 会执行 `check:constitution`
- `pre-push` 会执行 `check:consistency -- --timeout-ms 120000`
- `check:constitution` 会扫描仓库中的代码目录、文档目录和 `memory_bank`，并生成 `constitution-compliance-report.json`
- `check:consistency --strict` 会根据 `config/consistency-rules.json` 进行仓库级一致性检查，并生成 `reports/consistency-check-report.json` 与 `reports/consistency-check-report.html`
- `check:consistency --strict` 在以下任一条件成立时返回非 `0`：
  - 存在 failed checks
  - 一致性分数低于 `thresholds.pass`
  - 执行耗时超过超时阈值
- `check:constitution` 在总体合规率低于 `80` 时返回非 `0`

这意味着当前 `pre-commit` 已保持 staged-only 和轻量；仓库级治理门禁主要在 `pre-push` 与 CI 执行。

## 3. 快速留证

误拦发生时先记录以下信息：

- [ ] 失败钩子：`pre-commit` / `commit-msg` / `pre-push`
- [ ] 提交类型：`docs-only` / `code-only` / `mixed`
- [ ] 是否使用过 `HUSKY=0`
- [ ] 是明确的非 `0` 退出，还是 warning 被误判为失败
- [ ] 当前 shell：`PowerShell` / `cmd` / `Git Bash`
- [ ] 是否稳定复现
- [ ] staged 文件是否只有文档
- [ ] 工作区是否存在未 staged 的无关改动

建议保存以下命令输出：

```powershell
git status --short
git diff --cached --name-only
npm --version
node --version
python --version
```

## 4. 先确认到底是谁拦的

不要只写“被 Husky 拦了”，要定位到具体子命令。

检查顺序：

- [ ] `.husky/pre-commit`
- [ ] `.husky/pre-push`
- [ ] `package.json` 中 `check:constitution` 与 `check:consistency`
- [ ] `scripts/constitution-check.js`
- [ ] `scripts/consistency-check.js`
- [ ] `config/consistency-rules.json`

在当前仓库里，优先回答下面两个问题：

- [ ] 真正失败的是 `check:constitution` 还是 `check:consistency`
- [ ] 失败是由仓库级扫描导致，还是由 shell / PATH / 可选依赖导致

## 5. 手动逐层重跑

把 Husky 的重检查步骤拆开执行，不要一次串起来：

```powershell
npm run check:constitution
Write-Host "constitution exit code: $LASTEXITCODE"

npm run check:consistency
Write-Host "consistency exit code: $LASTEXITCODE"
```

如果你在 `Git Bash` 中复现，也记录一次：

```bash
npm run check:constitution; echo $?
npm run check:consistency; echo $?
```

目标结论应当是下面这种格式：

> 真正失败的是 `X`，Husky 只是外层放大器，不是根因本身。

## 6. 判断是否为 docs-only 误伤

本仓库当前最值得优先排查的是“`docs-only` 改动是否被错误地走进重检查路径”。

执行以下对比：

- [ ] 仅 stage 文档文件，再次提交
- [ ] 仅 stage 一个最小文档变更，再次提交
- [ ] stage 一个最小代码变更，对比行为差异
- [ ] 确认 `git diff --cached --name-only` 是否只包含文档

如果出现以下任一情况，可优先判为误伤：

- [ ] `docs-only` 提交在 `pre-commit` 中未走轻量路径
- [ ] `docs-only` 推送在 `pre-push` 或 CI 中触发了与本次变更无关的仓库级检查失败
- [ ] `docs-only` 提交被工作区中未 staged 的无关问题影响
- [ ] 输出只有 warning，但最终被包装成失败
- [ ] 命令本体在当前 shell 通过，但在 Husky 环境失败

## 7. 环境差异检查

如果手动执行与 Husky 执行结果不一致，重点看环境差异：

- [ ] `PowerShell`、`cmd`、`Git Bash` 行为是否一致
- [ ] Husky 执行时是否缺少 `node`、`npm`、`python`、`npx`
- [ ] Windows 路径分隔符或 shell 转义是否影响命令执行
- [ ] Python 或 Node 可选依赖 warning 是否被错误放大为失败
- [ ] 报错到底是 warning 文本，还是命令真实退出非 `0`

已知需要特别区分的噪音信号：

- Python `RequestsDependencyWarning`
- `ts-jest` 的 `isolatedModules` 弃用告警

这些信号本身不等于提交必须失败，必须结合真实退出码判断。

## 8. 最小修复优先级

确认根因后，优先做最小修复，不要先重写整套 hooks。

### A. `docs-only` 被仓库级检查误伤

- [ ] 给 `docs-only` 提交保留轻量路径
- [ ] 用 `git diff --cached --name-only` 驱动 `pre-commit` 分流，而不是默认跑全仓门禁
- [ ] 将重型治理检查保留在 `pre-push` 或 CI

### B. staged-only 边界失真

- [ ] 避免检查未 staged 的无关改动
- [ ] 避免在 `pre-commit` 中隐含“工作区必须完全干净”的前提
- [ ] 只对本次提交相关文件类型执行对应规则

### C. 环境依赖缺失

- [ ] 对可选依赖先做 presence check
- [ ] 非关键能力降级为 warning，不直接 fail
- [ ] 在脚本输出中明确前置条件和建议修复动作

### D. 任务分级不合理

- [ ] `pre-commit` 保持快速、局部、可预期
- [ ] `pre-push` 负责较重的项目级校验
- [ ] CI 保留最重、最全的治理和回归

## 9. 修复后验收

修复后至少验证以下场景：

- [ ] `docs-only` 提交在不使用 `HUSKY=0` 的前提下通过
- [ ] 小型代码改动在不使用 `HUSKY=0` 的前提下通过
- [ ] 明确违规改动仍会被 hook 正常阻断
- [ ] 常用 shell 下行为一致
- [ ] hook 输出能明确指出失败的是哪个子步骤
- [ ] 不再受无关未 staged 改动影响

最终验收句式：

> 修复后，`docs-only` 改动不再被误拦；真实代码或治理问题仍能被钩子有效阻断。

## 10. 治理记录

每次出现误拦后，建议补一条治理记录，至少包含：

- [ ] 根因
- [ ] 是否使用了 `HUSKY=0` 作为临时例外
- [ ] 修复前后规则差异
- [ ] 新的提交前校验分级策略

建议将结论同步到相关变更说明、运维记录或质量门禁文档中，避免后续重复讨论。

## 11. 最短执行顺序

如果只做一次快速排查，按下面顺序执行：

1. 看 `.husky/pre-commit` 与 `.husky/pre-push` 到底跑了什么
2. 先确认 `docs-only` staged 集合是否走了轻量路径
3. 手动执行 `npm run check:constitution`
4. 手动执行 `npm run check:consistency`
5. 判断是否为 whole-repo 扫描误伤
6. 判断是否为 shell / PATH / 可选依赖问题
7. 按最小修复原则调整规则分级
