# APPHOST36 · 冷恢复旧视图租约

状态：`SOURCE + PACKAGE` 候选；独立原生产品复验仍待。研发切片 P01-U02/P08，实际消费者是 CORE38 / USAGE9 / APPHOST36 / VIBE31 的有限 Mac 组合；组合检查点由父 session 负责。

桌面 rc.16 的独立原生验证显示：原生 ⌘Q 时正在打开的 Vibe 实例留下 `stopping`；冷启动后成为 `interrupted`，新视图可以打开，但关闭新视图后 UI 约 879ms 返回「打开」，持久 `stopped` 直到旧视图 `view.expired`，延迟约 26 秒。脱敏事件显示新旧两个 viewId。`manager.init()` 原先中断实例，却保留该实例的旧租约为 `active`；最后一条新租约关闭时仍被旧租约算作占用。

本 origin 的 `manager.init()` 现在在同一个快照里把中断实例的旧活跃租约标记 `expired`，记 `view.expired(reason=host-restart)`。这只撤销旧视图的活跃权；实例仍是 `interrupted`，不把 guardian 清理前的应用误报为 `stopped`。持有原 viewId/token 的认证 owner 可通过原有 `resume` 精确恢复身份，获得新 token/generation；未恢复的旧租约不再拖住新视图关闭。没有新增依赖、配置项或跨插件代码。

新增真实 SIGKILL 宿主回归：旧实现先 RED（冷启动旧租约仍 `active`）；新实现 GREEN，guardian 清理后新 host 复用同实例，开/关新视图即持久 `stopped`，原视图仍可精确恢复且 token 轮换。`npm run check`：156 项（153 PASS、0 FAIL、3 既有 SKIP），22/22 真实源码变异 DETECTED；`npm run test:types` PASS。隔离 npm 缓存重跑 `npm pack` 后 82 文件，tgz SHA-256 `4e7f6b137a5ffa1b1a71420f384bb4112bcb94e6f1ea12d18fff1ac75f8e5009`；干净临时目录只从 tgz 导入并实际启动受管进程/写盘的 `scripts/verify-package.mjs` PASS。新回归增加事件理由断言后单独复跑仍 PASS。

本门未用真实 DSH profile、Provider、用户账号或积分，也未证明桌面原生冷恢复后的立即停机；须新版本链与另一 validator 重跑。三个 SKIP 为既有浏览器受限门两项和默认 90 秒长留一项。没有公开发布、部署或用户 ACCEPTED。
