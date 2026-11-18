# @hanamesh/dsh-app-host

HanaMesh 应用运行插件：拥有应用实例、进程、视图租约、受控网关、应用运行环境与模型路由。市场已整体迁到独立 `@hanamesh/market`；本包不安装插件、不维护插件已装清单、不占用市场入口。

## 本次已实现

- **FIX-01：** 稳定 `viewId`、持久租约、generation fencing；同一 view 重开不增加匿名引用；原实例精确恢复；错误关闭拒绝；心跳超时自动回收；回执丢失后可由已认证 owner 显式恢复凭据，不重新绑定视图。
- **FIX-02：** 按 owner / app / deployment / data 身份在 spawn 前持久预留；并发 Open 合并为一个真实应用进程；多实例传入独立 data/HOME/XDG/TMP 目录，测试检查了应用真实写入的文件。
- **生命周期：** owned 进程由独立 guardian 管理；宿主被 SIGKILL 后清理自有进程组；attach 只释放附着；有占用时 Stop 拒绝并列出视图；确认清理后才发布 stopped 与逐 view 通知。
- **受控网关：** 固定数字回环上游、每代租约能力票据；只调整 XFO 和 CSP frame-ancestors，保留应用正文；HTTP 上传、SSE、WebSocket 可用；不向应用注入 SDK、不传宿主凭据、不改变应用 auth/CSRF/CORS。
- **交付契约：** ESM 包、TypeScript 声明、工作台侧 `./client` SDK、完整快照存储接口、DSH 插件入口、测试与崩溃一致性声明。
- **K5：** Electron 宿主必须显式给绝对且可执行的 `nodeBinary`；guardian/launcher 使用同一 Node，只继承 `DSH_HOME/HOME/LANG/TMPDIR/PATH` 白名单。未配置时 fail-closed 为 `NODE_RUNTIME_REQUIRED`。
- **Router：** 合并授权、撤销、文件投射 ledger 与 `sets`，来源为 DSH credentials/LLM 目录和 coding-oauth gateway；不搬 key 探测、录入或 OAuth 端口。
- **Runtime 供给（0.5.0）：** `@hanamesh/lib-provision` 从其私有 Git 源 tag 范围正常安装，DSH 入口调用公开 `provision`、`remove`、`ledger`。构建只复制本源 `src/`，不提取 vendor 或内联其他包；来源与许可边界见 `docs/PROVENANCE.json`。

## 运行

当前候选使用 Node 24.13.1、pnpm 10.33.0、TypeScript 5.8.3 与官方 DSH 0.2.1-alpha.2。先为本次运行显式设置隔离 HOME、DSH_HOME、TMPDIR、npm cache 和 pnpm store，再执行：

```bash
CI=true pnpm install --frozen-lockfile
pnpm run build
CI=true pnpm test
pnpm run test:contract
pnpm run test:mutation
pnpm run test:types
# 原生驱动契约（需要已安装并构建的上游 DSH dsh-v0.2.1-alpha.2 检出，不在 pnpm test 内）
AH_DSH_UPSTREAM=/absolute/upstream-checkout pnpm run test:native-driver
pnpm run check:consistency
pnpm run check:toolchain
pnpm run preflight
pnpm pack --pack-destination /absolute/card-run/artifacts
pnpm run verify:pack /absolute/card-run/artifacts/hanamesh-dsh-app-host-0.5.6.tgz
```

`@hanamesh/devkit` 仅为开发依赖，按声明的 Git 范围解析到锁定 e6ccf710 的 0.2.3，不进入 tarball 或运行时。43 个变异保留各自业务断言，`HANAMESH_APPHOST_RUN_DIR` 将证据写入本卡隔离子目录。lib-provision 仍是固定 575d63fb 的 0.2.1 原源包，正常 pack 随包分发并保留原 LICENSE；生产者使用 pnpm 要求的 hoisted 布局，不更改消费者的 exotic、peer 或脚本政策。

`verify:pack` 在独立目录先验证缺少宿主 peers 时准确报 `ERR_PNPM_PEER_DEP_ISSUES`，不强制 offline 或把缓存故障当缺 peer。随后显式提供九个直接 peers，加上官方 0.2.1-alpha.2 的 storage/scope 传递 peers，严格安装、冻结锁重装并核锁摘要，再消费公开 JS/TS。完整测试另在默认 pnpm11 的全新 HOME/store 下消费真实 tarball，保留正常 scripts/exotic/peer 政策。公开 browser 入口的解析/语法验证不代替原生 Loader 激活。

`pnpm run preflight:dsh [实际宿主项目绝对路径]` 只读检查实际 DSH/Cordis/storage-domain/schemastery 的精确 pins，并报告解析路径；不传路径时检查本模块开发目录，缺 DSH 本体会准确退出 2，不自动安装或伪称真实宿主。原生取证必须使用固定上游和独立 default Desktop profile，正常公开 CLI 安装同一最终 tarball，完成全部安全与 UI 门。

`devkit.config.mjs` 与 `scripts/*-cases/policy/probes` 保留本模块专用策略与断言。`pnpm run demo` 仅为受控本地示例，不是普通应用产品供给、真实 Desktop 或 owner 验收。

## 验收结果在哪里

[`docs/acceptance/REPORT.md`](docs/acceptance/REPORT.md) 分开记录真实进程、真实 SIGKILL、HTTP 传输、fixture、浏览器受阻及 DSH 未完成项；原始 TAP、4 组变异日志、干净目录包验证日志随完整源码 ZIP 一并交付；npm tarball 只含运行文件与契约，不含验收日志。浏览器测试不会修改管理员策略，也不会因为 skip 而把对应产品验收标为 PASS。

## 接入入口

| 消费者 | 入口 | 说明 |
|---|---|---|
| 受信宿主代码 | `@hanamesh/dsh-app-host` | `AppHost`、存储、路由、网关 |
| 工作台顶层页面 | `@hanamesh/dsh-app-host/client` | 明确的 Open 回执、恢复、心跳、Stop；禁止注入应用 iframe |
| DSH profile 适配 | bundle 自动落座包根；显式适配仍可用 `@hanamesh/dsh-app-host/dsh` | 包根懒加载 Cordis `apply`，使同一个 loader entry 同时被 client-modules 发现；见 `docs/DSH_INTEGRATION.md` |
| DSH 浏览器 UI | `@hanamesh/dsh-app-host/client-ui` | Core 继续使用中的应用视图、账号模型路由，以及 DSH 原生插件配置；Node 条件下 `./client` 仍解析到工作台 SDK |

契约详见 [`docs/CONTRACT.md`](docs/CONTRACT.md)、[`docs/ROUTER_CONTRACT.md`](docs/ROUTER_CONTRACT.md) 与 [`docs/LIBRARY.md`](docs/LIBRARY.md)，未完成步骤见 [`docs/DSH_INTEGRATION.md`](docs/DSH_INTEGRATION.md)，安全限制见 [`docs/SECURITY.md`](docs/SECURITY.md)。本仓不包含应用适配包、钱包权限或 provider runtime driver。

## GitHub 与来源

rc.3 修复只在本地隔离分支 `codex/app-host-acc-fix`；没有创建远程仓库、提交 PR 或推送。所需原型现在有本地副本，但尚未做逐项契约对照；不能把独立实现冒称为原型提取。

rc.1 原交付包的 ZIP 含本地 Git bundle 和提交信息。`scripts/publish-github.sh --create-private` 是**尚未执行**的历史发布辅助；执行前须重新核对目标仓与授权。

rc.1 原始输入当时标注 `UNLICENSED`，不是 MIT/Apache 授权声明；没有擅自给用户代码选择开源许可证。[`docs/PROVENANCE.json`](docs/PROVENANCE.json) 保留 rc.1 原始输入与当时环境记录；rc.3 的包摘要与复验证据见源码仓 `docs/acceptance/wave01-rc3-artifact.json`。

## METADATA-APPHOST-PROVISION-01（2026-10-06）

AppHost `0.2.0-rc.5` 内联 canonical `@hanamesh/lib-provision@0.1.0-rc.3`，源码提交 `e8707089409ffd3483fc4c964d6032c370dae634`，vendor SHA-256 `b7d149dcbf51c30fd0226fb170afdf268501057b0c7149903c02c17abe93b2c7`。原 build 验证归档摘要并提取 `lib/`、`LICENSE` 与 `THIRD_PARTY_NOTICES.md`；两个分发记录保留上游原文。根 `SEE LICENSE IN LICENSE` / AppHost MIT 分区保持，`dist/provision/**` 自有分发记录不改为 MIT。业务源码与公开 API 不变，无新增依赖或运行时功能；devkit 仍精确 rc1。只交工程新包，未发布 npm 或安装物，产品界面与干净机未运行。

## 0.4.0 · Devkit normal Git supply / 0.5.0 external provision supply

Development installs use Node 24.13.1, pnpm 10.33.0 and the frozen `pnpm-lock.yaml`, with pnpm package-manager self-management disabled. `@hanamesh/devkit` (`^0.2.6`, development-only) and `@hanamesh/lib-provision` (`^0.2.1`, bundled into the runtime tarball) are installed from the public npm registry; the lock pins version and sha512 integrity. Source installs need no private Git access or credentials. The package identity is Devkit, never the shared root alias. Run `pnpm run check:devkit-supply` for the public provider contract, installed version range, registry lock form and CLI checks. The four mature tool engines and runtime payload are unchanged. No runtime Devkit dependency or bundled tool code is added.

Historical source-Git route (superseded by the fixed archives above for current installs): the upstream Git subdirectory route supports pnpm 10.33.0; npm 11.8.0 cannot install that development dependency. AppHost 0.4.x source Git consumption therefore uses pnpm, with its normal dependency build approval for this package's existing build/prepack lifecycle. A normal npm tarball runtime install remains supported and ignores development dependencies. The previously verified AppHost 0.3.0 source/tag and `^0.3.0` npm route remain byte-identical and outside the 0.4.0 range. Future 0.x minor ranges remain distinct. The independent 0.4.0 release retains the mature inlined lib-provision payload. AppHost 0.5.0 installs lib-provision from `git+https://github.com/yzsnstotz/hanamesh-lib-provision.git#semver:^0.2.1` and removes it from `dist/` and `vendor/`. The lib source candidate has no public Devkit peer or Git installation lifecycle script, so it needs no provision build allowlist; only the existing koffi lifecycle remains approved. A fresh strict two-source installation verifies this boundary. The old 0.2.0 strict peer failure remains in the task evidence; no peer override or disabled strictness is used. Run `pnpm run check:provision-supply` for the source's installed public conformance when affected; unchanged runtime/API/CLI/type checks are reused by byte evidence.

## 0.5.1 · origin/main dependency closure

Removed the unused public Devkit peer; all Devkit imports belong to development scripts. Its normal pnpm Git subdirectory range and the external lib-provision runtime dependency are unchanged. No runtime API, schema, fixture, protocol or business code changes. Normal npm tarball runtime consumption remains applicable; npm source Git cannot resolve the Devkit subdirectory route.

开发安装与检查使用固定工具链和模块自有的 Git 守卫（不修改用户的 Git 配置）：

```sh
fnm exec --using=24.13.1 node scripts/safe-git.mjs pnpm install --frozen-lockfile
fnm exec --using=24.13.1 node scripts/safe-git.mjs npm run check
fnm exec --using=24.13.1 node scripts/safe-git.mjs npm run verify:pack -- /absolute/path/package.tgz
```

守卫为子进程设置 `GIT_CONFIG_NOSYSTEM=1`、关闭终端提示，并用空 helper 清空继承项后设置 `!gh auth git-credential`。隔离 HOME 时，私有 Git 依赖需要该环境可用的 gh 登录；不复制个人凭据。pnpm 自动切换版本关闭。Git Trace2 只写权限受限的临时文件，发现禁用 helper 时失败并结束自有进程组；正常、失败、SIGINT/SIGTERM 后删除 trace，不把原始内容写入报告。测试使用假的 gh/钥匙串 helper，不访问真实钥匙串。

本包不再执行插件安装命令；独立 Market 使用 DSH 原生安装管道。原生准备、旧 wave01 复演等脚本也必须从 `scripts/safe-git.mjs` 启动；原有隔离目录与浏览器 `--use-mock-keychain --password-store=basic` 要求继续适用。

页面的 `env -u …` 首次安装/补齐命令仅供 macOS / Linux 的 POSIX 终端使用；Windows 安全复制命令尚未提供，不将其计为 Windows 产品验收通过。运行时守卫的 Windows npm/pnpm JS 入口和进程树清理仅作源码处理，仍待 Windows 实测。

### Public CI

The `app-host-core` workflow downloads the public commit archive anonymously,
uses fixed Node 24.13.1 / pnpm 10.33.0 with self-management off, verifies vendor
archive hashes, and installs with the frozen pnpm lock. It checks both provider
public contracts, runs the full module check (including the fake-keychain guard
regressions), then packs and verifies a fresh strict consumer. All package
commands use the existing monitored Git boundary. No repository/environment
secret, checkout credential, private dependency fetch, paid runner, deployment or
publishing action is configured. Isolated HOME/DSH/agent/cache/store/temp paths
are cleaned even after failure. Local full checks remain the delivery authority;
Actions runs on the standard public/free `macos-15` arm64 runner because the existing native preparation fixture requires that platform. The preinstalled Chrome runs with an isolated profile, mock keychain and basic password store. It is an additional macOS check, not native-client or owner acceptance; this does not establish Linux support.

## 发布检查：平台依赖闭包（不可关闭）

共享 `@hanamesh/release-platform-gate` **0.1.12** 已经 R119b 复审 PASS，来源 `hanamesh-docs/tools/release-platform-gate` 分支 `fix/pg1-leoventory-installer-risk-20261109`，提交 `95e54102f9380ea2e8e4d8a2e36eacd387c3f7e7`。正常工具 tgz SHA256 `caf78747649b1dd37cbe9ba331351c81f94a48dc9e779aee83c75336140068d1`；七载荷摘要、复审提交及冻结 SRI 见 `vendor/release-platform-gate.json`、`vendor/SHA256SUMS` 和锁。它仅为 devDependency，不进入运行时或产品 bundle。

`DSH_PNPM_PLATFORM_CLOSURE` 是不可关闭的正确性不变量（disableable:false）。历史 DSH bundled pnpm 11.7.0 位于 pnpm#12297 风险系列，修复收录于 pnpm 11.23.0。原始 HanaMesh 挂起进程首错仍未找回，不能宣称历史身份/归因已闭合。合法 optional 平台字段和完整强 SRI 也不能独自证明安装器会退出。

根及必需路径的 os/cpu/libc 继续 PLATFORM_FIELD 拒绝；可选子图先完整核锁、实际归档、名称/版本/范围/peer、选择器一致与强 SRI，再按 `dsh-pnpm-platform-exit-v1` 核安装矩阵。所有平台工件均扫描，不按检查机过滤。缺矩阵为 INSTALLATION_TARGETS_REQUIRED，旧风险组合为 PNPM_PLATFORM_HANG_RISK，未审组合为 INSTALLATION_TARGET_UNSUPPORTED；混入一个安全目标不能洗绿旧组合。未知依赖形态仍 UNSUPPORTED_DEPENDENCY_SHAPE，输出 shape / why / action / contract；有限 dependency-shapes-v1 与 INSTALLATION_RISK.md 均随正常工具包交付。没有 skip/关闭开关、环境推断、重试、超时、omit-optional 或白名单绕过。

本次发布资格的完整目标明确保存在 `release/installation-targets.json`：DSH **0.2.2-rc.1 / pnpm 11.28.5 / darwin-arm64、linux-arm64**。这是 R119b 有退出证据的两个组合，不是检查机自动选择，也不把公开宽 peer 范围当作已通过的安装矩阵；其他宿主/安装器/架构不计入本次资格，旧组合仍拒绝。开发冻结安装的 pnpm 10.33.0 不是 bundled 11.28.5 的实装证据；后续 GT19 两机门必须核实际 pnpm 版本和完整闭包。

`release:check` 与 `release:publish` 都显式传同一 `--installation-targets release/installation-targets.json`；`verify:pack` 在原消费者验证后通过共享公开 `checkRelease({installationTargets:...})` 检查同一归档，没有复制扫描实现或捕获忽略门错误。

运行 `npm run release:check` 产生正常归档并核验；`release:publish` 只发布同一已检查且复核 SHA 的 tar。`prepublishOnly` 的 source-guard 拒绝源码目录直接发布。CI 的既有 verify:pack / preflight 必经此门；无 continue-on-error 或旁路。此接线提交没有执行 npm publish、tag、部署或产品真机发布验收。
## CL6 边界更新

应用扫描与准备/移除接口、Core 槽位及只读 runtime 能力见 [CONTRACT](docs/CONTRACT.md)。所有运行/租约/网关安全语义保持；安装后的应用仍可打开、续租和关闭。构建/类型/变异/正常 tarball 消费者及平台闭包门仍必须通过，真实客户端单独验收。
