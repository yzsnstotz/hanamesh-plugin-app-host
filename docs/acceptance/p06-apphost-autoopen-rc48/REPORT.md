# P06-APPHOST-AUTOOPEN-01 rev3 · rc.48 实施报告

状态：**组件候选待独立 SPEC/QUALITY**。仅 AppHost 单 origin；P06 产品 `UNPROVEN`，用户未 `ACCEPTED`。固定卡：`/Users/yzliu/work/projects/hanamesh/_deliveries/p06-public-consumer-20261003/P06-APPHOST-AUTOOPEN-01.md`，rev3 SHA256 `f4d7b5928336dd9719ed7c519852cd7b5f3920235a5552eb8855329a6ff58012`。rc.45 基线 commit `a40d452054db09a327c1686fc128e7462292c390` 保留；rc.46/rc.47 固定失败包及原始真宿主证据未覆盖。

## 改动与 RED→GREEN

`src/client-ui.js` 在 embedded Market 挂载期间让它独占外部 target 的读取、呈现与 consume；非 embedded 覆盖页继续保留定时器，等 embedded 卸载后恢复自动呈现。异步 GET 返回后再次检查 embedded 所有权，防止请求途中挂载发生抢先消费。rc.46 的 panel 入口与前台 iframe 保活、rc.47 的同包名新 targetId 重读目录修复一并保留。无新依赖、peer、配置或宿主导航 API。

两表面测试使非 embedded 定时器先注册、先触发：rc.47 行为在 `overlay=found` 断言处 RED，rc.48 在 `embedded=found`、两张精确卡、consume 时 overlay 无状态、卸载后覆盖页恢复处 GREEN。原件：`/Users/yzliu/work/projects/hanamesh/_deliveries/p06-public-consumer-20261003/apphost-autoopen-rc47/raw/red-dual-surface.tap`、`/Users/yzliu/work/projects/hanamesh/_deliveries/p06-public-consumer-20261003/apphost-autoopen-rc48/raw/M41-baseline.tap`、`M41-mutant.tap`。

## 代码与包门

在 Node 24.13.1 下 `npm run build`、`npm run test:types`、`npm run check:consistency` 均退出 0；`npm test` 为 **192 tests、189 pass、0 fail、3 既有 skip**；`npm run test:mutation` 为 **41/41，均由定向 `ERR_ASSERTION` 检出**（新增 M41）。原始输出分别在 `apphost-autoopen-rc48/raw/{build.log,types.log,consistency.log,tests.tap,mutations.log}`。`git diff --check` 通过。

固定包：`/Users/yzliu/work/projects/hanamesh/_deliveries/p06-public-consumer-20261003/apphost-autoopen-rc48/hanamesh-dsh-app-host-0.1.0-rc.48.tgz`，SHA256 `83c3873e19922b7e8ecfa5aeb4b8a01fb3c553b71bef5d01df9211d94a6a5db8`。`npm pack` 原件 `raw/pack.json`；临时干净目录 `npm install --legacy-peer-deps --ignore-scripts` 装出的版本为 `0.1.0-rc.48`（`raw/pack-smoke.log`）。`--legacy-peer-deps` 仅用于包烟测，因为独立空目录没有私有 `lib-provision` peer；真 DSH 使用固定本地 vendor 包。rc.48 真宿主安装 `dist/client-ui.js` SHA256 `4e84757ccf58249cc01ee9eaeb2861d578d3a49b9f67098435d48cdc353f89ca`，与 tgz 内文件逐字节一致。

## REAL_HOST / REAL_UI

全新隔离官方 DSH profile 位于 `/Users/yzliu/work/projects/hanamesh/_deliveries/p06-public-consumer-20261003/worker-real-host-rc48/`，`HOME`、`DSH_HOME`、缓存、profile、Node24 与端口 35014 均独立；每次 DSH 命令以 `env -i HOME=… DSH_HOME=…` 显式传入。`--profile tauri --host 127.0.0.1 --port 35014 --skip-auth --no-open`，本地 fixture 目录，不是生产目录。启动前后确认安装版 rc.48、上述 dist SHA 和 localhost 首页 200；3 个连续配置依次为 panel、无 panel、`dshmarket@1.66.8`，最后重新装 panel 截图。每个目标由真实 HTTP POST 返回 202，Chrome 真实页面读取状态与请求时序。

| 门 | 结果 | 原始证据（均在 `worker-real-host-rc48/`） |
|---|---|---|
| panel 首页，无手工 Settings/Market 导航 | PASS；found、精确卡 2、consume 1、install/close 0 | `panel-autoopen-result.json`、`panel-autoopen-before.png`、`panel-autoopen-found.png`、`autoopen-ui-panel-repeat.log` |
| embedded Market 已挂载且可见 | PASS；消费截点仅 embedded 为 found/visible，overlay 0；两张精确卡、consume 1、install/close 0 | `embedded-result.json`、`embedded-before.png`、`embedded-found.png`、`embedded-found-scrolled.png`、`embedded-ui.log` |
| 前台 fixture iframe、同包名后到新 targetId | PASS；instance/view ID 不变、iframe 继续、两次精确 consume、close/install 0；heartbeat 由定向单测覆盖 | `active-view-result.json`、`active-view-found.png`、`active-view-ui-panel.log` |
| 目录暂不可读→恢复 | PASS；中文状态可见、查询仍是 dsh-pet，恢复后精确卡及一次 consume，install/close 0 | `failure-result.json`、`failure-unavailable.png`、`failure-recovered.png`、`failure-ui-panel.log` |
| 无 panel | PASS；手动入口 1，首页自动 found、精确卡 2、consume 1、install/close 0 | `no-panel-autoopen-result.json`、`no-panel-autoopen-found.png`、`autoopen-ui-no-panel.log` |
| dshmarket 持 seat | PASS；冲突提示与手动入口可见，首页自动 found、精确卡 2、consume 1、install/close 0 | `dshmarket-autoopen-result.json`、`dshmarket-autoopen-found.json`、`dshmarket-autoopen-found.png`、`autoopen-ui-dshmarket.log` |

真 Host 脚本 `embedded-ui.mjs` 在 consume route 截点记录两表面状态，`preConsume.states[0]={state:"found",visible:true,embedded:true,overlay:false}`；只有已呈现的 embedded 表面确认目标。`embedded-found-scrolled.png` 同时显示两张精确卡与一个非匹配卡，卡上安装按钮没有被点击。`no-panel-autoopen-found.json` 的手动入口数为 1；`dshmarket-autoopen-found.json` 的正文包含冲突提示。三态运行日志为 `dsh-35014-{panel,no-panel,dshmarket}.log`，配置转换原件为 `remove-panel.log`、`install-dshmarket.log`、`restore-panel.log`。

最终自有 35014 监听已退出；P05 端口 34815 仍由原 PID 34526 持有，未接触该 profile/进程。rc.47 的 embedded 失败原件仍在 `worker-real-host-rc47/embedded-error-diagnostic.json`、`embedded-error.png`、`embedded-ui.log`，未改写。

## 尚未闭合的组合门

Core49 固定 tgz 精确依赖 AppHost45；本卡 AppHost48 只证明单组件本地真宿主，默认 Desktop 组合须由 Core/Desktop 各自 origin 版本化重钉并复验。生产目录、P06 整体产品动作与用户 `ACCEPTED` 均 `NOT_RUN`。独立 SPEC/QUALITY 尚待 PM 判定；此报告不自判准入。
