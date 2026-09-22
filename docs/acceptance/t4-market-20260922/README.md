# rc.28 · T4「HanaMesh 市场」真实门（2026-09-22，本机）

产物：`artifacts/hanamesh-dsh-app-host-0.1.0-rc.28.tgz`，SHA-256 `0605bdcfc8a69ffb6e8b3e6884e713f067a0405b3a9a74c1e308ca5a4b0effdb`（`npm-pack.json`：80 entries，131,422 bytes）。

| 项 | 状态 · 证据类型 | 证据 |
|---|---|---|
| SOURCE：`npm run check`（build + X01 + 121 tests / 119 PASS / 0 FAIL / 2 `REAL_BROWSER` SKIP + 14/14 变异 `ERR_ASSERTION` 检出） | PASS · SOURCE | `check.log`、`../mutations/M13-*`、`../mutations/M14-*` |
| SOURCE：`npm run test:types` 严格类型 | PASS · SOURCE | `types.log` |
| REAL_HOST：全新隔离 `DSH_HOME=/private/tmp/hm-t4-Gsg1cj`，`hanamesh-dsh-runtime/runtime` 的 DSH 0.1.5-alpha.1，`dsh plugin --profile web add <rc.28 tgz>` 成为 profile 层；端口 34281，`--no-open`，未用 3080、未碰 `~/.dsh`；每条命令同一行 `env -i HOME=… DSH_HOME=… PATH=<node bin>:/usr/bin:/bin` | PASS · REAL_HOST | `plugin-add.log`、`dsh-boot.log` |
| REAL_HOST：纯 DSH（无壳 overlay）下 profileDir/dshBin/nodeBinary 推断成立，`installedPlugins` 启动即列出 `@hanamesh/dsh-app-host@0.1.0-rc.28 installed bundle active`，`restartRequired:false` | PASS · REAL_HOST | `gate-1-install.log` |
| REAL_CATALOG：线上 `market.hanamesh.com`（12,260 条）`category=` 全部类别第一页 50 条全为 `kind:plugin`，`categories` 由本页汇出；`q=dsh-bloom-theme` 精确命中 | PASS · REAL_HOST | `gate-1-install.log` |
| `LIB-PROVISION-INPUT`：`POST /hanamesh/library/provision {appId}` → **400 `INVALID_INPUT`**；`plugins/uninstall {}` → 400；`plugins/uninstall {packageName:'@hanamesh/dsh-app-host'}` → **403 `PACKAGE_DENIED`**，不启动操作 | PASS · REAL_HOST | `gate-1-install.log` |
| 插件安装：`POST /hanamesh/library/plugins/install {packageName:'dsh-bloom-theme'}` → 202 → 真实 `node bin.js plugin --profile web add --save-exact dsh-bloom-theme@0.13.4`（registry latest 复核）→ `library.install-done {kind:'plugin'}`；已装列表出现 `dsh-bloom-theme@0.13.4 installed-not-loaded`，`restartRequired:true`；profile `package.json` 依赖与 `dsh.profile.bundles` 均含它 | PASS · REAL_HOST | `gate-1-install.log`、`profile-after-install.json` |
| REAL_UI（真实 DSH 页面，独立 user-data-dir 的 headless Google Chrome 经 CDP 操作）：侧栏按钮「市场」→ 覆盖页「HanaMesh 市场」；筛选 = 全部/应用/插件 + 目录类别；顶部「需重启 DSH … 请手动重启 DSH。」（浏览器直开，无壳 → 无深链）；「已安装」列表两行（app-host 已安装、bloom-theme 需重启）；搜索卡片状态 `installed-not-loaded`「已安装，重启 DSH 后生效」 | PASS · REAL_UI | `ui-1-before-restart.log`、`market-before-restart-*.png` |
| 重启后（boot 2，插件已加载）：`installedPlugins` 两项皆 `installed`，`restartRequired:false`；`POST /hanamesh/library/plugins/uninstall {packageName:'dsh-bloom-theme'}` → 202 → 真实 `plugin remove` → `library.uninstall-done`；已装列表该行变 `uninstalled-not-unloaded`（active:false），`restartRequired:true`；UI 卡片「已卸载，重启 DSH 后生效」，列表「已卸载 · 需重启」 | PASS · REAL_HOST + REAL_UI | `gate-2-uninstall-after-restart.log`、`profile-after-uninstall.json`、`ui-2-after-restart.log`、`market-after-restart-*.png` |
| 再重启（boot 3）：已装列表只剩 app-host，`restartRequired:false` | PASS · REAL_HOST | `gate-3-after-second-restart.log` |
| 壳内 `hanamesh://restart` 深链的实际跳转（桌面壳） | NOT_RUN | 本仓只在 `window.self !== window.top` 时渲染该链接；壳 `deep_link.rs` 目前只接受 `hanamesh://bound`（见回报「设计问题」） |
| 应用（Vibe）经市场升级、`provide('market')`、dshmarket 互斥、recommender 接线 | NOT_RUN（T5） | — |

SAFETY：结束时 `pgrep -fl "/private/tmp/hm-t4-"` 为空，34281 空闲，scratch 已删除；DSH 进程只按「pid 的环境含 `DSH_HOME=<scratch>`」精确核对后 SIGTERM。截图里的 DSH 首启弹窗（Internal Testing Notice / API key）是宿主自带，与本包无关；DOM 文本证据在 `ui-*.log`。

上限 🧪 DELIVERED；ACCEPTED 只有用户能给。
