# rc.32 · T5「`market` 席位 + dshmarket 互斥」真实门（2026-09-22/23，本机）

产物：`artifacts/hanamesh-dsh-app-host-0.1.0-rc.32.tgz`，SHA-256 `40fc5d2aab0845ae7922669d9378337a2399fae65c629405002a8cb2887867e8`（`npm-pack.json`：82 entries，142,613 bytes）。

席位名与形状不是猜的：取自随 `hanamesh-desktop-tauri` 发布的钉死壳面板 `dsh-tauri-panel-extension@1.0.0`（`src-tauri/resources/node_modules/dsh-tauri-panel-extension/dist/client.cjs`）。该面板 `ctx.reflect.get('market')` 取值，`typeof value.render !== 'function'` 时当没有；标签体 `render({preferredSubsectionId:'installed'})`；接管期间 `setSettingsVisible(false)`、dispose 时 `true`。

| 项 | 状态 · 证据类型 | 证据 |
|---|---|---|
| SOURCE：`npm run check`（build + X01 4 组 4 边界 + 130 tests / 128 PASS / 0 FAIL / 2 `REAL_BROWSER` SKIP + 17/17 变异检出，含新增 M17） | PASS · SOURCE | `check.log` |
| SOURCE：`npm run test:types` 严格类型 | PASS · SOURCE | `check.log` 末尾 |
| SOURCE：AH-MS01–MS05 直接加载客户端 bundle（伪 `window.__ModuleLoader__` + React 替身 + cordis ctx 替身）跑真实 `apply()`，不是源码正则 | PASS · SOURCE | `../../../tests/market-seat.test.mjs` |
| REAL_HOST：全新隔离 `DSH_HOME=/private/tmp/hm-t5-fa527d2b`，随 `hanamesh-dsh-runtime-0.1.0-rc.3` 的官方 DSH 0.1.5-alpha.1，`dsh plugin --profile web add <rc.32 tgz>` 成为 profile 层；端口 34291/34292，`--no-open`，未用 3080、未碰 `~/.dsh`；每条命令同一行 `env -i HOME=… DSH_HOME=… PATH=<node bin>:/usr/bin:/bin:/usr/sbin` | PASS · REAL_HOST | `plugin-add.log`、`dsh-boot-1-clean.log` |
| REAL_HOST：`GET /hanamesh/library/installedPlugins` 列出 `@hanamesh/dsh-app-host@0.1.0-rc.32 installed bundle active`，`restartRequired:false` | PASS · REAL_HOST | `gate-1-installedPlugins.json` |
| REAL_UI 状态 A（无 dshmarket，独立 user-data-dir 的 headless Google Chrome 经 CDP）：侧栏「市场」按钮 1 个 → 覆盖页「HanaMesh 市场」；线上目录 50 张卡、20 个筛选项；已装列表 1 行；**无冲突提示**；控制台 0 error / 0 exception —— 即 `provide('market')` 跑通且不抛。无壳时没有面板读这个席位，provide 不生效属正常。 | PASS · REAL_UI | `ui-gate-1-clean.json`、`ui-gate.mjs` |
| REAL_UI 状态 B（同一 profile 里 `dsh plugin add --save-exact dshmarket@1.47.0` 后重启）：**不抢席位**；市场页顶部出现 `role="status"` 的「两者只能其一」提示，浏览器控制台一条 `warning`「hanamesh-app-host market: …」；侧栏入口、覆盖页、目录 50 卡、已装列表（含 `dshmarket 1.47.0 已安装`）全部照常，0 error | PASS · REAL_UI | `ui-gate-2-dshmarket.json`、`plugin-add-dshmarket.log`、`dsh-boot-2-dshmarket.log` |
| 壳内「扩展管理 · 市场」标签页真正渲染 HanaMesh 市场（需装机后的桌面壳） | NOT_RUN | 本轮不构建 `.app`（派发 session 负责）；席位形状由钉死的壳面板源码与 AH-MS01 锁定 |
| 壳内 `hanamesh://restart` 实跑 | NOT_RUN | 同上；壳侧 rc.13 有 `deep_link.rs` 的 restart 分支（Rust 单测）与 iframe postMessage 分支（`o4-stage2-contract`） |

SAFETY：结束时 `pgrep -fl "/private/tmp/hm-t5-"` 为空，34291/34292 空闲，scratch 已删除；只按 `/private/tmp/hm-t5-` 精确匹配发 SIGTERM，未用进程名批量 kill。日志里的一次性会话 token 已脱敏。

上限 🧪 DELIVERED；ACCEPTED 只有用户能给。
