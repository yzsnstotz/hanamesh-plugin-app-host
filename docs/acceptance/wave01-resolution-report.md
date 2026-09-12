# Wave 01 app-host 阻塞修复与复验（2026-09-12）

**结论：`0.1.0-rc.3` 本地候选完成模块内修复与五个真实 profile 动作，待用户验收，未标 `ACCEPTED`。** 源基线 `20445c83ea79136c364e6b394875f93bb3307032`；隔离分支 `codex/app-host-acc-fix`。没有推送、打 tag 或修改共享 `STATUS.md`。rc.2 历史记录和摘要保持原样；rc.3 是新包，不复用 rc.2 的 SHA。

## 修复

| 问题 | 复现与成因 | 处理 |
|---|---|---|
| APP-ACC-01：`npm ci` 退出 1 | [原始红日志](wave01-lockfile-red-20260912.log)：缺 `dsh-invariants`、`dsh-brand`、`dsh-timeout` 的 `0.1.5-rc.2`。锁文件根仍是 `0.1.0-rc.1`，三项传递依赖的 `^0.1.5-alpha.1` 范围在当前 npm 解析下漂到 rc.2。 | 对这三项加 `0.1.5-alpha.1` override，重算锁文件并将 package/lock 根版本升为 rc.3。与其余已固定的 DSH 依赖保持同一目标版本。 |
| 干净安装后的类型检查不可重复 | 首跑 `npm run test:types` 退出 127：`tsc: command not found`；固定 TypeScript 后又因消费者测试还引用已移除的 `createDshPlugin` / `DshBridge` 退出 2。 | 固定 `typescript 5.8.3` 开发依赖，把 type consumer 对准当前 `apply`、`domainBinding`、`browserAuthentication` 契约。 |
| 有占用 Stop 的 HTTP 状态 | 真实 profile 动作 3 首跑给 `400`，虽已有 `INSTANCE_IN_USE` 与 `details.views`。`requireCondition` 默认状态是 400；既有 H08 只断言错误码。 | 先加路由回归测试并见其以 `400 !== 409` 失败，再把该错误映射为 409；回归测试与真实 profile 均通过。 |

`consistency.json` 的 `version: 1` 是一致性声明的 schema 版本，不是 npm 包版本；本次没有改变组、边界或介质承诺。[X01 复核](wave01-rc3-consistency.log)仍为 2 groups / 2 boundaries。

## rc.3 验证

环境：macOS arm64、Node `v24.13.1`、npm `11.8.0`、pnpm `10.33.0`、DSH `0.1.5-alpha.1`、Google Chrome `152.0.7977.84`。所有命令在隔离 worktree 内执行。原先未跟踪的主 checkout 失败日志未改动。

| 命令 / 证据 | 结果 |
|---|---|
| `npm ci` · [日志](wave01-rc3-npm-ci.log) | exit 0；安装 49 包，审计 50 包。 |
| `npm run build` · [日志](wave01-rc3-build.log) | exit 0。 |
| `HM_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm test` · [完整输出](wave01-rc3-tests.tap) | exit 0；**49/49**，0 skip；含 H10/H13 两条 `REAL_BROWSER` 和新 H08 路由回归测试。 |
| `npm run test:mutation` · [日志](wave01-rc3-mutations.log) | exit 0；**4/4** 源码变异被检出。 |
| `npm run test:types` · [日志](wave01-rc3-types.log) | exit 0。 |
| `npm run check:consistency` · [日志](wave01-rc3-consistency.log) | exit 0；2 groups / 2 boundaries。 |
| `npm pack --pack-destination artifacts --json` · [包清单](wave01-rc3-pack.json) / [原始输出](wave01-rc3-pack-raw.log) | exit 0；42965 bytes，24 个包内文件。 |
| `node scripts/verify-package.mjs artifacts/hanamesh-dsh-app-host-0.1.0-rc.3.tgz` · [日志](wave01-rc3-package-smoke.log) | exit 0；新临时 npm 工程离线安装包，独立真实应用写盘，源码树 import 为 0。 |
| 所有包内文档编辑完成后重新 `npm pack` 到另一临时目录 · [摘要核对](wave01-rc3-repack-check.log) | exit 0；新包与冻结的 rc.3 tarball SHA-256 完全一致，临时副本已清理。 |

rc.3 本地 tarball：`artifacts/hanamesh-dsh-app-host-0.1.0-rc.3.tgz`；SHA-256 **`fdde04917bfc68eb566044a941a9c7d1aeaa9b7c8b8de9635a55d03f32d2212c`**。[产物清单](wave01-rc3-artifact.json)记录 npm integrity 与各项证据。仓库 `.gitignore` 排除 `*.tgz`，因此包留在本地 worktree；源码、锁文件与 manifest 可重建它。

## §③ 五个真实 profile 动作

用 rc.3 tarball 在新建的 `DSH_HOME` 中从官方 `web` 模板创建 `acc` profile，以 `dsh plugin --profile acc add` 安装，并通过 `cordis.patch.yml` 绑定 `@hanamesh/dsh-app-host/dsh`。监听随机回环端口，真实 DSH launch token 换浏览器 cookie 后以同源请求操作。完整、已去凭据的机器结果见 [profile 记录](wave01-rc3-real-profile.json)；重复脚本为 [`scripts/acceptance-wave01.mjs`](../../scripts/acceptance-wave01.mjs)。没有输出 token、cookie 或租约凭据，也没有接触 `~/.dsh`。

1. **连点 Open：** 清单字面三次无凭据请求得到 `200 / 403 / 403`，后两次为 `LEASE_NOT_OWNED`。拿首次回执的 `leaseToken` 重试两次则为 `200 / 200 / 200`，三次同一 `instance.id`，实际进程数 1。这个差异是清单命令遗漏租约凭据；不放宽已有视图的所有权校验。
2. **两个 view：** `v2` 与 `v1` 同一实例；关闭 `v1` 后 `v2` 仍 `active`，实例仍 `ready`，原进程仍活着。
3. **占用 Stop：** `409 INSTANCE_IN_USE`；`details.views` 精确列出 `v2`。
4. **宿主重启：** 旧宿主正常退出且自有进程停止；同一 profile 重启后列表仍含 `v2` 与原 `instance.id`，`/apps/resume` 返回 200，新的运行时就绪。
5. **数据根：** 同一 `fixture/local/data-v1/single/` 目录内发现两份不同运行时写入的 `write-<runtimeId>.txt`，逐份读到应用实际写入内容；多实例间数据根隔离另由 H03 自动化用例覆盖。

收尾时第二次宿主退出码 0、所有记录的自有 PID 停止，临时 profile 删除。**清单动作 1 需改为首次 Open 保存 `leaseToken`、后两次带它重开。** 清单字面结果与安全契约不符，已明确留痕，不冒充原命令通过。

## 验收边界

真实 DSH storage-domain 后端上的 X02 强杀仍未运行；目前 X02 的强杀证据来自本地原子文件介质。Tauri/WKWebView 内嵌属于 workspace 联验。本报告只确认本模块此次可执行步骤与产物，不签 `ACCEPTED`，不解除依赖门。
