# app-host 验收报告

> **2026-09-12 回收判定后的当前状态：`0.1.0-rc.2` · `DELIVERED`（等用户验收），见文末「回收判定记录」。** 下面是 rc.1 交付方的原始报告，按规矩原样保留。

---

## rc.1 交付方原始报告

**最终状态：PARTIAL；没有标 DELIVERED/ACCEPTED，没有解锁 workspace。**

本仓是独立新实现候选，不是指定私有原型的提取交付。真实进程 fixture 是 Node 应用子进程，会监听 HTTP 并写入分配的数据目录；不是只返回固定结果的 mock。但是这仍不能替代固定 DSH profile 或实际原应用/工作台的验收。

## 实际执行汇总

- 自动化套件 **41 项：39 通过、0 失败、2 skip**；2项是浏览器因管理员回环访问策略受阻，产品矩阵没有记 PASS。
- **4/4 真实源码变异被检测**：撤掉单实例复用、调反预留/启动、调反停止/确认、撤掉 socket 所有权检查；各自未修改基线先通过。
- 构建、TypeScript 5.8.3 消费端正/负类型检查、双视图真实进程 demo smoke 已通过。
- X02 两个原子组分别在临时文件 fsync 后、完整镜像发布后真实 SIGKILL；X03 两个跨介质边界分别真实 SIGKILL；另有完整宿主被杀后精确恢复用例。**不是用 throw/finally 代替强杀。**
- 执行平台为 Linux / Node22.16.0；macOS/Node24/真实DSH没有被偷偷记成运行过。CI 文件已编写，但未在 GitHub Actions 执行。

## 独立安装验证

已把固定 tarball 离线安装进新的临时 npm 工程，从包名加载 `. / ./client / ./dsh` 三个出口；该工程自己的应用进程实际写盘、就绪并清理成功，未 import 源码树。DSH 默认入口仍按设计拒绝未绑定加载。

包：`hanamesh-dsh-app-host-0.1.0-rc.1.tgz`，40216 bytes。SHA-256：`e6ab6dd44922a925ee697029afde5abe34bb3d39265cc7c4197cfc5ac5317ccb`。`package-smoke.log` 为实际输出。

## H01–H14 / X01–X03

“PASS”只表示本行列出的证据成立；带真实宿主/浏览器要求的行保留 PARTIAL 或 BLOCKED。H02/H03/H06 按输入 brief 的严格门保留 PARTIAL，不能拿 fixture 结果自动关掉正式 FIX-01/FIX-02。

| ID | 产品验收 | 已有证据及限制 |
|---|---|---|
| H01 | PARTIAL | Independent build/package/import validated; real DSH load BLOCKED |
| H02 | PARTIAL | 8 concurrent actual application subprocess opens; one PID; M01 mutation detected; target DSH/prototype integration not verified |
| H03 | PARTIAL | Two actual app data roots contain distinct runtime-written files; controlled example, not target profile validation |
| H04 | PASS | Three same-view reopens; one lease; same generation |
| H05 | PASS | Two views; close one preserves serving process; last close terminates it |
| H06 | PARTIAL | Fresh-host exact persistent slot/data/view restore and SIGKILL recovery; no target DSH or actual upstream document recovery claim |
| H07 | PASS | Forged, stale generation and cross-owner close rejected; lost receipt recovery fenced |
| H08 | PARTIAL | Busy stop response and one durable notification per view verified; workbench receipt/display not integrated |
| H09 | PARTIAL | External app remains alive across close/stopAll/dispose and no signal observed; real DSH plugin unload not run |
| H10 | PARTIAL | TTL scanner stops actual child without unload; browser kill test BLOCKED by administrator navigation policy |
| H11 | BLOCKED | Real DSH storage-domain and DSH session roundtrip unavailable |
| H12 | PARTIAL | Real SIGKILL host + guardian cleanup + durable local sidecar owner; real DSH medium not verified |
| H13 | PARTIAL | HTTP body/header/gzip/SSE/WebSocket tests PASS; real browser embedding blocked |
| H14 | PARTIAL | Actual HTTP command/env/path/url and CSRF/auth rejection PASS; browser iframe end-to-end blocked |
| X01 | PASS | Local declaration checker validates two groups and two boundaries |
| X02 | PARTIAL | Both groups tested at pre/post snapshot publication with real SIGKILL; all-or-none local disk PASS, real DSH domain pending |
| X03 | PARTIAL | Both production ordering boundaries real SIGKILL PASS; reversed-order source mutations detected; real DSH domain pending |

## 原始证据

`tests.tap` 是最终测试；`mutation-summary.log` 与 `mutations/*-{baseline,mutant}.tap` 为基线/故意破坏结果，后者预期为失败；`mutations/results.json` 包含对应源码哈希。`build.log`、`types.log`、`demo-smoke.log`、`package-smoke.log`（随最终 ZIP）分别记录构建、类型、演示和安装隔离验证。

`browser-blocked-attempt.tap` 保存最初真实浏览器尝试：Chromium 成功启动，但 `Page.navigate` 返回 `net::ERR_BLOCKED_BY_ADMINISTRATOR`。没有修改 policy 或关闭安全头。最终测试对该环境条件明确 skip；不是掩盖实现失败。浏览器用例保留，以便在有权限正常访问本地 profile 的测试环境运行。

`development-history/` 留有开发期间清理 hook 顺序、HTTP 测试主体选择等失败与修复记录；这些不是最终测试结论。没有声称首轮全部通过。

## 一致性证明的准确边界

X02 从被杀进程的磁盘快照，用新的 store reader 和新的 writer lock 读取，不复用该进程内存。每组事实必须全成立或全不成立。X03 reserve-launch 在应用已真实写盘后杀宿主，断言磁盘存在 instance+lease 归属，再观察 guardian 清理。

X03 stop-publish 同时记录切口时真实 `ps` 状态与强杀后重新读取的状态，防止 guardian 紧接着清理掩盖曾经错误的 stopped 确认；调反源码顺序后会以 STOP_BOUNDARY_UNSAFE 失败。测试没有假称任意延迟后的重读仍能观察已被补偿掉的每个瞬态。

这些测试证明所注入的进程中断路径，不等于整机物理断电、磁盘损坏、guardian/launcher同时被强杀或所有并发交错。真实 DSH single domain 需要重做同等级验证。

## 未完成项

原型提取及 commit/license 核验、真实 DSH bridge 和 profile 加载、DSH session 写后自读、目标macOS端口/进程验证、合法环境中的浏览器端到端验收、用户亲验、远程建仓/推送。后续顺序见 `../DSH_INTEGRATION.md`。

当前官方 FIX-01/FIX-02 门不应关闭，MOD-03 不应仅因拿到 rc tarball 而开工消费一个未经最终兼容核验的协议。


---

## 回收判定记录（2026-09-12，未参与交付的 session）

执行者：Claude Opus 5（1M context），按 `PROCEDURE.md` §2.4；判定标准只认 `DEV_BRIEF.md` §9 的 H01–H14 + X。环境：macOS arm64 / Node 24.13.1 / DSH 0.1.5-alpha.1 @ 5dda764 / Google Chrome 152（隔离临时 profile）。

### 判定

| 交付方自报 | 判定 | 处理 |
|---|---|---|
| DSH 侧未实现（`apply()` 抛 DSH_BINDING_REQUIRED，bridge 端口为猜测形状） | **范围缺口，但在本模块范围内**：brief §1/§4/§9 把 MOD-04 定义为 DSH 插件本身（H01 真实 profile 加载、H11 storage-domain sidecar） | 按用户指示在本模块实现：`d4fbcc0`，绑定固定版本包**声明过的**公开 API（`storageDomain.open` single 布局 global、`webServer.register`、`connection.requestRejection`、`provide/effect`） |
| Linux / Node 22 | 本机为目标平台 | 48/48 在 Node 24.13.1 重跑（含原 2 项浏览器 skip） |
| 浏览器被管理策略挡住（H10/H13 BLOCKED） | 本机有 Chrome | 首跑**两项都红**：交付的 `WorkspaceAppClient` 以 `this.fetcher(...)` 调用未绑定的 `fetch`，浏览器一律 "Illegal invocation"，只在 Node 里能用。`09ac11d` 修复后 2/2 PASS |
| 4 项变异 | 重跑 | 4/4 DETECTED（变异副本需链接已安装依赖，脚本已改） |
| 真实 Cordis 组合下卸载 | 新发现 | 整 root 卸载时 storage-domain 与本插件并行拆除，`stop()` 的「先持久化 stopping 再发信号」写入失败 → **自有进程被遗留**。`87eb6f2`：宿主关闭中持久化失败仍向 runtime 发信号（不宣称 stopped），dispose 总是释放介质 |

### 逐项（本次实际执行）

| ID | 状态 | 证据 |
|---|---|---|
| H01 | **PASS** · `REAL_HOST` | `recovery-20260912/h01-real-profile.log`：rc.2 tarball（sha256 `78ea039c…4dbe`）经 `dsh plugin add` 装入全新隔离 `web` profile，patch 插入 `@hanamesh/dsh-app-host/dsh` 行；真实 `dsh --profile h01` 启动，`/hanamesh/apps` 匿名 401 → `GET /?token=` 换 cookie 303 → 带 cookie 200 列表 → `POST /apps/open` 200 → 真实自有进程 ready（`ps` 见 pid/ppid）。**源码目录移走后仍能构建**：`scripts/verify-package.mjs` 离线独立安装 tarball，`.`/`./client` 无源码树 import；`./dsh` 无 peers 时是 `ERR_MODULE_NOT_FOUND`，不能冒充插件 |
| H02 | **PASS** · `REAL_HOST`（受控 fixture 应用，真实子进程） | `tests-node24.tap` "H02"：8 个真正并发 Open，一个 PID；M01 变异（撤掉合并）DETECTED |
| H03 | **PASS** · `REAL_HOST` | 两个多实例部署各自数据根内有**运行时写入的文件**（`write-<runtimeId>.txt`、`runtime-evidence.json`），不是空目录；H01 真实 profile 的 `app-data/…/single/` 亦如此 |
| H04 | PASS | 同 view Reopen ×3，租约计数 1、同 generation |
| H05 | PASS | 两 view 同实例，关一个仍服务，关最后一个才停 |
| H06 | **PASS** · `REAL_HOST`+`SIGKILL` | crash 套件 "H12/H06"：SIGKILL 宿主 → guardian 清理 → 新宿主按持久身份精确恢复 view/instance |
| H07 | PASS | 伪造／过期 generation／跨 owner 的 close 被拒 |
| H08 | PASS（模块内） | 占用时 Stop 拒绝并列出 views；停止后每个 view 一条持久通知。工作台展示归 MOD-03 |
| H09 | **PASS** · `REAL_HOST` | attach 实例在关视图／stopAll／dispose 下不收信号；`dsh-real-cordis.tap` "H09/dispose"：真实 Cordis 卸载移除路由、停自有实例、关 domain |
| H10 | **PASS** · `REAL_BROWSER` | `browser-real-chrome.tap`：SIGKILL 真实 Chrome 进程组、无 unload，租约到期后自有应用被实际停止 |
| H11 | **PASS** · `REAL_HOST` | `dsh-real-cordis.tap` "H11"：真实 storage-domain（json 后端）单元文件 `storages/hanamesh_app_host.json` 含 instance+lease（只有 tokenHash）；DSH 先用自己的 `sessions.create`+jsonl persistence 写 session，app-host 发布后 DSH 仍 `stat` 得到该 session。真实 profile 里同一文件见 H01 日志 (i) |
| H12 | **PASS** · `REAL_HOST`+`SIGKILL` | crash 套件：写入中途 SIGKILL 留下的是有 owner 的 sidecar 记录 |
| H13 | **PASS** · `REAL_BROWSER` | 具名 parent 内嵌、文档正文不变、直连顶层导航与 iframe 控制调用被拒 |
| H14 | **PASS** · `REAL_HOST`+`REAL_BROWSER` | 命令／可执行路径／env／URL 覆盖各 400 `UNKNOWN_FIELDS`；真实 profile 里 foreign origin 403、command 覆盖 400（H01 日志 g/h） |
| X01 | PASS | 2 groups / 2 boundaries |
| X02 | **PASS**（FILE_FIXTURE 介质）· 真实 DSH domain **NOT_RUN** | 两个 group 在 temp-fsynced／published 两点真实 SIGKILL；真实 storage-domain 后端的强杀未做——`global.set` 是后端的一次整体发布，其原子性由 DSH 后端负责，本轮未对其注入强杀 |
| X03 | **PASS** · `SIGKILL` + 反序变异 | reserve-launch / stop-publish 真实强杀，M02/M03 反序 DETECTED |

### 产物

`artifacts/hanamesh-dsh-app-host-0.1.0-rc.2.tgz`，sha256 `78ea039c7b10ba3714d44d11e9be86f2a9104b291de1c9e6c5b85cf676e44dbe`（`artifact-sha256.txt`）。运行时依赖：zod 4.5.4；peers：cordis ^4.0.2、dsh-storage-domain ^0.1.5-alpha.1、schemastery ^3.18.2。

### 什么还没验证

真实 storage-domain 后端上的 X02 强杀；Tauri/WKWebView 内嵌（R1 壳 + 本插件的联合验收归 workspace）；MOD-05 两个上游应用（归各自适配包）；原型 `research/…/hanamesh-app-host` 与本实现的契约差异未逐项对照（本实现是独立重写，非提取；提取源的 AH1–AH7/GW1–GW4 语义由本仓测试覆盖，但不是同一份代码）。

### 实际模型／用量

Claude Opus 5（1M context）；重试 0；人工介入 0（用户一次指示「模块内的就实现」）。

**本 session 只能标到 `DELIVERED`。`ACCEPTED` 要用户亲跑 brief §10 的五个动作并签名。**
