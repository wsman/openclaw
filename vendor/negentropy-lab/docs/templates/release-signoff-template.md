# 发布签发模板

- 版本: 
- 环境: staging / production
- 发布时间: 
- 发布负责人: 

## 变更清单

1. 
2. 
3. 

## 门禁结果

- [ ] `npm run check:constitution`
- [ ] `npm run check:consistency -- --strict --timeout-ms 120000`
- [ ] `npm run check:contract:strict`
- [ ] `npm run test:gateway:mainline`
- [ ] `npm run gate:cluster:acceptance -- --mode release`
- [ ] `npm run build`

## 风险与回滚

- 风险等级: 低 / 中 / 高
- 回滚触发条件: 
- 回滚负责人: 
- 回滚命令: `bash ./scripts/rollback-verify.sh --live --health-url http://localhost:3000/health`

## 签发

- 技术签发: 
- 运维签发: 
- 业务签发: 
