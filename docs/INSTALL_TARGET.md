# 客户端市场安装目标入口

AppHost `0.2.0-rc.9`（安装目标入口自 rc7；合约声明与随包套件自 rc8）。目标输入、目录解析、确认、安装与结果全部归本模块；调用方只传目录标识，负责呈现原市场表面。

## Desktop 正常导航入口

在当前已认证的同一 DSH 工作区 URL 上设置片段 `#hanamesh-install?itemId=<encoded-id>&packageName=<encoded-name>`，至少一个字段；不要变更 workspace 的 origin、路径或已有认证参数。AppHost 客户端正常加载或 hashchange 时读取这个公开片段，调用下面同一入口。重复查询字段和额外字段拒绝。无需导入另一个插件、DOM 自动点击、executeJavaScript、私有组件状态或特权 postMessage；壳只做自己的协议校验、前置窗口和正常导航。AppHost 模块需已由产品正常供应加载；旧 rc2 不认识此协议。

## 客户端公开入口

在 DSH 的正常客户端模块系统中取得 `@hanamesh/dsh-app-host` 的公开客户端模块，调用 `openInstallTarget({itemId?, packageName?})`。已有客户端 `market` service 也提供同名方法：`market.openInstallTarget(target)`；原 `market.render({preferredSubsectionId})` 与 `setSettingsVisible()` 保持原协议。

至少一个标识；两者都给时必须匹配同一条目录项。拒绝所有其他字段，包括 version、url、downloadUrl。itemId 最长 160 字符；packageName 按 npm 包名语法校验、最长 214 字符。壳不得解析目录、代填版本/下载地址、点击私有 DOM、注入脚本、代按确认或访问组件状态。

入口先显现 AppHost 自己的侧栏市场覆盖层。若宿主已用 market 席位拥有市场表面（setSettingsVisible(false)），调用方需选中/呈现现有 market.render() 表面，AppHost 不叠加第二个覆盖层。即使尚未挂载，目标确认也保存在本客户端模块内，正常挂载后读回；不跨 profile 保存。

Promise 在目录解析后返回 `{status,itemId?,packageName?}`：

| status | 意义 |
| --- | --- |
| confirmation-required | 市场已按当前目录显示名称、包名、版本和目录来源；尚未安装 |
| installing | 相同目录项已有安装进行中，复用该状态 |
| already-installed | 当前 profile 已安装且目录没有升级，不重复安装 |
| superseded | 解析过程中收到更新目标或取消，旧输入不再打开确认 |

错误时 Promise reject，市场同时显示错误。这个回执不表示安装完成。用户按「确认安装」后，市场自己发起原 install 请求、跟踪原 events、显示结果并刷新「已安装」。取消不会发 install 请求。相同目标以目录 id 归并客户端状态，以实际包名归并宿主进行中的 install operation。安装成功后的可打开状态沿用原 AppHost 应用视图/租约；普通 DSH 插件沿原宿主入口打开，需重启时保留原提示。

## HTTP 契约

新增只读 `GET /hanamesh/library/target?itemId=...&packageName=...`，查询字段仍只接受上述两个标识。宿主用当前市场目录逐页解析，返回 `{item,source,traceId}`；item 含 kind、installed、upgradeAvailable 和原目录元数据，source 含市场自己的 manifestUrl；fixture 来源明确标「测试目录」。查询不会安装。

同实例同端口的精确 `127.0.0.1:<port>` 与 `localhost:<port>` Host 同时可用（同一 parentOrigin 配置，无切换）。Origin 若出现必须与本次请求 Host 的 http origin 精确一致；两个别名仍是不同的浏览器 origin，不允许跨别名请求。未知 Host、其他端口、IPv6/尾点别名、外来或 opaque Origin 明确拒绝；非 iframe、authenticate、authorize 检查保持。GET 允许同源浏览器默认不带 Origin；不接受外来 Origin。实际安装只用原 `POST /hanamesh/library/install`，要求精确同源 Origin、`X-HanaMesh-Client: workspace-v1`、资源端身份及授权；重新解析当前目录，不信任请求内版本或地址。进行中返回原 `202 {operationId,status:'started'}`；相同包共享该 operationId。已经安装且没有目录升级时返回 `200 {status:'already-installed',itemId,packageName}`。安装事件/结果与既有安装器不改。目录版本是原目录 latestVersion，既有安装器仍自行核 registry 的 latest 并固定精确版本；最终显示的已安装版本来自 profile 扫描，并与操作结果版本一致才报告读回成功。

## 合约版本与一致性套件

契约名 `hanamesh.install-target`，当前版本 `1`。单一来源是随包 schema `schemas/install-target.schema.json`（出口 `@hanamesh/dsh-app-host/install-target/schema.json`，`x-hanamesh-contract` 节写版本、片段前缀、路由与拒绝规则）。

**变更说明（rc8，小版本，只加不改）：** 新增可选字段 `contractVersion`，可出现在 `openInstallTarget` 入参、`#hanamesh-install?` 片段与 `GET /hanamesh/library/target`、`POST /hanamesh/library/install` 的输入中；`GET target` 的 200 结果新增 `contractVersion:'1'`；包 `package.json` 的 `hanamesh.installTarget` 声明提供方实现的版本。itemId/packageName、字段语法、确认、取消、auth、同源与既有拒绝码都不变。影响：Desktop 现有不带版本的安装链接按 v1 照常工作，无需改动；要声明版本时由唯一宿主收尾卡改钉 rc8 后再做。Vibe 钉的应用包协议（rc2）与本契约无关，不受影响。

**变更说明（rc9，只加同实例别名）：** library 路由允许同一端口的两个精确回环 Host，各自必须使用本 origin 的正常 DSH 认证。目标字段、版本 1、目录解析、明确确认、取消、安装事务与失败回滚不改；不新增依赖、配置或权限。schema 的 `loopback` 节与双方 fixture/suite 覆盖两别名及跨 Origin/未知 Host/port/iframe/CSRF/auth/版本拒绝。范围限 library HTTP 与安装目标导航；应用网关、app/router 控制路由及其他插件不变。现有 127 消费方保持，localhost 消费方保持自己的 URL/auth 参数；Desktop/Vibe 无需本轮改动。

**握手：**
- 不带 `contractVersion`：保持 rc7 的 v1 语义。
- `contractVersion:'1'`：接受，其余语义不变。
- 其他任何值（含空串）：在其他字段检查之前明确拒绝 `CONTRACT_VERSION_UNSUPPORTED`（HTTP 400，`details.supported:['1']`；客户端 reject 同名码并在市场显示）。不解析目录、不安装、不静默降级。新版本调用方的额外字段也按版本不符拒绝，不当作普通字段错误。
- 调用方声明了版本时应先读提供方声明（`hanamesh.installTarget`），`supported` 不含自己的版本、或没有声明（rc7 及更早）时自己拒绝，不发送。

**随包内容：**

| 出口 | 内容 |
| --- | --- |
| `./install-target/schema.json` | schema 与契约元数据 |
| `./install-target/suite` | `runProviderSuite()`、`runConsumerSuite(consumer)`、`runChainSuite(consumer)`、`validate()`、`loadContract()` |
| `./install-target/fixtures/catalog.json` | 测试目录（市场界面标「测试目录（fixture）」） |
| `./install-target/fixtures/provider-cases.json` | 提供方用例：公开、版本匹配/不符、无效、缺目录，HTTP/客户端/片段三条入口 |
| `./install-target/fixtures/consumer-cases.json` | 消费方用例：合法目标导航、无效目标拒绝、提供方声明握手 |
| `./install-target/fixtures/reference-consumer.js` | 消费方 fixture：规则全部从 schema 读取（测试用，不是产品编码 API） |

提供方套件在同一配置同一随机端口通过两个别名驱动本包真实的 HTTP 路由、目录服务与客户端模块（测试目录 + 计数安装器），覆盖 auth/同源/非 iframe/授权拒绝、取消不安装、只有明确确认才经原路由安装一次。链路套件把消费方生成的导航片段交给本包真实的片段入口，确认到达市场确认且不安装，并验证同一导航改报不支持的版本会被明确拒绝。

**运行（在安装了本包的消费方项目里）：**

```sh
node node_modules/@hanamesh/dsh-app-host/dist/install-target/run.js provider
node node_modules/@hanamesh/dsh-app-host/dist/install-target/run.js consumer --module ./my-consumer.mjs --export consumer
node node_modules/@hanamesh/dsh-app-host/dist/install-target/run.js consumer            # 随包消费方 fixture（v1 声明）
node node_modules/@hanamesh/dsh-app-host/dist/install-target/run.js consumer --unversioned
```

消费方对象 `{name, contractVersion?, navigate(workspaceUrl, target) → {ok:true,url}|{ok:false,code}, handshake?(declaration) → {ok,code?}}`；导出也可以是返回该对象的无参工厂。每个套件输出一行 JSON 报告，有失败时退出码 1。

## 开发小界面

AppHost 市场顶部「安装目标」：填写「目录条目 ID」或「包名」→「查看安装目标」→市场四字段确认→「确认安装」或「取消」。它调用上述同一公开入口。目录/鉴权失败留在界面中，不放宽检查。

## 本轮供给与验证边界

本包需要通过 Desktop owning 的正常本地冻结包供应进入统一客户端；当前 Desktop rc13 的 AppHost 固定 rc2，装配尚待 Desktop 卡消费本次包。公开 npm 发布与安装包发布不在本卡范围。本轮源码/HTTP/客户端 hook harness 证据不代替正式 HanaMesh.app 的安装、小界面首步与截图。
