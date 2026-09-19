# P3 调查差异记录

| 日期 | 调查结论 | 当前事实 | 处理 |
|---|---|---|---|
| 2026-09-19 | 阶段 1 bundle entry | 路线写 `name: '@hanamesh/dsh-app-host/dsh'`；固定版本 `dsh-client-modules` 的 `locatePkgJson()` 明确把 subpath entry 判为非 client row，真实 UI 因而没有「供应商」段。 | 唯一 entry 改成包根 `@hanamesh/dsh-app-host`；根入口保留核心 API，新增懒加载 Cordis `apply`。`/dsh` 显式导出仍保留。需以真实 UI 和 core 套件重复 id 门复验。 |
| 2026-09-19 | Vibe runtime 启动器 | 路线示例使用 `python -m vibe_trading`；固定 wheel 实际 console entry 是 `vibe-trading=cli:main`，不存在可执行的 `vibe_trading` module entry。lib-provision verify 还会把 `PATH` 清空。 | 启动器使用包内 Python 的 `-I -c 'from cli import main; ...'`；目录只用 POSIX `${0%/*}`，不调用 `dirname`。verify 执行真实 import 并预热归档，避免冷缓存把首次 Open 推过 120 秒。 |
| 2026-09-19 | 阶段 3 “市场”真实门 | 远端 Community Market / npm stable 需要公开发布；用户未授权公开 npm 或 GitHub Release。 | 用真实 DSH `plugin add` 本地 rc.9 tgz 模拟市场安装，并以应用库完成 runtime-missing → provision → open。包形状、bundle 激活、接管、账本和 iframe 均为 REAL_HOST/REAL_UI；远端市场仍 NOT_RUN，不冒充。 |
