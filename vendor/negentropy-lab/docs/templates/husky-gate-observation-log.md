# Husky 门禁观察记录模板

- 观察周期:
- 记录人:
- 当前冻结方案: `pre-commit` 轻量检查 / `pre-push` 仓库级治理检查 / CI 最终兜底
- 评估目标: 验证当前分层是否已足够解决 `docs-only` 误伤问题，且不会引入新的本地推送摩擦

## 使用说明

- 每次 `commit` / `push` 后补一行记录
- 建议至少覆盖 `5` 次 push
- 至少包含 `2` 次 `docs-only`、`2` 次 `code-only`、`1` 次 `mixed`
- 观察期内默认不使用 `HUSKY=0`

## 观察记录

| 日期 | 分支 | 变更类型 | Shell | pre-commit | pre-push | 耗时 | warning | 失败点 | 是否误拦 | 是否使用 `HUSKY=0` | 备注 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-03-11 | feature/example | docs-only | PowerShell | pass | pass | 18s | 否 | - | 否 | 否 | 首次观察样本 |
|  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |

## 异常留证

出现 warning、失败或疑似误拦时，补充以下信息：

- `git status --short`
- `git diff --cached --name-only`
- hook 完整输出
- 真实退出码
- 当前 shell
- 是否存在未 staged 的无关改动

## 观察总结

- `docs-only` 样本数:
- `code-only` 样本数:
- `mixed` 样本数:
- `HUSKY=0` 使用次数:
- `pre-push` 平均耗时:
- 是否仍出现误拦: 是 / 否

## 结论

- [ ] 继续冻结当前方案
- [ ] 进入 `pre-push docs-only skip` 设计草案阶段

结论说明:

-
