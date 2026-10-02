# P06-APPHOST-01 · rc.45 同 origin 规格返工组件回包（2026-10-03）

范围仅 `hanamesh-plugin-app-host`，基于 rc.43 `63f8065f9d26119b48d8c94c6b5695315cd2d742`、沿 rc.44 本地分支续修。候选包 `artifacts/hanamesh-dsh-app-host-0.1.0-rc.45.tgz` SHA256 `afc35169eaa90d81112643e1417f7a2463a7366975527a1f78e32725dcc91e5a`；固定 rc.43 回滚包 SHA256 `0867f969f023b281bd2bf2a1aa158c75dc8838cbbcb53f8bb63dfce2a66bffaf`。rc.44 固定包保持原样。仅本地 commit/pack；未 push、tag、merge、publish 或部署。P06 产品仍 `UNPROVEN`，用户未 `ACCEPTED`。

## 修复

活应用 `receipt` 存在时，原实现后台判 `found` 并消费，但市场只渲染 iframe，精确目标卡不可见。rc.45 在同一应用帧下方渲染可滚动的目标状态和全部精确卡，保留 iframe、实例及租约，卡实际呈现后再按 ID 消费。T11 测试先 RED（`raw/red-active-view.tap`），后 GREEN（`raw/green-active-view.tap`）；测试在 consume 请求到达时检查两张精确卡已渲染，且子串条目未标记、无 close/reopen。M37 将此显示路径删除，针对性测试以 `ERR_ASSERTION` 杀死。`docs/LIBRARY.md` 和包版本同步 rc.45。

## 冻结门

| 门 | 组件证据判定 | 原件与边界 |
|---|---|---|
| T01–T03、T05–T06 | PASS | `raw/tests.tap`、`raw/probe-target-result.json`；真实 DSH 的目标写/读、输入优先级、N200/201/214/215、旧 ID 消费、来源和事件无额外写。 |
| T04 | `REAL_HOST_NOT_CONSTRUCTIBLE / APPROVED_SUBSTITUTION`，待独立复核 | 按 PM `P06-APPHOST-01-T04-GATE-ADDENDUM.md`：`raw/t04-approved-substitution.tap` 的 UNIT_HTTP 对 POST target 与 POST consume 各注入有效主体、`authorize=false`，精确 403/FORBIDDEN、目标 ID 不变、writes/fetches/installs=0；`raw/t04-full-auth.json` 的完整认证宿主无 cookie/无效 cookie 均 401；`raw/probe-target-result.json` 有真实 Host/Origin/frame/CSRF 403。`src/dsh.js` 的 `browserAuthentication` 仅产出并授权 `dsh-browser`，所以当前 DSH 实例无法产生认证后被此授权器拒绝的另一主体；绝不把真实 401 或栅栏 403 说成真实 authorize403。 |
| T07 | PASS | `raw/t07-restart.json`：未消费 target `f3353eb1-ee5e-4064-b71e-11f5627140ee` 在 PID 55810 存在，TERM 后 PID 56409 的真实宿主 GET 为 null。 |
| T08 | PASS | `raw/tests.tap`：挂载期 1 秒轮询、失败 5 秒退避/恢复、卸载停轮询。 |
| T09、T11 | PASS，限 AppHost/fixture | `raw/ui-active-open.{json,png}`、`raw/ui-active-found.{json,png}`、`raw/ui-active-summary.json`、`raw/ui-active-lease-analysis.json`：隔离 Chrome 市场打开 rc.43 v2 fixture；同屏 iframe + 两张精确卡，consume 拦截点 DOM 中两卡 connected/visible，子串卡不标记；同一实例 ready、当前活跃 view ID 与 iframe URL 摘要前后相同，无 `/apps/close` 或 install POST。JSON 中的 iframe bootstrap 能力 URL 已脱敏，保留 SHA256 比对。该目录页为 `raw/provider-page.json` 测试 fixture；不是现网目录/完整产品组合。 |
| T10、T10b | PASS | `raw/ui-active-protected.{json,png}`、`raw/ui-active-unavailable.{json,png}`、`raw/ui-missing-or-page1.json`、`raw/ui-page1-before.json`、`raw/ui-page1-after.json`：五态真实 UI 均见；现网 `dsh` 首页有 cursor 时为 `not-on-loaded-pages`，点“更多”后仍未误报 missing。`raw/tests.tap` 覆盖页 2 才出现精确项。 |
| T12 | PASS | `docs/CONTRACT.md`、`docs/LIBRARY.md`、README 与包文件核对；无新依赖或产品配置。 |
| T13 | PASS，仅 AppHost 市场 UI | `raw/t13-seat-matrix.json`、三席位截图/JSON：带 panel 的 `market` 席位、dshmarket 在场、无 panel/无 dshmarket，均找到现网 `dsh-pet` 首页 4 个精确条目，无自动 install。回环 POST 生产者为 `SIMULATED_PRODUCER_LOCATING_ONLY`。Core46 clone 仍钉 AppHost rc.41，不能据此声称完整 Core 消费者通过。 |
| T14 | PASS | Node 24.13.1 `raw/clean-ci.log`、`raw/build.log`、`raw/types.log`、`raw/consistency.log`、`raw/tests.tap`（188/185 pass/3 既有 skip/0 fail）、`raw/mutations.log`（37/37 `ERR_ASSERTION`）、`raw/npm-pack.json`、`raw/package-smoke.log`、`raw/sha256.txt`。 |
| T15 | PASS | `raw/rollback-result.json`：同隔离 profile 从 rc.45 回滚到固定 rc.43，目标路由 404、市场 200、rc.43 v2 fixture 仍注册；rc.43 tgz SHA 与冻结值一致。 |
| T16 | PASS，限 AppHost 真实宿主消费者 | `raw/probe-live-reload-result.json`、`raw/probe-fixture-result.json`：rc.43 v2 fixture 在 rc.45 真 DSH 中注册、打开、停用/恢复、再打开；`raw/t16-registration-probe.json` 由同宿主测试专用 Cordis 消费者直接取服务句柄，记录两次不同 registrationId、旧 ID 迟到 `registration-replaced`、另一 owned 应用在新旧注册竞争时仍 ready/pidAlive、精确撤销后两受控 PID 均退出。测试消费者源码 `raw/t16-test-only-consumer.mjs`，未进入产品包。 |

真实宿主是独立 `DSH_HOME`、34984，测试只在 34985 使用本地只读候选 registry stub；`raw/stop-receipt.json` 记录两个端口与 T16 owned PID 均停止。P05 34815、`~/.dsh`、3080、研究 runtime、生产、CUSTODY 工作树未触碰。规格/质量独立复核尚未完成，以上均为 worker 组件证据，不是产品 `ACCEPTED`。
