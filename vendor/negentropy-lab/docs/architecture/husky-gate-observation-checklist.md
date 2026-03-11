# Husky 门禁观察期评估清单

## 1. 目的

本文用于观察当前本地门禁分层是否已经足够稳定，无需继续放宽 `pre-push`。

当前冻结方案：

- `pre-commit`：只做轻量 staged 检查
- `pre-push`：执行仓库级治理检查
- CI：保留最终兜底

本观察期的唯一目标：

> 验证当前 `pre-commit` / `pre-push` / CI 分层方案，是否已经足够解决 `docs-only` 误伤问题，且不会引入新的本地推送摩擦。

## 2. 观察原则

观察期内默认不继续放宽 hook，除非出现高频、稳定复现、且已证明影响开发效率的误拦问题。

观察期内遵循以下原则：

- 不修改 `pre-commit` / `pre-push` 分层策略
- 不为个别体感问题提前引入 `docs-only pre-push skip`
- 不以 `HUSKY=0` 作为常规绕过手段
- 所有结论以实际样本记录为准，而不是单次主观感受

## 3. 观察目标

- [ ] 验证 `docs-only` 提交是否已不再被误拦
- [ ] 验证 `pre-push` 的重检查耗时是否可接受
- [ ] 验证是否仍存在 `shell` / `PATH` / 可选依赖导致的偶发阻塞
- [ ] 验证当前方案是否应继续冻结，而不是进一步放宽

## 4. 观察窗口

建议满足以下任一观察窗口：

### A. 时间窗口

- [ ] 连续观察 `7` 至 `14` 天

### B. 样本窗口

- [ ] 至少记录 `5` 次 push
- [ ] 至少包含 `2` 次 `docs-only`
- [ ] 至少包含 `2` 次 `code-only`
- [ ] 至少包含 `1` 次 `mixed`

如果时间窗口和样本窗口都满足，优先采用两者共同结论。

## 5. 需要记录的指标

每次提交或推送建议至少记录以下字段：

- 日期时间
- 分支名
- 变更类型：`docs-only` / `code-only` / `mixed`
- 当前 shell：`cmd` / `PowerShell` / `Git Bash`
- `pre-commit` 是否通过
- `pre-push` 是否通过
- `pre-push` 耗时
- 是否出现 warning
- 是否出现误拦
- 若失败，真实失败命令是哪一条
- 是否使用了 `HUSKY=0`
- 备注

## 6. 记录表模板

建议使用如下表格持续记录：

| 日期 | 分支 | 变更类型 | Shell | pre-commit | pre-push | 耗时 | 失败点 | 是否误拦 | 是否使用 `HUSKY=0` | 备注 |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-03-11 | feature/example | docs-only | PowerShell | pass | pass | 18s | - | 否 | 否 | 首次观察样本 |

可直接填写模板：

- `docs/templates/husky-gate-observation-log.md`

## 7. 推荐记录方式

每次出现异常时，建议同时保留以下证据：

```powershell
git status --short
git diff --cached --name-only
```

如需记录 `pre-push` 耗时，可在手动复现实验时补充：

```powershell
Measure-Command { npm run check:constitution }
Measure-Command { npm run check:consistency -- --timeout-ms 120000 }
```

如果是 hook 执行失败，优先记录：

- hook 完整输出
- 真实退出码
- 失败步骤名称
- 当前 shell

## 8. 触发下一步设计的条件

只有出现以下情况之一，才进入 `pre-push docs-only skip` 设计阶段：

- [ ] `docs-only` push 仍频繁造成明显阻塞
- [ ] `pre-push` 对 `docs-only` 的平均耗时明显不可接受
- [ ] 误拦不是偶发，而是稳定可复现
- [ ] 当前重检查已被证明主要提供“重复 CI 价值”，而非本地守门价值

未达到以上条件时，默认继续冻结当前方案。

## 9. 结束判定

### Go：继续冻结当前方案

满足以下特征时，继续维持现有门禁分层：

- [ ] `docs-only` 不再误拦
- [ ] `HUSKY=0` 使用次数为 `0`
- [ ] `pre-push` 耗时可接受
- [ ] 无新的环境兼容性问题

### No-Go：进入 skip 设计草案

满足以下任一特征时，进入下一阶段设计：

- [ ] `docs-only` push 仍明显影响体验
- [ ] 误拦能够稳定复现
- [ ] 本地重检查成本已明显高于收益

## 10. 观察期结论模板

建议在观察结束后补一段统一结论：

> 观察期内共记录 `X` 次 push，其中 `docs-only` `Y` 次、`code-only` `Z` 次、`mixed` `N` 次。当前 `pre-commit` / `pre-push` / CI 分层未再出现明显 `docs-only` 误拦，`pre-push` 耗时处于可接受范围，因此继续冻结当前方案，不进入 `pre-push docs-only skip` 设计。

如结论相反，可改为：

> 观察期内 `docs-only` push 仍存在稳定复现的本地阻塞，且 `pre-push` 成本高于本地守门收益，因此进入 `pre-push docs-only skip` 设计阶段。
