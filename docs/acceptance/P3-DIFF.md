# P3 调查差异记录

| 日期 | 调查结论 | 当前事实 | 处理 |
|---|---|---|---|
| 2026-09-19 | 阶段 1 bundle entry | 路线写 `name: '@hanamesh/dsh-app-host/dsh'`；固定版本 `dsh-client-modules` 的 `locatePkgJson()` 明确把 subpath entry 判为非 client row，真实 UI 因而没有「供应商」段。 | 唯一 entry 改成包根 `@hanamesh/dsh-app-host`；根入口保留核心 API，新增懒加载 Cordis `apply`。`/dsh` 显式导出仍保留。需以真实 UI 和 core 套件重复 id 门复验。 |
