# 回滚审计模板

- 回滚时间: 
- 回滚环境: staging / production
- 触发原因: 
- 影响范围: 

## 证据链

1. 变更单/发布单: 
2. 告警截图或日志: 
3. 回滚命令与执行记录: 

## 验证

- [ ] `bash ./scripts/rollback-verify.sh`
- [ ] `bash ./scripts/rollback-verify.sh --live --health-url http://localhost:3000/health`
- [ ] `npm run check:contract:strict`

## 复盘结论

- 根因: 
- 直接修复措施: 
- 长期改进项: 
