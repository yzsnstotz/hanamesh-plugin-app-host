# 客户端市场安装目标入口

AppHost `0.2.0-rc.7`。目标输入、目录解析、确认、安装与结果全部归本模块；调用方只传目录标识，负责呈现原市场表面。

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

沿用原 Host、Origin、非 iframe、authenticate、authorize 检查。GET 允许同源浏览器默认不带 Origin；不接受外来 Origin。实际安装只用原 `POST /hanamesh/library/install`，要求精确同源 Origin、`X-HanaMesh-Client: workspace-v1`、资源端身份及授权；重新解析当前目录，不信任请求内版本或地址。进行中返回原 `202 {operationId,status:'started'}`；相同包共享该 operationId。已经安装且没有目录升级时返回 `200 {status:'already-installed',itemId,packageName}`。安装事件/结果与既有安装器不改。目录版本是原目录 latestVersion，既有安装器仍自行核 registry 的 latest 并固定精确版本；最终显示的已安装版本来自 profile 扫描，并与操作结果版本一致才报告读回成功。

## 开发小界面

AppHost 市场顶部「安装目标」：填写「目录条目 ID」或「包名」→「查看安装目标」→市场四字段确认→「确认安装」或「取消」。它调用上述同一公开入口。目录/鉴权失败留在界面中，不放宽检查。

## 本轮供给与验证边界

本包需要通过 Desktop owning 的正常本地冻结包供应进入统一客户端；当前 Desktop rc13 的 AppHost 固定 rc2，装配尚待 Desktop 卡消费本次包。公开 npm 发布与安装包发布不在本卡范围。本轮源码/HTTP/客户端 hook harness 证据不代替正式 HanaMesh.app 的安装、小界面首步与截图。
