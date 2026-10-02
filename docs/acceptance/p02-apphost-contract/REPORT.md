# P02-APPHOST-01 · 应用包契约 v2（宿主缺席不拖垮 DSH）· 组件候选证据 · 2026-10-02

**执行者：** Claude Code 后台作业（Opus 5.5），单仓 `hanamesh-plugin-app-host` 隔离工作树，分支 `codex/p02-apphost-01`，基线 `b8a741c`（rc.41）。
**判定上限：** 组件候选。没有 SPEC/QUALITY 独立复核、没有 P02 产品门、没有用户 ACCEPTED。不声称正式 runner checker PASS。
**未改：** Vibe / Core / Usage / Desktop / DSH 上游 / docs `STATUS.md`。没有 push、发布或 tag，也没有加载生产凭据。
**QUALITY R-Q1 整改（2026-10-02，回应 `P02-APPHOST-01-QUALITY-REVIEW.md`）：** 见 §0R。**当前候选包 `0.1.0-rc.43`，SHA-256 `0867f969f023b281bd2bf2a1aa158c75dc8838cbbcb53f8bb63dfce2a66bffaf`。** rc.42 的全部字节（`3047353d…3615`、`eedf454d…060b`、`95cf8af3…f47d`）作废，只留作历史（`artifacts/hanamesh-dsh-app-host-0.1.0-rc.43.history.txt`），rc.42 这个名字不再复用。
**同卡 SPEC 整改（2026-10-02，回应 `P02-APPHOST-01-SPEC-REVIEW.md`）：** 见 §0；其中的包 SHA 是当时的 rc.42 `95cf8af3…f47d`，已被 rc.43 取代。

## 0R. QUALITY R-Q1 整改（rc.43）

**缺陷（QUALITY 原文）：** rc.42 的 `unregister(appId, definitionHash)` 用**内容指纹**当注册身份。同一份定义注册两次（同版本重装、bundle 重载），`definitionHash` 相同；迟到或重复的旧 disposer 会撤掉当前注册、停掉它的真实进程。

| 项 | 处理 | 证据 |
|---|---|---|
| RED（在 `d945ee6` 源码上） | 新测试直接驱动契约入口 `entry-v2.js`（即 APP_PACKAGE.md 逐字展示的那份）：用一个最小 ctx 接住 `ctx.inject` 的回调，测试手里拿的就是入口自己的 disposer，所以能「迟到再调一次」——正常 Cordis 路径的 dispose 守卫会把这种调用藏起来。三项全部 RED，且与 QUALITY 探针一一对应：**AH-PK11**（=Q1）r1 注册→撤销，r2 同定义注册并 open 真实进程，再调 r1 的 disposer → 实际 `{removed:true, stopped:1}`；**AH-PK12 同定义**（=Q2）重载时新注册立刻 open → `INSTANCE_NOT_READY`；**AH-PK12 升级定义**（=Q3）→ `DEFINITION_CHANGED`。三者都是 `ERR_ASSERTION`。 | `rq1/logs/rq1-red-on-d945ee6.tap` |
| 修法：注册身份（`src/manager.js`，AppHost 自有代码） | `register` 每次调用用 Node 内建 `randomUUID()` 生成 `registrationId`，宿主内部按 `appId` 记住当前那次注册的 id；返回 `{appId, registrationId, definitionHash}`。`unregister(appId, registrationId)` 只在 id 严格相等时撤销。id 不从内容推导、撤销后不再存在、重新注册换新 id，所以**永不复用**。旧 id → `{removed:false, reason:'registration-replaced'}`；该 appId 无注册 → `not-registered`；宿主关闭中 → `host-closing`。`definitionHash` 保留为内容指纹（实例的 `definitionHash`、`instance.definition-adopted` 事件、重复定义检查照旧）。**非 UUID 的参数（包括按 rc.42 文档传 `definitionHash`）以 `INVALID_REQUEST` 抛出**，不会被静默当作身份匹配，也不会静默 no-op——按 rc.42 形状写的消费者会在 Cordis error 日志里看到它。`reason` 从 rc.42 的 `definition-replaced` 改名为 `registration-replaced`（rc.42 未发布、无消费者）。 | `src/manager.js` `register`/`unregister`；`AH-PK06`（UUID 形状、指纹被拒、同定义两次注册 hash 相同而 id 不同）、`AH-PK11` |
| 修法：清理顺序（同名重载） | 实测发现 rc.42 的重载窗口不只是 QUALITY 列为建议的 R-Q2：旧注册的清理先在队列里读目标，**下一个**队列步骤才落盘 `stopping`；同一时刻新注册的 open 会排在两者之间，挂到马上要被停的进程上（同定义）或以 `DEFINITION_CHANGED` 失败（升级定义）。修法：①`unregister` 在**同一个**串行步骤里读目标并为每个目标落盘 `stopping`（`stop` 的队列体抽成 `#stopStep` 供两处共用，停止的发布仍走原来的 `stopBeforePublish`）；②`#prepareOpen` 把 `INSTANCE_STOPPING` 检查移到定义采纳之前。结果：重载时新注册的 open 一律得到可重试的 `INSTANCE_STOPPING`（409），停止事件之后重试在**同一实例槽位、同一数据目录**启动新进程；新注册不被旧清理撤掉；不误伤其他应用（`AH-PK09` 仍过）；没有孤儿进程。 | `AH-PK12`（两种定义）、`AH-PK08/09/10` 回归 |
| 同步面 | `src/index.d.ts`（`register` 返回 `registrationId`、`unregister(appId, registrationId)`、reason 联合类型）；`tests/consumer.mts`；`docs/APP_PACKAGE.md` 最小 v2 入口（与 `entry-v2.js` 逐字一致，`AH-PK07` 断言）、行为说明、版本门改为 `0.1.0-rc.43`；`docs/CONTRACT.md`；`README.md`；`scripts/verify-package.mjs`（装好的 tgz 上断言：指纹被拒、旧 id no-op、正确 id 停掉真实进程）；测试夹具应用 v2 升为 `0.0.4`（入口用 `registrationId`，peer `0.1.0-rc.43`；`0.0.2` 是 rc.42 入口，作废）。没有新增 dependency / peer / vendor / config。 | `git diff d945ee6` |
| 版本与产物 | `0.1.0-rc.43`（package.json / lockfile / README / CONTRACT / APP_PACKAGE / 夹具 peer）。`artifacts/hanamesh-dsh-app-host-0.1.0-rc.43.tgz`，SHA-256 **`0867f969f023b281bd2bf2a1aa158c75dc8838cbbcb53f8bb63dfce2a66bffaf`**；在另一目录重打一次，字节相同。解包后 `dist/` 与仓内 `dist/` 逐文件相同、`src/*.js,*.d.ts` 与包内 `dist/` 相同；`dist/manager.js` SHA-256 `15b9a2515d9458d5047fa2d230a8a4329d03282e91f774330da6210746bf65d7`。 | `rq1/logs/rq1-npm-pack.json`、`rq1-pack-repeat-sha256.txt`、`artifacts/*.rc.43.*` |
| 模块门（Node 24.13.1） | `npm ci`（`npm_config_cache` 为新 `mktemp -d`）exit 0；build、`check:consistency`（X01 4/4）、`test:types` exit 0；全量 **182 tests = 179 pass / 0 fail / 3 skip**（新增 PK11、PK12×2；skip 与基线相同：H13、H10 REAL_BROWSER、AH-VL08）；离线干净 tarball consumer PASS（新空缓存只预置 tgz 唯一依赖 `zod@4.5.4`，日志里有这一步）。 | `rq1/logs/rq1-npm-ci.log`、`rq1-build-consistency-types.log`、`rq1-tests.tap`、`rq1-package-smoke.log` |
| 变异（只以 `ERR_ASSERTION` 计检出） | 32 个变异全部让目标测试失败；**按 `ERR_ASSERTION` 计 29/32**。本次相关的全部以断言检出：M23（不认身份）、M24（不停进程，重新锚定）、M28（目标读取移出队列，重新锚定）、M29（误停其他应用，重新锚定）、**M30（`registrationId` 退回内容指纹，伪装成 UUID 形状）→ AH-PK06 的 `notEqual` 与 AH-PK11 的 `registration-replaced` 断言杀死**、M31（`stopping` 推迟到后一个队列步骤）、M32（stopping 检查不在定义采纳之前）。**不计入的 3 个是早已存在、本次未动的变异**：M01（H02 由产品自身的 `DATA_ROOT_BUSY` 报错失败）、M16（AH-R12 由测试替身抛出的 `observer down` 失败）、M17（AH-MS02/03 的断言在回调里抛出，被 node:test 报成 `ERR_TEST_FAILURE`）。它们之前按 reason 正则计为检出；本次 runner 改为同时输出两种口径（`results.json` 每项新增 `failed` / `killed` 字段），退出码仍按原口径。把这 3 个改成断言检出需要改与 R-Q1 无关的测试，没有做。 | `rq1/logs/rq1-mutations.log`、`../mutations/results.json`、`../mutations/M3[0-2]*` |
| 真实 DSH B–F（最终 rc.43 字节） | 全新 `RUN=$CLAUDE_JOB_DIR/tmp/run-rq1`（之前不存在）；B–E：`HOME=$RUN/home-green`、`DSH_HOME=$RUN/home-green/dsh`、profile `g2`、端口 35413；F：`HOME=$RUN/home-live`、`DSH_HOME=$RUN/home-live/dsh`、profile `l1`、端口 35416；`env -i`；官方 DSH `0.1.5-alpha.1`（`bin.js` `0ff7f1d7…f2ac5`）、Node `v24.13.1`。**两个 profile 内实际装入的包** `.inputs/hanamesh-dsh-app-host-0.1.0-rc.43.tgz` SHA-256 = `0867f969…ffaf`，`node_modules/@hanamesh/dsh-app-host` 版本 `0.1.0-rc.43`，**解包后的 `dist/manager.js` SHA-256 = `15b9a251…65d7`**，与 tgz 解包的 `dist/` 逐文件相同；F 的 profile 里夹具 `dsh.js` 用的是 `registrationId`。结果全部一次跑通，没有失败或作废段（`rq1/logs/probes.jsonl` 56 行全部有效）：**B** 注册 1 次、open→ready→进程 1→close→进程 0、留一个运行中进程后停 DSH → 进程 0；**C** `remove hanamesh-core` rc=0、启动正常（Chrome 根 200、HanaMesh 路由 404、无 console error）、进程 0；**D** 恢复后注册 1 次、同一实例 `e5e1e340`；**E** live `remove` 应用后 DSH 不卸载 bundle（上游行为，同 §4.4），重启后应用列表空、进程 0、实例记录保留；**F** live 禁用宿主 → 进程 0、路由 404；恢复宿主 → 注册 1 次；**应用开着时禁用应用 → 入口的 disposer 以 `registrationId` 调 `unregister`，500ms 内应用列表为空、进程 0**；恢复应用 → 注册 1 次。7 次事件读取 `duplicateSequences` 都是 0，4 次 storage 计数都是 6；usage 上报 0 次（记录桩只收到 5 次 `POST /v1/identity/devices/challenge`）。Cordis 日志旁路只有 1 条 warn（`web-server` `ECONNRESET`，宿主重载时浏览器连接被断，前两轮同样各 1 条），没有 `INVALID_REQUEST` / `UNREGISTER_STOP_INCOMPLETE`。 | `rq1/logs/isolation.txt`、`installed-bytes.txt`、`versions.txt`、`inputs-sha256.txt`、`probes.jsonl`、`boot-summary.log`、`steps.log`、`live-cordis-log.jsonl`、`stub-requests.jsonl`、`regstub-requests.log`、`rq1/ui/` |
| 未重跑：A、RED、兼容门（cA v1 / cB 坏定义 / cU UI 提示） | 本次改动只在 `register`/`unregister`/`stop` 的队列体和 open 的 stopping 检查顺序。A（先装应用后装宿主）只走「订阅→register」，不调 `unregister`、不 open；RED 和 cA/cU 用的是 v1 入口（顶层 `inject`），不经过 `unregister`，其结论（移除套件后 boot rc=1、市场提示）由 Cordis 启动审计和已装扫描决定，扫描代码本次没改；cB 坏定义在 `validateDefinition` 处抛出，早于 `registrationId` 生成。所以这些门的证据仍是首轮旧字节（`3047353d…`）上的，没有在 rc.43 上重跑。 | — |

**说明（QUALITY R-Q4 要求的那句）：** SPEC R2 竞态（排队中的 open 与 `unregister`）以及本次的重载顺序，**只有单测（AH-PK08/PK10/PK12）和变异（M27/M28/M31/M32）作证据**；真实 DSH 上没有复现过，也无法从 UI 稳定触发——B–F 只证明修复没有让常规路径回退。

**QUALITY 建议项现状（没有悄悄扩大范围）：**
- **R-Q2（重载窗口的用户可见失败）：部分处理，因为它与 R-Q1 的「同名重载清理顺序」是同一段代码。** 宿主侧现在给出确定的可重试 `INSTANCE_STOPPING`，CONTRACT/APP_PACKAGE 写明「停止事件之后重试」。**未做：** 市场客户端（`client-ui.js`）收到 `INSTANCE_STOPPING` 不会自动重试，用户会看到一次失败、需要再点一次；这是 UI 行为，留给 PM 决定。
- **R-Q3（已装扫描只信自报 `contractVersion`）：未做。** 自报 v2、入口仍是顶层 `inject` 的包仍会被标成 `host-optional`。
- **R-Q4（证据留痕）：已做**（本节「真实 DSH B–F」行与 `rq1/logs/installed-bytes.txt`，以及上面那句说明）。
- **R-Q5 / SPEC R5（坏定义的 Chrome 截图、宿主侧可查询的注册失败状态）：未做。**
- **变异口径残余：** M01/M16/M17 不以 `ERR_ASSERTION` 检出（见上表）。

## 0. SPEC 整改结果（rc.42 字节 `95cf8af3…f47d`，已被 §0R 的 rc.43 取代）

| 项 | 处理 | 证据 |
|---|---|---|
| **R2** `beginOpen`/`unregister` 竞态（复核时为推断） | **已实测复现并修复。** 在 70723a7 上，`AH-PK08` 让一个 Open 已读过定义、还排在串行队列里时执行 `unregister`，结果是被撤销的 `race-app` 仍被预留并 spawn（实例 `starting`、真实 pid）。修法在 `src/manager.js`（AppHost 自有代码）：① `#prepareOpen` 进入串行队列后重新核对 `this.#definitions.get(app.id) === app`，不一致按 `APP_NOT_REGISTERED`（404）拒绝；② `unregister` 删除定义后，在串行队列内读取要停的实例，正在落盘的预留会先完成，然后被停掉。 | 修复前 RED：`logs/rework-r2-red-on-70723a7.tap`（PK08、PK10 失败）。修复后：`AH-PK08`（排队中的 Open 必须被拒、该 app 无任何实例记录）、`AH-PK10`（真实文件存储的 save 被卡在中途时 `unregister`，结果 `stopped:1`、进程退出、状态 `stopped`）。变异 `M27`、`M28` 分别打掉两道防线，都被检出。 |
| **R3** 不误杀 | 补 `AH-PK09`：两个应用各开一个真实进程，`unregister` A 后，A 的进程退出，B 的 pid 存活且状态仍为 `ready`。旧代码同样通过（原本就按 `appId` 过滤），本次补的是覆盖。变异 `M29`（不按 appId 过滤）被检出。 | `logs/rework-tests.tap`、`logs/rework-mutations.log` |
| **R1** 证据披露 | 本报告 §1 的 F 行改为精确引用最终有效段；§3 改正 HOME 的说法；§4A 新增 `probes.jsonl` 全段索引（含失败/作废段、根因及其已证/未定状态）与同 tag 文件对应关系。原始日志未删、未改。 | §1、§3、§4A |
| **R4** 版本留痕 | `logs/rework-versions.txt`：`dsh --version` → `0.1.5-alpha.1`；Node `v24.13.1`；`@deepseek-ai/dsh@0.1.5-alpha.1` 的 `lib/bin.js` SHA-256 `0ff7f1d7…f2ac5`（与 P02 独立验证报告一致）；Cordis `4.0.2`；pnpm `11.7.0`。 | 同左 |
| **R5** 坏定义的 UI 截图 / 宿主侧可查询状态 | **未做**（复核标为建议，由 QUALITY/PM 定）。现状：`state:"invalid"` 只有 API probe 证据（`logs/probes.jsonl:169`）和 Cordis error 日志。 | — |
| 整改后的模块门 | Node 24.13.1：179 tests = 176 pass / 0 fail / 3 skip（新增 PK08–PK10）；build、`check:consistency`、`test:types` 通过；变异 29/29 检出（新增 M27–M29，M24 改锚到 stop 调用，不变量不变）；离线 tarball consumer PASS（对最终包重跑过）。重打两次包，字节相同。完整测试跑在文档改动之前；之后 `src/` 没有变化，只改了 README/APP_PACKAGE/CONTRACT，因此对引用 APP_PACKAGE 的 `tests/app-package-lifecycle.test.mjs` 重跑了一遍（10/10 通过）。 | `logs/rework-tests.tap`、`rework-build-consistency-types.log`、`rework-mutations.log`、`rework-package-smoke.log` |
| 整改后的真实 DSH 回归（最终字节 `95cf8af3…f47d`） | 全新 `RUN`/`HOME`/pnpm store；已核实 profile 内装上的 `dist/manager.js` 含修复。B（先宿主后应用、open/close 进程 1→0）、C（移除 Core 后启动正常、进程 0、6 个 storage 文件不变）、D（恢复后注册 1 次、同一实例、0 重复事件）、E（重启后卸载生效、进程 0）、F（live 禁用宿主/应用时运行中进程停止，恢复后各注册 1 次，0 重复）**每项一次跑通，没有失败或作废段**（`rework/logs/probes.jsonl` 1–56 全部有效，7 次事件读取 `duplicateSequences` 都是 0，4 次 storage 计数都是 6）；usage 上报 0 次（桩只收到 5 次设备 challenge）。同一组 B–F 先在中间字节 `eedf454d…060b` 上跑过一次，同样全部通过，存于 `rework/superseded-eedf454d/`；那份包与最终包只差 README/APP_PACKAGE/CONTRACT 三个文档（解包 `diff -rq` 核对过），因为改了随包文档，所以在最终字节上又跑了一遍。A、RED、兼容门（v1、坏定义、UI 提示）没有重跑：它们不经过 open/unregister 路径，证据仍是首轮（旧字节）。 | `rework/logs/`（`probes.jsonl` 1–56 全部有效、`boot-summary.log`、`steps.log`、`inputs-sha256.txt`、`live-cordis-log.jsonl`、`stub-requests.jsonl`）、`rework/ui/` |


## 1. 结论

| 门 | 结果 | 证据 |
|---|---|---|
| RED：v1 入口（APP_PACKAGE v1 原文）+ Core46/AppHost41，`dsh plugin remove hanamesh-core` 后启动 | **复现**：remove rc=0，boot **rc=1**：`@hanamesh/app-contract-fixture/dsh: pending (waiting for service: hanameshApps)` | `logs/red-remove-core.log`、`red-dump-after-remove.log`、`red-b-host-removed.boot.log` |
| A 先装应用、后装宿主 | PASS：只有应用时 DSH Web 可用（根 200，HanaMesh 路由 404）；装 Core 后应用注册 1 次 | `gA*`、`ui/gA1-app-only-home.*` |
| B 先装宿主、后装应用 | PASS：注册 1 次；open→ready→自有进程 1→close→进程 0；事件无重复 | `gB*`、`probes.jsonl` |
| C 宿主消失、应用仍在 | PASS：`remove hanamesh-core` rc=0，应用 bundle 与 loader 条目仍在；**boot 正常**（Chrome 根 200、无 HanaMesh 入口、路由 404）；进程 0；6 个 storage 文件不变 | `gC*`、`ui/gC-host-removed-home.*`、`gB/gC/gD-storage-files.txt` |
| D 宿主恢复 | PASS：注册 1 次；同一实例 id（单实例槽位与数据目录复用）；事件序号 0 重复 | `gD*` |
| E 应用主动卸载（重启后生效） | PASS：`remove @hanamesh/app-contract-fixture` 后启动，应用列表空、进程 0、实例记录与 storage 保留 | `gE*` |
| F 运行中卸载/恢复（DSH 自身 live patch reload，`disabled: true`） | PASS：应用开着时禁用宿主 → 自有进程停止、`view.stopped`/`instance.stopped` 各 1；恢复宿主 → 注册 1 次；应用开着时禁用应用 → `unregister` 撤下定义并停掉进程（进程 0）；恢复应用 → 注册 1 次；全程 0 重复事件 | **只有** `logs/probes.jsonl:145-165` 这一段是有效证据（09:56:12–09:56:26 那一轮，全新 `home-live`）；`lF.boot.log` 与 `live-cordis-log.jsonl` 是同一轮，`ui.jsonl:7` 是该轮截图，`ui/lF1-host-disabled-home.png` 被该轮覆盖。其余 lF/lD 段见 §4A。新字节上的复跑见 §0。 |
| 应用定义错误不被吞 | PASS：坏 v2 定义（缺 `{{dataDir}}`）时 DSH 照常启动；Cordis error 级日志以包名报出 `MISSING_RUNTIME_BINDING`；不注册任何东西；市场已装行 `state:"invalid"`；套件移除后 DSH 仍能启动 | `cB*`、`compat-cordis-log.jsonl` |
| 旧 v1 包在 rc.42 上 | 宿主在时可用，扫描标 `contractVersion:1 / hostLifecycle:"host-required"`；真实 Chrome 的市场「已安装」行显示「旧版应用契约：卸载 HanaMesh 套件前请先卸载此应用，否则 DSH 无法启动」；**移除套件后仍 boot rc=1**。rc.42 修不了已封的旧包 | `cA*`、`ui/cU-v1-on-rc42-market.*` |
| 未授权零上报 | PASS：Core 指向本机记录桩，全程只有 `POST /v1/identity/devices/challenge` ×18（设备注册尝试，与同意无关）；`/v1/usage/events` 0 次 | `stub-requests.jsonl` |
| 单测/构建/类型/一致性（首轮，旧字节；整改后数字见 §0） | 176 tests：173 pass / 0 fail / 3 skip（基线 165/0/3，新增 8）；build、`check:consistency`（X01 4/4）、`test:types` 通过 | `rc42-tests.tap`、`rc42-build-consistency-types.log` |
| 变异（首轮；整改后 29/29 见 §0） | 26/26 检出（新增 M23–M26：unregister 身份、unregister 孤儿进程、v1 未标注、入口检查放行 v1） | `rc42-mutations.log`、`../mutations/M2[3-6]*` |
| 干净 tarball 消费者（首轮；整改后见 §0） | PASS：离线隔离安装 rc.42 tgz，真实自有进程 + `checkAppPackageEntry` + `unregister` 停止 runtime | `rc42-package-smoke.log` |

## 2. 方案取舍（真实 DSH 依据）

- **采用：应用动态订阅已有的 `ctx.inject`。** DSH 0.1.5-alpha.1 启动审计（`dsh-app-boot` `assertEntriesActivated`）只检查 Loader 条目自身的 fiber。没有顶层 `inject` 的 bundle 是 active 的；`ctx.inject(['hanameshApps'], …)` 建出的子作用域不是 Loader 条目，不进入这项审计。Cordis 4.0.2（钉版）的 `inject` 没有可选依赖语义：数组和映射写法都表示必需。所以「改成可选注入」的写法在这个内核上不存在，子作用域订阅是唯一现成的公开扩展点。AppHost 自己早就用同样方式订阅 `credentials` / `llm` / `hanameshUsage`。真实 DSH 门 A–F 证明了它的行为。
- **否决：安装/卸载联动。**
  - `dsh plugin remove hanamesh-core` 只是 CLI 改 profile、调 pnpm，不级联卸载依赖它的应用（`red-dump-after-remove.log`：应用条目仍在），也不给任何插件留卸载钩子：那一刻 DSH 没在运行，Core/AppHost 的代码都不执行。
  - 市场 UI 本来就禁止从市场卸载套件。
  - 要做联动只能改 DSH CLI，或让每个卸载入口都替应用兜底，两者都越出本仓边界。
- **宿主侧补充（同仓，必要的最小接口）：**
  - `AppHost.unregister(appId, definitionHash)`（rc.42 形状；rc.43 起为 `unregister(appId, registrationId)`，见 §0R）：订阅作用域结束时调用。它只撤下完全相同的那次注册；先撤定义，再经正常停止路径停掉该应用的自有 runtime；实例记录和数据保留。宿主正在关闭时是 no-op。
  - `checkAppPackageEntry`：供应用仓自测，不执行入口。
  - 已装扫描新增 `contractVersion` / `hostLifecycle`，市场列表据此对旧包写明卸载顺序。
  - 没有新增 dependency / peer / vendor / config。

## 3. 测试脚手架（如实披露，不计为产品能力）

- **隔离（更正）：** `HOME`/`DSH_HOME` 是**按 scenario 名**分的（`$RUN/home-<scenario>`），不是每个场景一个。同一 scenario 下的多个 profile 共用一个 `DSH_HOME`，而 storage 按 `DSH_HOME` 存：`red`（p1/p2/p3）、`green`（g1=A、g2=B–E、g3=作废的 gF）、`live`（l1，最终 lF 之前已整目录删除重建）、`compat`（c1）、`compatui`（c2）。A 在 g1 里从没开过实例，B 开始时 `instances` 为空（`logs/probes.jsonl:6`），所以 B–E 的结论没有被 A 污染；g3（gF）因共用而作废。整改复跑用的是另一个全新的 `RUN`（`run-rework`）。其余隔离条件：端口 35411–35418，`env -i` 启动，pnpm store 隔离。DSH 是官方 0.1.5-alpha.1 CLI（Desktop 依赖目录里的 `bin.js`），Node 24.13.1。没有碰 `~/.dsh`、3080、研究 runtime，也没有碰 P01/P04/P02 原 profile。
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

## 4A. `logs/probes.jsonl` 全段索引（原始日志不删、不改）

| 行 | 运行 | 有效？ | 现象 | 根因 |
|---|---|---|---|---|
| 1–2 | RED p3（宿主在） | 有效 | 注册 1 次 | — |
| 3–40 | A（g1）、B–E（g2） | 有效 | 见 §1 | — |
| 41–56 | `gF`（g3，与 g1/g2 共用 `home-green`） | **作废** | live 禁用宿主未生效（`:45` 仍 200） | 已证有二：共用 HOME（非全新）；patch 写法为原地截断再写（同下）。gF 的文件在 `logs/superseded/gF*` |
| 57–62 | `lF-startup-disabled` / `lF-live` 诊断 | 有效（诊断） | 启动时 `disabled:true` 生效；对运行中 DSH 追加写（`>>`）禁用宿主 2s 内生效 | — |
| 63–83 | 第一轮 `lF`（`home-live` 首次） | **失败/作废** | `:67` 禁用宿主 30s 未生效（仍 200）；`:77` 禁用应用 20s 未撤下 | **根因未直接证实**：这一轮没有日志旁路。写法为 `cp base` 再 `>>` 追加（两次写），与下述已证的原地写问题同类，推定同因 |
| 84–93 | `lD` 第 1 次（无日志旁路） | **失败** | `:85`、`:91` 恢复宿主时 `want 200 got 404`（20s） | **未直接证实**：无日志；恢复写法为 `cp` 原地覆盖，推定同因 |
| 94–103 | `lD` 第 2 次（日志旁路放在仓内） | 有效（诊断），但不作证据 | 全部切换 500ms 内生效 | 同样是原地写却成功，说明这是**时序竞态**，不是每次都失败。该轮日志已被第 3 次运行截断覆盖，丢失；旁路放在仓内还触发了 `client-modules` 的「multiple active Loader sources」warn |
| 104–113、114–123 | `lD` 第 3、4 次（日志旁路移到仓外） | **失败** | `:105`、`:111`、`:115`、`:121` 恢复宿主 `want 200 got 404` | **已证**：`logs/superseded/live-diag-cordis-log-inplace-write.jsonl` 记录了 DSH HMR `config reload … failed: … must be a top-level YAML array of loader patch entries`，即读到被截断的半截文件，此后的变更事件被合并，没有再次重载。改为「写临时文件 → rename」后不再出现 |
| 124–144 | 第二轮 `lF`（复用 lD 残留的 `home-live`） | **作废** | `:125`、`:134` `open` 403；`:137–141` 禁用应用时本来就没有进程，**证明不了 unregister 能停进程** | **已证**：probe 复用了上一轮已存在的 viewId `v-f`/`v-f2`，又不带该 lease 的 token，`#checkToken` 返回 `LEASE_NOT_OWNED` 403 |
| 145–165 | 最终 `lF`（删除重建的 `home-live`、原子写） | **有效** | 见 §1 F 行 | — |
| 166–171 | 兼容门 cA/cB | 有效 | 见 §1 | — |

同 tag 文件对应：
- `lF.boot.log`、`lD.boot.log` 每轮被覆盖，现存的是最后一轮：`lF` = 09:56:12 有效轮，`lD` = 第 4 次。
- `logs/boot-summary.log` 按时间追加：09:56:12/09:56:26 两行属于有效 `lF`；09:48:31、09:55:01 两轮作废。
- `ui.jsonl` 的 `lF1-host-disabled` 共三条，只有第 7 行属于有效轮：第 5 行是第一轮（宿主其实没被禁用，仍请求了 `installedPlugins 200`），第 6 行是第二轮，第 4 行是 gF。
- `logs/live-cordis-log.jsonl` 在有效 lF 开始时被清空，只含该轮。

## 5. 公开契约变化与旧消费者迁移（VIBE 唯一来源须另卡）

- **契约变化：**
  - `docs/APP_PACKAGE.md` 升为契约 v2（v1 入口标为废弃，仅用于识别旧包）。
  - `docs/CONTRACT.md` 新增 `unregister`，已装行新增 `contractVersion`/`hostLifecycle`。rc.43：`register` 返回 `registrationId`，`unregister(appId, registrationId)`。
  - `index.d.ts` 新增 `unregister`、`checkAppPackageEntry`、`APP_PACKAGE_CONTRACT_VERSION`。
  - 既有 `register`、市场和路由行为不变，全量回归已覆盖。
- **Vibe（当前 rc.36 仍是 v1，本卡未改它的字节，也不称它已修好）需要在 VIBE 仓：**
  1. `dsh.js` 删除 `export const inject = ['hanameshApps']`。
  2. 保留 `validateConfig(config)` 与读取 `app.json`，改为 `ctx.inject(['hanameshApps'], scoped => { const apps = scoped.get('hanameshApps'); const { appId, registrationId } = apps.register(definition); return () => apps.unregister(appId, registrationId); })`（rc.43 起；rc.42 草案里的 `definitionHash` 形状已作废，传它会以 `INVALID_REQUEST` 抛出）。当前的 `APP_HOST_REQUIRED` 顶层抛错正是要去掉的那一点。
  3. `package.json`：`peerDependencies["@hanamesh/dsh-app-host"]` 改为 `"0.1.0-rc.43"`（rc.43 起才有 `registrationId`；更旧的宿主没有 `unregister` 或参数不同），`hanamesh.contractVersion: 2`，并发新版本号（同版本字节不可变）。
  4. 在自测中调用 `checkAppPackageEntry(entry, pkg)`。
- **Core：** 发新版本，把依赖 `@hanamesh/dsh-app-host` 钉到 rc.43（不是 rc.42）。
- **复验：** 由不同 validator 从新冻结组合重跑 P02-U03 旧真实路径：市场装 Vibe（v2）→ 直接 `remove hanamesh-core` → DSH 可启动 → 重装 → 只注册一次、资源归零。

## 6. 产物

- **当前候选包：** `artifacts/hanamesh-dsh-app-host-0.1.0-rc.43.tgz`，SHA-256 `0867f969f023b281bd2bf2a1aa158c75dc8838cbbcb53f8bb63dfce2a66bffaf`（§0R 的真实 B–F 装的就是这份字节）。
- **作废的 rc.42 候选（只留历史）：** `95cf8af3f102fee25fe7ba890294135585273f37aba3b4d85020671aa933f47d`（提交 `d945ee6`，§0 的真实回归跑在它上面；含 R-Q1 缺陷）、`eedf454d…060b`（未提交）。
- **作废的首个候选：** SHA-256 `3047353d10123b1987e6e41a59e3ddd7ccaa76c5c8a6dfaad56d6bc79c6c3615`（提交 `70723a7`，含 R2 竞态）。§1 中 A–F、RED、兼容门的真实证据都跑在这份旧字节上。
- **固定输入：** 摘要见 `logs/inputs-sha256.txt`，与卡面一致：Core46 `829999…f416`、Usage10 `c69c97…864e`、AppHost41 `457b0c…7134`。
- **复跑方法：** rc.43 复跑：先设 `RUN`、`EVID`、`APPHOST_TGZ=<rc.43 tgz>`、`FIXTURE=hanamesh-app-contract-fixture-0.0.4.tgz`（夹具用 `node tests/fixtures/app-package/build.mjs v2 $RUN/inputs <node> 0.1.0-rc.43` 生成），regstub 参数换成 `0.1.0-rc.43`；不设时脚本默认仍是首轮的 rc.42 / 0.0.2。`harness/` 下的 `setup.sh`、`run-red.sh`、`run-green-a.sh`、`run-green-b.sh`、`run-green-e.sh`、`run-live-f.sh`、`run-compat.sh`、`run-compat-ui.sh` 可原样复跑。需要先启动 `stub.mjs` 和 `regstub.mjs`，路径变量见 `env.sh`。

## 7. 未跑 / 未证

- 原生 Desktop 客户端：NOT_RUN（本卡只要求 DSH Web 真门）。
- 真实 Vibe 包走 v2：不存在，需要 VIBE 卡。
- 公共分发：仍是 `PUBLIC_DISTRIBUTION_NOT_AVAILABLE`。
- SPEC 独立复核已做（SPEC_PASS，附 R1/R2 条件，已处理）；QUALITY 独立复核已做（QUALITY_FAIL，唯一阻塞 R-Q1，§0R 已处理）；R-Q1 的窄复审尚未做。
- QUALITY 建议项 R-Q2（市场客户端不自动重试 `INSTANCE_STOPPING`）、R-Q3（已装扫描只信自报 `contractVersion`）：未做，见 §0R。
- 变异 M01/M16/M17 不以 `ERR_ASSERTION` 检出（早已存在，本次未改）。
- R2 竞态与重载顺序在真实 DSH 上没有复现，只有单测与变异证据。
- R5（坏定义的 UI 截图、宿主侧可查询的注册失败状态）：未做。
- 在 rc.43 字节上没有重跑 A、RED 与兼容门（理由见 §0R）。
