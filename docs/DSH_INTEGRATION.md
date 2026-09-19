# DSH 集成

> **2026-09-19（rc.11）：** 本包现在声明 DSH bundle。对独立 profile 执行 `dsh plugin --profile <name> add <本包.tgz>` 即会通过 `profile/cordis.patch.yml` 激活包根 `@hanamesh/dsh-app-host`，不要再手写 insert。包根保留核心 API，并以懒加载方式落座 Host；固定版本 `dsh-client-modules` 只有在 loader entry 是包根时才会发现 `./client`。HanaMesh 套件已内含本包；套件用户不要单独安装。若此前装过单包，先 `plugin remove @hanamesh/dsh-app-host` 再安装套件，避免重复 `hanamesh-app-host` loader id。桌面 Electron 壳必须在 config 提供独立可执行 `nodeBinary`。
>
> 应用库浏览可只配置 `library.fixture` 或 `library.sources`。安装/卸载还必须明确给绝对 `library.profileDir`、`library.profileName` 与独立 `nodeBinary`；可选 `library.dshBin`，省略时才从该 profile 的固定依赖解析 DSH `bin.js`。钉版本宿主没有公开 profile-directory 服务，因此不从 cwd、PATH 或个人 `~/.dsh` 猜。目录源与安装契约见 `LIBRARY.md`。

> **2026-09-12（rc.3）：** 干净安装锁文件和占用 Stop 的 HTTP 409 已修复；五个动作的重新验收证据见 `acceptance/wave01-resolution-report.md`。rc.2 的回收证据保留在下方，不能作为 rc.3 的包摘要。

> **2026-09-12（rc.2）：DSH 侧已实现并在真实 profile 加载。** 入口 `@hanamesh/dsh-app-host/dsh`（`src/dsh.js`）绑定固定版本 DSH 0.1.5-alpha.1 **声明过的**公开 API：`ctx.storageDomain.open()`（single 布局，整个快照是一个 global，`global.set` 即一次整体发布）、`ctx.webServer.register()`（八条 exact 路由）、`ctx.connection.requestRejection()`（与 `/api` 通道相同的 Host/Origin 栅栏 + 浏览器 cookie；主体为本 profile 唯一的本地浏览器会话 `dsh-browser`）、`ctx.provide/ctx.effect`。`inject` 声明三项服务，缺 `connection` 时插件不激活、不会有公开路由。profile 接法：
>
> ```yaml
> - insert:
>     - id: hanamesh-app-host
>       name: '@hanamesh/dsh-app-host/dsh'
>       config: { dataRoot: /abs/path, applications: [ …AppDefinition… ] }
> ```
>
> 证据：`docs/acceptance/recovery-20260912/h01-real-profile.log`、`dsh-real-cordis.tap`。下文是 rc.1 交付方写下的当时缺口，作为历史保留。

## rc.1 时的缺口（历史）

**当时不支持直接把本候选当成已加载的 DSH 插件。** `apply()` 有意抛出 DSH_BINDING_REQUIRED。`createDshPlugin()` 接受的 bridge 是本仓定义的集成端口，不是已验证的官方 API 名称；不能填几个假函数就把 H01/H11 标 PASS。

## 已知目标与实际证据

输入文档锁定 DSH `0.1.5-alpha.1`、Node `24.13.1`、pnpm `10.33.0`、desktop `v0.1.0`、Tauri `2.11.5`、macOS arm64 / web profile。当前只有 Linux Node22.16.0，未安装真实 DSH。npm registry 网络解析失败；所需私有原型仓通过连接器读取返回404。

因此以下结论没有成立：原型代码提取完成、原许可证继承、Cordis 服务加载成功、DSH domain 持久化成功、DSH session 写后自读成功、Tauri iframe兼容、macOS进程组/端口检查通过、workspace依赖已满足。

## 接续开发只做这几步

1. **取得指定原型。** `yzsnstotz/hanamesh` 的 `research/dsh-greenfield-2026-09-09/workspace/packages/hanamesh-app-host/`。记录实际 commit、许可证、package exports、描述符与路由契约；与本候选比对，尽量把已验证核心回归合入原型提取版，而不是机械替换未核对的接口。
2. **读取固定版本公开扩展点。** 在独立 profile 查清 `ctx.provide`、`ctx.webServer.register`、卸载 hook、认证/授权上下文，以及官方 storage-domain 的 single 布局完整镜像发布 API。不要修改 DSH 内核，不调用猜测名称的接口，不写未知 Session.append 事件。
3. **实现一个小的真实 bridge。** `storage(ctx)` 返回 `{layout:'single',domain:'hanamesh-app-host',readSnapshot,publishSnapshot,acquireExclusive,releaseExclusive}`；publishSnapshot 必须一次提交整个镜像。`mountAuthenticatedRoutes`、`provide` 返回真实注销函数；`onDispose` await 本模块 dispose；authenticate/authorize 连接宿主既有身份系统。bridge版本判断必须来自实际运行宿主，不是配置字符串自证。
4. **最小 profile 真实加载验证。** 安装固定 tarball、实际读取 `ctx.hanameshApps`、注册受控应用并调用 Open/Close；移除研究目录仍能启动。随后通过 DSH 自己的 session API 建立/读取合法 session，执行租约写入，再通过 DSH 自己读取原 session；保存实际输入输出，完成 H01/H11。
5. **复跑强杀和浏览器验收。** 在真实 single domain 发布边界运行 X02/X03；Mac上验证应用监听端口确属已启动进程组。允许正常回环访问的合法测试环境复跑浏览器H10/H13/H14，不绕过任何管理员控制。MOD-05 上游应用行为由对应适配包验收，不挤进 app-host 伪造通过。
6. **核对版本与依赖门。** 修改与原型的差异按版本说明，发布新锁定产物和摘要。只有完整门通过才可标 DELIVERED；ACCEPTED 仍由用户操作。不要直接把本 rc 改成正式0.1.0并解锁 workspace。

peer 范围保留输入要求：`@deepseek-ai/cordis ^4.0.2` 与 `@deepseek-ai/schemastery ^3.18.2`。目前标 optional 仅为了核心独立安装不从网络拉未验证组件；不表示 DSH 集成可以不用它们。

运行 `npm run preflight:dsh` 会输出当前缺失项并以代码2退出，这个预检是阻塞说明，不是安装器，也不是自动联网修复。
