# P02-APPHOST-01 · 应用包契约 v2（宿主缺席不拖垮 DSH）· 组件候选证据 · 2026-10-02

**执行者：** Claude Code 后台作业（Opus 5.5），单仓 `hanamesh-plugin-app-host` 隔离工作树，分支 `codex/p02-apphost-01`，基线 `b8a741c`（rc.41）。
**判定上限：** 组件候选。没有 SPEC/QUALITY 独立复核、没有 P02 产品门、没有用户 ACCEPTED。不声称正式 runner checker PASS。
**未改：** Vibe / Core / Usage / Desktop / DSH 上游 / docs `STATUS.md`。没有 push、发布或 tag，也没有加载生产凭据。

## 1. 结论

| 门 | 结果 | 证据 |
|---|---|---|
| RED：v1 入口（APP_PACKAGE v1 原文）+ Core46/AppHost41，`dsh plugin remove hanamesh-core` 后启动 | **复现**：remove rc=0，boot **rc=1**：`@hanamesh/app-contract-fixture/dsh: pending (waiting for service: hanameshApps)` | `logs/red-remove-core.log`、`red-dump-after-remove.log`、`red-b-host-removed.boot.log` |
| A 先装应用、后装宿主 | PASS：只有应用时 DSH Web 可用（根 200，HanaMesh 路由 404）；装 Core 后应用注册 1 次 | `gA*`、`ui/gA1-app-only-home.*` |
| B 先装宿主、后装应用 | PASS：注册 1 次；open→ready→自有进程 1→close→进程 0；事件无重复 | `gB*`、`probes.jsonl` |
| C 宿主消失、应用仍在 | PASS：`remove hanamesh-core` rc=0，应用 bundle 与 loader 条目仍在；**boot 正常**（Chrome 根 200、无 HanaMesh 入口、路由 404）；进程 0；6 个 storage 文件不变 | `gC*`、`ui/gC-host-removed-home.*`、`gB/gC/gD-storage-files.txt` |
| D 宿主恢复 | PASS：注册 1 次；同一实例 id（单实例槽位与数据目录复用）；事件序号 0 重复 | `gD*` |
| E 应用主动卸载（重启后生效） | PASS：`remove @hanamesh/app-contract-fixture` 后启动，应用列表空、进程 0、实例记录与 storage 保留 | `gE*` |
| F 运行中卸载/恢复（DSH 自身 live patch reload，`disabled: true`） | PASS：应用开着时禁用宿主 → 自有进程停止、`view.stopped`/`instance.stopped` 各 1；恢复宿主 → 注册 1 次；应用开着时禁用应用 → `unregister` 撤下定义并停掉进程（进程 0）；恢复应用 → 注册 1 次；全程 0 重复事件 | `run-live-f.sh`、`lF*`、`live-cordis-log.jsonl` |
| 应用定义错误不被吞 | PASS：坏 v2 定义（缺 `{{dataDir}}`）时 DSH 照常启动；Cordis error 级日志以包名报出 `MISSING_RUNTIME_BINDING`；不注册任何东西；市场已装行 `state:"invalid"`；套件移除后 DSH 仍能启动 | `cB*`、`compat-cordis-log.jsonl` |
| 旧 v1 包在 rc.42 上 | 宿主在时可用，扫描标 `contractVersion:1 / hostLifecycle:"host-required"`；真实 Chrome 的市场「已安装」行显示「旧版应用契约：卸载 HanaMesh 套件前请先卸载此应用，否则 DSH 无法启动」；**移除套件后仍 boot rc=1**。rc.42 修不了已封的旧包 | `cA*`、`ui/cU-v1-on-rc42-market.*` |
| 未授权零上报 | PASS：Core 指向本机记录桩，全程只有 `POST /v1/identity/devices/challenge` ×18（设备注册尝试，与同意无关）；`/v1/usage/events` 0 次 | `stub-requests.jsonl` |
| 单测/构建/类型/一致性 | 176 tests：173 pass / 0 fail / 3 skip（基线 165/0/3，新增 8）；build、`check:consistency`（X01 4/4）、`test:types` 通过 | `rc42-tests.tap`、`rc42-build-consistency-types.log` |
| 变异 | 26/26 检出（新增 M23–M26：unregister 身份、unregister 孤儿进程、v1 未标注、入口检查放行 v1） | `rc42-mutations.log`、`../mutations/M2[3-6]*` |
| 干净 tarball 消费者 | PASS：离线隔离安装 rc.42 tgz，真实自有进程 + `checkAppPackageEntry` + `unregister` 停止 runtime | `rc42-package-smoke.log` |

## 2. 方案取舍（真实 DSH 依据）

- **采用：应用动态订阅已有的 `ctx.inject`。** DSH 0.1.5-alpha.1 启动审计（`dsh-app-boot` `assertEntriesActivated`）只检查 Loader 条目自身的 fiber。没有顶层 `inject` 的 bundle 是 active 的；`ctx.inject(['hanameshApps'], …)` 建出的子作用域不是 Loader 条目，不进入这项审计。Cordis 4.0.2（钉版）的 `inject` 没有可选依赖语义：数组和映射写法都表示必需。所以「改成可选注入」的写法在这个内核上不存在，子作用域订阅是唯一现成的公开扩展点。AppHost 自己早就用同样方式订阅 `credentials` / `llm` / `hanameshUsage`。真实 DSH 门 A–F 证明了它的行为。
- **否决：安装/卸载联动。**
  - `dsh plugin remove hanamesh-core` 只是 CLI 改 profile、调 pnpm，不级联卸载依赖它的应用（`red-dump-after-remove.log`：应用条目仍在），也不给任何插件留卸载钩子：那一刻 DSH 没在运行，Core/AppHost 的代码都不执行。
  - 市场 UI 本来就禁止从市场卸载套件。
  - 要做联动只能改 DSH CLI，或让每个卸载入口都替应用兜底，两者都越出本仓边界。
- **宿主侧补充（同仓，必要的最小接口）：**
  - `AppHost.unregister(appId, definitionHash)`：订阅作用域结束时调用。它只撤下完全相同的那次注册；先撤定义，再经正常停止路径停掉该应用的自有 runtime；实例记录和数据保留。宿主正在关闭时是 no-op。
  - `checkAppPackageEntry`：供应用仓自测，不执行入口。
  - 已装扫描新增 `contractVersion` / `hostLifecycle`，市场列表据此对旧包写明卸载顺序。
  - 没有新增 dependency / peer / vendor / config。

## 3. 测试脚手架（如实披露，不计为产品能力）

- **隔离：** 每个场景都有独立的 `HOME`/`DSH_HOME`（`$RUN/home-<scenario>`），端口 35411–35418，`env -i` 启动，pnpm store 隔离。DSH 是官方 0.1.5-alpha.1 CLI（Desktop 依赖目录里的 `bin.js`），Node 24.13.1。没有碰 `~/.dsh`、3080、研究 runtime，也没有碰 P01/P04/P02 原 profile。
- **私有包来源：**
  - 私有包经 pnpm `overrides` 指向冻结 tgz（`logs/*-scaffold.txt`）。
  - Core46 原本精确依赖 AppHost rc.41，测试里用 override 换成 rc.42 候选。**真实用户要拿到 rc.42，Core 需要发新版本并更新这条依赖（版本钉，非代码修复）。**
- **registry 桩：** pnpm 会从 registry 解析应用的 peer `@hanamesh/dsh-app-host@0.1.0-rc.42`，而这个版本未发布、也不允许发布。所以用 `harness/regstub.mjs`：一个只读转发本机 4873 的回环桩，只在一个 packument 里追加本地 rc.42 候选（`regstub-requests.log`）。这一步不发布任何东西。
- **Core 出口：** Core 的 `serverOrigin`/`websiteOrigin` 用其文档化配置项指向本机记录桩 35414。
- **测试夹具：** `@hanamesh/app-contract-fixture` 仅供测试，从不发布。
  - v1 = 文档 v1 入口原文。v2 = `tests/fixtures/app-package/entry-v2.js`，`AH-PK07` 断言它与 `docs/APP_PACKAGE.md` 中的入口逐字相同。
  - 0.0.3 = 同一 v2 入口配坏定义。
  - 0.0.2 两次构建字节相同（`d206272c…0acf`）。
- **日志旁路：** DSH 只把日志放在内存缓冲，所以 F 与兼容门经 profile 用户 patch 插入了仅测试用的 `log-tap.mjs`，放在仓外。
- **市场目录读取：** 市场 UI 截图时 AppHost 默认目录源会 GET 生产 `market.hanamesh.com` 目录（只读）。

## 4. 已定位的异常（都不是 AppHost 缺陷，已在 `logs/superseded/` 保留原样）

1. **`gF` 首轮 live 测试作废，两个原因：**
   - g1/g2/g3 共用同一个 `DSH_HOME`（storage 按 HOME 而不是按 profile 存），所以 g3 不是新环境。
   - patch 写法是原地截断后再写。`live-diag-cordis-log-inplace-write.jsonl` 里，DSH HMR 读到半截文件，报 `must be a top-level YAML array of loader patch entries`，后续变更事件被合并，导致「重新启用宿主」不生效。
   - 改成「写临时文件 → rename」并换用全新 HOME 后，每次切换 500ms 内生效（`lF*`）。根因属于测试脚手架。
2. **`red-p1`、`red-p2` 两次是夹具本身的问题：**
   - `red-p1`：夹具缺 `{{dataDir}}`，DSH 启动直接失败，并且明确报出 `MISSING_RUNTIME_BINDING`，即 v1 的定义错误同样是响的。
   - `red-p2`：独立装 AppHost 后，`remove @hanamesh/dsh-app-host` 时 pnpm 去公共 npm 解析 peer，报 404，宿主根本没被移除。所以 `red-boot2` 那次能启动不能算数。随后改用真实的 U03 形状（Core 套件 + `remove hanamesh-core`）。
3. **`web-server` 的 `ECONNRESET` warn：** 与 Playwright 关闭浏览器的时刻吻合。`loader patch: entry hanamesh-core not found`：套件移除后，profile patch 仍指向 Core，这是预期内的 warn。
4. **DSH 0.1.5-alpha.1 的 `plugin remove` 不在运行时卸载 bundle**（`gE-live`：remove rc=0，应用仍注册、进程仍在，直到重启）。这是 DSH 自身行为，市场原有的「已卸载 · 需重启」与此一致。运行时卸载路径由 F（`disabled` live patch）覆盖。

## 5. 公开契约变化与旧消费者迁移（VIBE 唯一来源须另卡）

- **契约变化：**
  - `docs/APP_PACKAGE.md` 升为契约 v2（v1 入口标为废弃，仅用于识别旧包）。
  - `docs/CONTRACT.md` 新增 `unregister`，已装行新增 `contractVersion`/`hostLifecycle`。
  - `index.d.ts` 新增 `unregister`、`checkAppPackageEntry`、`APP_PACKAGE_CONTRACT_VERSION`。
  - 既有 `register`、市场和路由行为不变，全量回归已覆盖。
- **Vibe（当前 rc.36 仍是 v1，本卡未改它的字节，也不称它已修好）需要在 VIBE 仓：**
  1. `dsh.js` 删除 `export const inject = ['hanameshApps']`。
  2. 保留 `validateConfig(config)` 与读取 `app.json`，改为 `ctx.inject(['hanameshApps'], scoped => { const apps = scoped.get('hanameshApps'); const { appId, definitionHash } = apps.register(definition); return () => apps.unregister(appId, definitionHash); })`。当前的 `APP_HOST_REQUIRED` 顶层抛错正是要去掉的那一点。
  3. `package.json`：`peerDependencies["@hanamesh/dsh-app-host"]` 改为 `"0.1.0-rc.42"`（rc.42 起才有 `unregister`，旧宿主上会在卸载时 TypeError），`hanamesh.contractVersion: 2`，并发新版本号（同版本字节不可变）。
  4. 在自测中调用 `checkAppPackageEntry(entry, pkg)`。
- **Core：** 发新版本，把依赖 `@hanamesh/dsh-app-host` 钉到 rc.42。
- **复验：** 由不同 validator 从新冻结组合重跑 P02-U03 旧真实路径：市场装 Vibe（v2）→ 直接 `remove hanamesh-core` → DSH 可启动 → 重装 → 只注册一次、资源归零。

## 6. 产物

- **候选包：** `hanamesh-dsh-app-host-0.1.0-rc.42.tgz`，SHA-256 `3047353d10123b1987e6e41a59e3ddd7ccaa76c5c8a6dfaad56d6bc79c6c3615`。这是真实门里实际安装的字节，副本在 `artifacts/`。
- **固定输入：** 摘要见 `logs/inputs-sha256.txt`，与卡面一致：Core46 `829999…f416`、Usage10 `c69c97…864e`、AppHost41 `457b0c…7134`。
- **复跑方法：** `harness/` 下的 `setup.sh`、`run-red.sh`、`run-green-a.sh`、`run-green-b.sh`、`run-green-e.sh`、`run-live-f.sh`、`run-compat.sh`、`run-compat-ui.sh` 可原样复跑。需要先启动 `stub.mjs` 和 `regstub.mjs`，路径变量见 `env.sh`。

## 7. 未跑 / 未证

- 原生 Desktop 客户端：NOT_RUN（本卡只要求 DSH Web 真门）。
- 真实 Vibe 包走 v2：不存在，需要 VIBE 卡。
- 公共分发：仍是 `PUBLIC_DISTRIBUTION_NOT_AVAILABLE`。
- SPEC/QUALITY 独立复核：未做，需由不同执行者完成。
