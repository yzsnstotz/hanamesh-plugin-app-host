# HanaMesh app-host · 0.1.0-rc.24

> rc.24（2026-09-21）：模型随路由——路由表加「模型」列（所路由供应商的模型列表 / 文本框；「应用默认」= 清单默认值），`POST /hanamesh/router/model`；自动路由行选模型即成为同供应商的显式 grant。
> rc.23（2026-09-21）：Router 不再替应用选模型——自动路由时 `{{model|默认}}` 落到应用声明的默认值，不再取供应商模型列表第一项（用户在 Vibe 里被塞了 `gpt-5.3-codex-spark` 的根因）；无 `providers` 的派生槽位不自动路由、plan 标 `derived`、路由表不显示。
> rc.22（2026-09-21）：「供应商」页压成两张表（来源目录 + 应用×槽位路由表），可扩展到多个应用；去掉网关开关（归 oauth 插件自己的设置页）和「应用自管」切换（自动路由 + 应用内设置优先已消解冲突）。
>
> rc.21（2026-09-21，用户定契约）：Router **自动路由**——托管模式下，profile 里已配置、且应用声明接受的供应商在启动时直接注入，不再要求用户在宿主「供应商」页逐槽位选择；显式 grant 优先，「停用」= 该槽位退出自动路由；应用内部自己的设置优先于宿主注入。`coding-oauth-gateway`（dsh-coding-subscription-oauth 的本地 OpenAI 兼容 API）作为 `openai` 槽位的兜底候选。宿主「供应商」页改为：来源目录 + 网关开关（写明它只服务应用，DSH 对话不需要）+ 每个应用的只读路由状态（停用/恢复）。AH-R02/R02b 测试。
>
> rc.20（2026-09-21）：在 rc.19 之上再修两处（同一个「桌面壳里打开应用空白」，在真实 WKWebView 抓到的请求头证实）：① 引导 303 不再带 `referrer-policy: no-referrer`——它作用于跳转那一跳，`/` 导航到达时没有 Referer，rc.19 的无 cookie 授权路径永远匹配不上；② 新增配置 `frameAncestors: string[]`（壳自己的 webview origin，如 `tauri://localhost`）——`frame-ancestors` 对**所有**祖先生效，壳 → DSH → 应用三层时只写 DSH origin 会被 webview 拒绝渲染。H16 测试。rc.19 未发布到任何地方以外的 registry。
>
> rc.19（2026-09-21）：网关不再只认 cookie——嵌入式 webview（HanaMesh 桌面 Tauri/WKWebView、开了跟踪防护的 WebView2）里应用 iframe 相对壳的顶层 origin 是第三方，`SameSite=Strict` 的引导 cookie 被丢弃，303 之后每个请求都 403（响应带 `frame-ancestors 'none'`）→ 用户看到空白 iframe（2026-09-21 桌面 rc.4 + Vibe 实测）。rc.19 在 cookie 缺席时改用 Fetch Metadata：`sec-fetch-site: same-origin`（应用自身子资源/XHR）、或 `same-site` + `iframe` + 父 origin referer（引导后的框架导航）、或应用 origin 的 WebSocket 握手，且必须已有一张为仍在有效期 lease 消费过的引导票；cross-site / `none`（地址栏）一律拒绝。H15 三条测试；浏览器直开仍走 cookie。
>
> rc.18（2026-09-20）：应用库卡片跟踪安装/补齐运行时/卸载操作——按钮进入「…中…」，订阅 `/hanamesh/library/events` 直到 `-done`/`-failed`，失败时在卡片上显示错误码与可读原因（如 `REGISTRY_LOOKUP_FAILED`：应用包不在当前 registry），并提供「重试安装」。用户 2026-09-20 实测：点安装无任何反应。宿主逻辑不变。

**交付状态：rc.3 用户 ACCEPTED 2026-09-13；rc.4–rc.12 为增量 🧪；rc.13 只补上架前提（MIT 许可证、`repository` 字段、DSH peer 精确钉 `0.1.5-alpha.1`）；rc.14 删除客户端里对 `hanameshCore` 的死读取（浏览器侧 cordis 上下文不含宿主服务，该读取恒为 null，且把「未安装 HanaMesh Core」误显给已装用户）——本包对 Core 现在零引用，Core 状态只在 Core 自己的设置段；仍待用户验收。**

> 收录不代表审核或推荐。**套件与单包互斥（双向）：** 已单独安装本包的用户装 `hanamesh-core` 前先 `dsh plugin remove @hanamesh/dsh-app-host`；已装套件（core）再显式 `plugin add` 本包同样会以 `duplicate loader entry id` 起不来，移除那次显式安装即恢复。

> rc.4 增加 `credentialEnv` / `credentialResolver`；rc.5 增加文件投射根与格式；rc.6 增加文件生命周期策略；rc.7 允许停止实例在下次打开时采用新定义；rc.8 增加 `credentialEnv[].sets` 声明。逐项证据见 `docs/acceptance/`。`ACCEPTED` 仍只有用户能给。

本仓完成可独立运行的应用实例管理、持久视图租约、受控网关和工作台 SDK。原型源码所在私有仓当时访问返回 404，因此这是新的实现候选，不是原型提取；原型许可证和 commit 尚未核实（原型现在可读，见 `<umbrella>/research/dsh-greenfield-2026-09-09/workspace/packages/hanamesh-app-host/`，契约差异未逐项对照）。

## 本次已实现

- **FIX-01：** 稳定 `viewId`、持久租约、generation fencing；同一 view 重开不增加匿名引用；原实例精确恢复；错误关闭拒绝；心跳超时自动回收；回执丢失后可由已认证 owner 显式恢复凭据，不重新绑定视图。
- **FIX-02：** 按 owner / app / deployment / data 身份在 spawn 前持久预留；并发 Open 合并为一个真实应用进程；多实例传入独立 data/HOME/XDG/TMP 目录，测试检查了应用真实写入的文件。
- **生命周期：** owned 进程由独立 guardian 管理；宿主被 SIGKILL 后清理自有进程组；attach 只释放附着；有占用时 Stop 拒绝并列出视图；确认清理后才发布 stopped 与逐 view 通知。
- **受控网关：** 固定数字回环上游、每代租约能力票据；只调整 XFO 和 CSP frame-ancestors，保留应用正文；HTTP 上传、SSE、WebSocket 可用；不向应用注入 SDK、不传宿主凭据、不改变应用 auth/CSRF/CORS。
- **交付契约：** ESM 包、TypeScript 声明、工作台侧 `./client` SDK、完整快照存储接口、DSH 插件入口、测试与崩溃一致性声明。
- **K5：** Electron 宿主必须显式给绝对且可执行的 `nodeBinary`；guardian/launcher 使用同一 Node，只继承 `DSH_HOME/HOME/LANG/TMPDIR/PATH` 白名单。未配置时 fail-closed 为 `NODE_RUNTIME_REQUIRED`。
- **Router：** 合并授权、撤销、文件投射 ledger 与 `sets`，来源为 DSH credentials/LLM 目录和 coding-oauth gateway；不搬 key 探测、录入或 OAuth 端口。
- **应用库：** 自带侧栏入口与覆盖页；目录源同一时刻只启用一项；可发现 Community Market/DSH 已安装应用，区分已注册、待重启与缺 runtime，并通过 DSH 自己的安装器装卸。
- **锁定 runtime 供给：** `@hanamesh/lib-provision` 精确 peer 为 `0.1.0-rc.1`，开发端使用 `file:vendor/`；build 把该零运行时依赖产物内联到 `dist/provision/`，来源与 SHA-256 见 `docs/PROVENANCE.json`。

## 运行

当前实测环境是 **macOS arm64 / Node 24.13.1 / npm 11.8.0 / pnpm 10.33.0 / DSH 0.1.5-alpha.1**。干净安装使用锁文件，运行依赖为 `zod 4.5.4`；私有 `@hanamesh/lib-provision` 不在 `dependencies`，而是精确 peer + vendor 内联产物。

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
| DSH profile 适配 | bundle 自动落座包根；显式适配仍可用 `@hanamesh/dsh-app-host/dsh` | 包根懒加载 Cordis `apply`，使同一个 loader entry 同时被 client-modules 发现；见 `docs/DSH_INTEGRATION.md` |
| DSH 浏览器 UI | `@hanamesh/dsh-app-host/client-ui` | 设置里的「供应商」「应用库来源」，以及侧栏「应用库」与 `shell.overlay` 页面；Node 条件下 `./client` 仍解析到工作台 SDK |

契约详见 [`docs/CONTRACT.md`](docs/CONTRACT.md)、[`docs/ROUTER_CONTRACT.md`](docs/ROUTER_CONTRACT.md) 与 [`docs/LIBRARY.md`](docs/LIBRARY.md)，未完成步骤见 [`docs/DSH_INTEGRATION.md`](docs/DSH_INTEGRATION.md)，安全限制见 [`docs/SECURITY.md`](docs/SECURITY.md)。本仓不包含应用适配包、钱包权限或 provider runtime driver。

## GitHub 与来源

rc.3 修复只在本地隔离分支 `codex/app-host-acc-fix`；没有创建远程仓库、提交 PR 或推送。所需原型现在有本地副本，但尚未做逐项契约对照；不能把独立实现冒称为原型提取。

rc.1 原交付包的 ZIP 含本地 Git bundle 和提交信息。`scripts/publish-github.sh --create-private` 是**尚未执行**的历史发布辅助；执行前须重新核对目标仓与授权。

当前标注 `UNLICENSED`，不是 MIT/Apache 授权声明；没有擅自给用户代码选择开源许可证。[`docs/PROVENANCE.json`](docs/PROVENANCE.json) 保留 rc.1 原始输入与当时环境记录；rc.3 的包摘要与复验证据见源码仓 `docs/acceptance/wave01-rc3-artifact.json`。
