# app-host 0.1.0-rc.1 验收报告

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
