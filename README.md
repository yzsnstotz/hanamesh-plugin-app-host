# HanaMesh app-host · 0.1.0-rc.3

**交付状态：`DELIVERED`（等用户验收），不是 ACCEPTED。**

> rc.1 是核心实现候选（无 DSH 侧）；rc.2 补齐真实 DSH 侧与浏览器/卸载修复。rc.3 修复干净安装锁文件与占用时 Stop 的 HTTP 409，并复跑真实 profile 五个动作。逐项证据见 `docs/acceptance/REPORT.md` 与 `docs/acceptance/wave01-resolution-report.md`。`ACCEPTED` 仍只有用户能给，MOD-03 的依赖门在那之前不解除。

本仓完成可独立运行的应用实例管理、持久视图租约、受控网关和工作台 SDK。原型源码所在私有仓当时访问返回 404，因此这是新的实现候选，不是原型提取；原型许可证和 commit 尚未核实（原型现在可读，见 `<umbrella>/research/dsh-greenfield-2026-09-09/workspace/packages/hanamesh-app-host/`，契约差异未逐项对照）。

## 本次已实现

- **FIX-01：** 稳定 `viewId`、持久租约、generation fencing；同一 view 重开不增加匿名引用；原实例精确恢复；错误关闭拒绝；心跳超时自动回收；回执丢失后可由已认证 owner 显式恢复凭据，不重新绑定视图。
- **FIX-02：** 按 owner / app / deployment / data 身份在 spawn 前持久预留；并发 Open 合并为一个真实应用进程；多实例传入独立 data/HOME/XDG/TMP 目录，测试检查了应用真实写入的文件。
- **生命周期：** owned 进程由独立 guardian 管理；宿主被 SIGKILL 后清理自有进程组；attach 只释放附着；有占用时 Stop 拒绝并列出视图；确认清理后才发布 stopped 与逐 view 通知。
- **受控网关：** 固定数字回环上游、每代租约能力票据；只调整 XFO 和 CSP frame-ancestors，保留应用正文；HTTP 上传、SSE、WebSocket 可用；不向应用注入 SDK、不传宿主凭据、不改变应用 auth/CSRF/CORS。
- **交付契约：** ESM 包、TypeScript 声明、工作台侧 `./client` SDK、完整快照存储接口、DSH 插件入口、测试与崩溃一致性声明。

## 运行

rc.3 的实测环境是 **macOS arm64 / Node 24.13.1 / npm 11.8.0 / pnpm 10.33.0 / DSH 0.1.5-alpha.1**。干净安装使用锁文件，运行依赖为 `zod 4.5.4`。

```bash
npm ci
npm run build
npm test
npm run test:mutation
npm run test:types
npm run demo -- --smoke
```

`npm run demo` 启动一个受控示例应用，并让两个视图共用同一实例；终端打印应用 URL，Ctrl+C 清理自有进程和临时示例目录。它不是 DSH、工作台或两个上游应用的演示。

`typescript 5.8.3` 已固定在开发依赖中。rc.3 tarball 可用 `npm install --offline --ignore-scripts --legacy-peer-deps /绝对路径/hanamesh-dsh-app-host-0.1.0-rc.3.tgz` 安装到独立测试工程；真实 DSH 验收须用独立 `DSH_HOME`，不要装到个人 profile。

## 验收结果在哪里

[`docs/acceptance/REPORT.md`](docs/acceptance/REPORT.md) 分开记录真实进程、真实 SIGKILL、HTTP 传输、fixture、浏览器受阻及 DSH 未完成项；原始 TAP、4 组变异日志、干净目录包验证日志随完整源码 ZIP 一并交付；npm tarball 只含运行文件与契约，不含验收日志。浏览器测试不会修改管理员策略，也不会因为 skip 而把对应产品验收标为 PASS。

## 接入入口

| 消费者 | 入口 | 说明 |
|---|---|---|
| 受信宿主代码 | `@hanamesh/dsh-app-host` | `AppHost`、存储、路由、网关 |
| 工作台顶层页面 | `@hanamesh/dsh-app-host/client` | 明确的 Open 回执、恢复、心跳、Stop；禁止注入应用 iframe |
| DSH profile 适配 | `@hanamesh/dsh-app-host/dsh` | Cordis 插件入口（`name`/`inject`/`Config`/`apply`），绑定固定版本公开 API；见 `docs/DSH_INTEGRATION.md` |

契约详见 [`docs/CONTRACT.md`](docs/CONTRACT.md)，未完成步骤见 [`docs/DSH_INTEGRATION.md`](docs/DSH_INTEGRATION.md)，安全限制见 [`docs/SECURITY.md`](docs/SECURITY.md)。本仓不包含工作台 UI、应用适配包、授权/安装状态的第二份真相、钱包权限或 runtime driver。

## GitHub 与来源

rc.3 修复只在本地隔离分支 `codex/app-host-acc-fix`；没有创建远程仓库、提交 PR 或推送。所需原型现在有本地副本，但尚未做逐项契约对照；不能把独立实现冒称为原型提取。

rc.1 原交付包的 ZIP 含本地 Git bundle 和提交信息。`scripts/publish-github.sh --create-private` 是**尚未执行**的历史发布辅助；执行前须重新核对目标仓与授权。

当前标注 `UNLICENSED`，不是 MIT/Apache 授权声明；没有擅自给用户代码选择开源许可证。[`docs/PROVENANCE.json`](docs/PROVENANCE.json) 保留 rc.1 原始输入与当时环境记录；rc.3 的包摘要与复验证据见源码仓 `docs/acceptance/wave01-rc3-artifact.json`。
