# Router contract · rc.10

## 1. 来源模型与状态

Provider 只来自 `dsh-models` 或 `coding-oauth-gateway`，形状为 `{id, source, kind:'api-key', displayName, ref?, baseUrl?, models?, state}`。`state` 只取 `configured | absent | gateway-off | unreachable`。目录查询只调用 `credentials.describe()`；密钥值只在应用每次启动的 resolver 内重新 `resolve()`，不缓存。

`coding-oauth-gateway` 默认经当前 DSH web 的 `/plugins/dsh-grok-build/gateway` 查询；404 代表未安装且不出现在目录。启用操作只转发 PATCH。reveal 值只留在 resolver 内存和 `secrets`。`router.codingOauth.mode:'file'` 是 0600 文件备选，路径为隔离 `DSH_HOME/.coding-oauth-gateway.json`。

## 2. 授权表与 ledger

`hanamesh_router` storage-domain 保存每个 app 的 `mode`、`grants`、文件投射 `ledger` 与撤销标记。grant subject 为 `api-key/ref`、`provider/providerId` 或兼容旧 OAuth 的 `grant/key`；可另存 model。明文、gateway key 和 provider token 永不进入 domain。

文件投射沿用 v1.1 生命周期：新版本 `overwrite`，同版本及应用已自行轮换时 `if-absent`，撤销或切换 app-owned 时一次 `remove`；只有宿主的 `credential.injected` / `credential.file-removed` 事件推进 ledger。

## 3. Resolver 与 `sets`

Router 只投射描述符已声明且已经授权的槽位。`sets` 支持 `{{provider}}`、`{{baseUrl}}`、`{{model}}` 及 `{{name|默认值}}`。展开后的目标也必须是描述符已声明 env；结果为空串时不写入。宿主只校验 `sets` 形状，不解释应用词汇。

## 4. HTTP 路由与错误码

六条 exact 路由：`GET /hanamesh/router/providers`、`GET /hanamesh/router/plan?appId=`、`POST /hanamesh/router/grant`、`/revoke`、`/mode`、`/gateway`。全部经过 app-host 同一 Host、Origin、iframe、认证、授权和 `x-hanamesh-client: workspace-v1` 防护链。响应不含 key 值。

稳定业务错误：`ROUTER_PROVIDER_ABSENT`、`GATEWAY_OFF`、`GATEWAY_UNREACHABLE`、`RISK_NOT_ACKNOWLEDGED`、`ENTRY_UNKNOWN`。

## 5. Storage domain

domain 名 `hanamesh_router`，schema version 1，single/global 整体发布。它与 `hanamesh_app_host` 是两个独立 domain，不混写实例租约。

## 6. 不做

Router 不录入 API key、不执行 OAuth、不监听额外端口、不提供价格或使用量，也不向 iframe 暴露凭据。
