# P06-APPHOST-AUTOOPEN-01 rev5 · rc.50 实施报告

状态：**AppHost 单组件候选，待独立 SPEC/QUALITY**。P06 产品 `UNPROVEN`，用户未 `ACCEPTED`。冻结卡 `/Users/yzliu/work/projects/hanamesh/_deliveries/p06-public-consumer-20261003/P06-APPHOST-AUTOOPEN-01.md` rev5 SHA256 `4056c28637042e020af938d1915d2d33e5c12437b6e411aa786edc80038750e8`。仅改 `hanamesh-plugin-app-host` 当前 worktree；未改 Core、Desktop、Web 或 P05，也未 push/tag/merge/publish/deploy。

## RED→GREEN 与修复

rc.48 固定包在独立异步目录交叠门失败，原件 `apphost48-independent-quality/raw/overlap-race.tap`；rc.49 固定包虽修复该交叠，在 embedded Market 未消费即卸载时留下同一 pending `targetId` 的覆盖页空转，RED 原件 `apphost-autoopen-rc49/raw/red-unconsumed-fallback.tap`。rc.45–rc.49 的已固定包、commit 和失败原件均未覆盖。

rc.50 在嵌入市场挂载/卸载时递增表面所有权代际。后台覆盖页只在自己持有当前所有权时接纳目标 GET、目录响应、目标状态与 consume；嵌入市场卸载后若宿主仍返回同一 pending ID，覆盖页按代际重新读取目录并实际呈现后消费。已由 embedded 消费的 ID 在宿主 GET 中为空，覆盖页不重开。`targetGeneration` 让同 ID 的新所有权也触发目录重读；已有 iframe、instance/view、前台租约与 heartbeat 路径保持。

定向单测覆盖两种顺序：两路目录 GET 挂起后先放 overlay、再放 embedded，只有 embedded 呈现/消费；同样前半段在 embedded 消费前卸载，覆盖页重新接手同一 ID 并单次消费。另有 protected 状态的延迟 passive effect 消费负门。新增 M45/M46 变异分别证明所有权代际与同 ID 重读缺失均由定向 `ERR_ASSERTION` 检出。

## Node24 与固定包

Node 24.13.1：`npm run build`、`npm run test:types`、`npm run check:consistency` 均退出 0；`npm test` **195 total / 192 pass / 0 fail / 3 既有 skip**；`npm run test:mutation` **46/46 `ERR_ASSERTION`**。`git diff --check` 通过。原始输出位于 `/Users/yzliu/work/projects/hanamesh/_deliveries/p06-public-consumer-20261003/apphost-autoopen-rc50/raw/{build.log,types.log,consistency.log,tests.tap,mutations.log,M45-embedded-unmount-never-reacquires-baseline.tap,M45-embedded-unmount-never-reacquires-mutant.tap,M46-owner-resume-does-not-reload-baseline.tap,M46-owner-resume-does-not-reload-mutant.tap}`。

固定包 `/Users/yzliu/work/projects/hanamesh/_deliveries/p06-public-consumer-20261003/apphost-autoopen-rc50/hanamesh-dsh-app-host-0.1.0-rc.50.tgz`，SHA256 `10aab3563b13ade0a275e5fc8d42af87296cd2764eb3337a57af358ee288553b`。`raw/pack.json` 是 `npm pack` 原件；干净目录烟测装出 `0.1.0-rc.50`（`raw/pack-smoke.log`）。烟测使用 `--legacy-peer-deps`，因为空目录没有私有 `lib-provision` peer；真 DSH 使用固定本地 vendor 包。真 DSH 安装的 `dist/client-ui.js` SHA256 `376dbb58a02cc5715c2d86807f848b7f5d2b7e3d67f3770ce76118a8cfcfe06d`，与 tgz 内文件一致。

## REAL_HOST / REAL_UI 原件

全新隔离官方 DSH profile `/Users/yzliu/work/projects/hanamesh/_deliveries/p06-public-consumer-20261003/worker-real-host-rc50/`；独立 `HOME`、`DSH_HOME`、缓存、Node24 与 127.0.0.1:35034。每条 DSH/安装命令以 `env -i HOME=… DSH_HOME=…` 同行显式隔离；官方 DSH 使用 `--profile tauri --host 127.0.0.1 --port 35034 --skip-auth --no-open`。只用本地 fixture 目录，**非生产目录**。启动前后确认 rc.50、tgz/已装 dist 摘要、主页 200 与 target 初始 null。受控慢目录脚本拦截真实浏览器的 GET，再通过实际 panel DOM 按钮/标签挂载或卸载 embedded Market；由于目标覆盖页遮住设置按钮，测试用 DOM click 调度真实页面导航，并在原件中显式标注。HTTP 202 来自同一 DSH 实例。

| 门 | 判定与证据（文件均在 `worker-real-host-rc50/`） |
|---|---|
| 未消费同 ID 卸载交接 | **PASS**：`slow-fallback-result.json` 记录 overlay 目录请求序号 1、embedded 序号 2、覆盖页接回同 ID 序号 3。前两路挂起，序号 1 先回时两表面状态空、target pending、consume 0；embedded 未消费即卸载后仍 pending，覆盖页重读，精确卡 2 可见后 consume 截点仅 overlay=found，consume 1、install/close 0。截图 `slow-fallback-before-unmount.png`、`slow-fallback-overlay-found.png`、`slow-fallback-overlay-scrolled.png`。 |
| embedded 已消费后卸载 | **PASS**：`slow-overlap-result.json` 记录序号 1 overlay 先回时 target pending、consume 0；序号 2 embedded 后回，consume 截点仅 embedded=found/visible、精确卡 2、consume 1。再卸载 embedded 等待 1.5 秒，overlay 状态仍空、consume 总数仍 1，target 已清。截图 `slow-overlap-overlay-first.png`、`slow-overlap-embedded-found.png`、`slow-overlap-embedded-scrolled.png`、`slow-overlap-after-unmount.png`。 |
| panel 首页自动打开 | **PASS**：无手工 Settings 导航，POST 202→found、精确卡 2、consume 1、install/close 0；`panel-autoopen-result.json`、`panel-autoopen-found.png`。 |
| embedded 已先打开 | **PASS**：`embedded-result.json`、`embedded-found-scrolled.png`；仅 embedded 呈现与消费。 |
| 前台 iframe 同包名新 ID 后到 | **PASS**：`active-view-result.json`、`active-view-found.png`；instance/view ID 不变，iframe 仍在，两个目标各消费一次，close/install 0。heartbeat 持续由定向单测覆盖。 |
| 目录失败并恢复 | **PASS**：`failure-result.json`、`failure-unavailable.png`、`failure-recovered.png`；中文不可读状态可见，查询保留，恢复后精确卡与一次消费。 |
| 无 panel | **PASS**：`no-panel-autoopen-result.json`、`no-panel-autoopen-found.png`；手动入口 1，自动卡可见、consume 1。 |
| dshmarket 持 seat | **PASS**：`dshmarket-autoopen-result.json`、`dshmarket-autoopen-found.json`、`dshmarket-autoopen-found.png`；冲突提示可见、手动入口 1、自动卡可见、consume 1。 |

真宿主脚本 `slow-fallback-ui.mjs`、`slow-overlap-ui.mjs` 和六项回归脚本保存在同一目录；对应 `*.log`、DSH 启动日志与 profile 安装/切换日志均为原件。最终自有 35034 无监听；P05 的 34815 仍由原 PID 34526 持有，未接触其 profile/进程。

## 仍待完成

Core49 固定 tgz 精确依赖 AppHost45；AppHost50 单组件本地真宿主通过不等于默认 Desktop 组合通过。Core/Desktop 各自 origin 须版本化重钉并复验。生产目录、P06 完整产品动作、用户 `ACCEPTED` 均 `NOT_RUN`。独立 SPEC/QUALITY 仍待 PM 判定；本报告不自判准入。
