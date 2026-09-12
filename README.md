# HanaMesh app-host · 0.1.0-rc.1

**交付状态：PARTIAL（核心实现候选版），不是已验收的 DSH 插件。**

本仓完成可独立运行的应用实例管理、持久视图租约、受控网关和工作台 SDK。原型源码所在私有仓访问返回 404，附件只有需求/流程文档，因此这是新的实现候选，不是已经完成的原型提取；原型许可证和 commit 尚未核实。真实 DSH 0.1.5-alpha.1 的 storage-domain、认证、路由和生命周期绑定仍未接通验证，不能据此解除 MOD-03 的依赖门。

## 本次已实现

- **FIX-01：** 稳定 `viewId`、持久租约、generation fencing；同一 view 重开不增加匿名引用；原实例精确恢复；错误关闭拒绝；心跳超时自动回收；回执丢失后可由已认证 owner 显式恢复凭据，不重新绑定视图。
- **FIX-02：** 按 owner / app / deployment / data 身份在 spawn 前持久预留；并发 Open 合并为一个真实应用进程；多实例传入独立 data/HOME/XDG/TMP 目录，测试检查了应用真实写入的文件。
- **生命周期：** owned 进程由独立 guardian 管理；宿主被 SIGKILL 后清理自有进程组；attach 只释放附着；有占用时 Stop 拒绝并列出视图；确认清理后才发布 stopped 与逐 view 通知。
- **受控网关：** 固定数字回环上游、每代租约能力票据；只调整 XFO 和 CSP frame-ancestors，保留应用正文；HTTP 上传、SSE、WebSocket 可用；不向应用注入 SDK、不传宿主凭据、不改变应用 auth/CSRF/CORS。
- **交付契约：** ESM 包、TypeScript 声明、工作台侧 `./client` SDK、完整快照存储接口、DSH 显式绑定工厂、测试与崩溃一致性声明。

## 运行

本候选的实测环境是 **Linux / Node 22.16.0 / npm 10.9.2**。核心零第三方运行依赖；无需安装全局包。

```bash
npm run build
npm test
npm run test:mutation
npm run demo -- --smoke
```

`npm run demo` 启动一个受控示例应用，并让两个视图共用同一实例；终端打印应用 URL，Ctrl+C 清理自有进程和临时示例目录。它不是 DSH、工作台或两个上游应用的演示。

有 TypeScript 5.8.3 的开发环境可运行 `npm run test:types`。本次已经实际执行。交付 tarball 可以用 `npm install --offline --ignore-scripts --legacy-peer-deps /绝对路径/hanamesh-dsh-app-host-0.1.0-rc.1.tgz` 安装到一个独立测试工程；不要装到个人 DSH profile。

## 验收结果在哪里

[`docs/acceptance/REPORT.md`](docs/acceptance/REPORT.md) 分开记录真实进程、真实 SIGKILL、HTTP 传输、fixture、浏览器受阻及 DSH 未完成项；原始 TAP、4 组变异日志、干净目录包验证日志随完整源码 ZIP 一并交付；npm tarball 只含运行文件与契约，不含验收日志。浏览器测试不会修改管理员策略，也不会因为 skip 而把对应产品验收标为 PASS。

## 接入入口

| 消费者 | 入口 | 说明 |
|---|---|---|
| 受信宿主代码 | `@hanamesh/dsh-app-host` | `AppHost`、存储、路由、网关 |
| 工作台顶层页面 | `@hanamesh/dsh-app-host/client` | 明确的 Open 回执、恢复、心跳、Stop；禁止注入应用 iframe |
| DSH profile 适配 | `@hanamesh/dsh-app-host/dsh` | `createDshPlugin(verifiedBridge)`；默认 `apply()` 明确拒绝假装加载成功 |

契约详见 [`docs/CONTRACT.md`](docs/CONTRACT.md)，未完成步骤见 [`docs/DSH_INTEGRATION.md`](docs/DSH_INTEGRATION.md)，安全限制见 [`docs/SECURITY.md`](docs/SECURITY.md)。本仓不包含工作台 UI、应用适配包、授权/安装状态的第二份真相、钱包权限或 runtime driver。

## GitHub 与来源

本次没有创建远程仓库、提交 PR 或推送到任何现有仓库。连接器没有新建仓库接口，且所需原型仓不可读；没有把代码塞进无关旧仓。

ZIP 附本地 Git bundle 和提交信息。`scripts/publish-github.sh --create-private` 是**尚未执行**的发布辅助：只接受 `yzsnstotz` 身份，只创建私有 `hanamesh-plugin-app-host`，遇到已存在仓库会拒绝覆盖。执行前先阅读交付限制。

当前标注 `UNLICENSED`，不是 MIT/Apache 授权声明；没有擅自给用户代码选择开源许可证。原型来源和本次输入摘要见 [`docs/PROVENANCE.json`](docs/PROVENANCE.json)。
