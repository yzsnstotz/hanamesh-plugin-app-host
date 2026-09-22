# 公开契约 v1（候选，0.1.0-rc.28；rc.28 HanaMesh 市场：插件与应用同路径装卸、已装含插件、可升级/需重启、`installedPlugins` 与 `plugins/*` 路由、`LIB-PROVISION-INPUT` 400（见「市场」）；rc.27 应用使用证据经 usage 插件 record 座位上报（见「应用使用证据」）；rc.26 应用库默认目录源 + 纯 DSH 位置推断（见「应用库配置」）；rc.15 目录条目校验补 updatedAt；rc.16 应用库默认 category=hanamesh-app、q/cursor 透传；rc.13/rc.14 与 rc.12 契约相同：rc.13 补许可证/repository/精确 peer，rc.14 去掉客户端对 hanameshCore 的读取）

## 身份与所有权

`appId` 是已注册应用；`deploymentId + dataId` 是部署与数据身份；`instance.id` 是持久槽位；`runtimeId` 是每次真实运行的新身份；`principalId + viewId + generation` 是视图租约。`originalSessionId` 只保存原应用的 opaque 标识，本宿主**没有**因此实现原应用文档/会话的自动恢复。端口、PID、gateway URL 都是易变诊断信息，不能拿来恢复身份。

单实例范围是 **principal + app + deployment + data**，不是跨用户全局共享进程。一个 AtomicFileStore 根只允许一个活跃 host writer；该进程内并发启动合并，另有每数据根 runtime lock 防止第二宿主同时占用（rc.25 起该锁记录 owner/子进程的 pid + 启动令牌，guardian 被强杀后按 `SECURITY.md`「死主接管」规则安全回收；活着的 owner 或证明不了归属的孤儿仍 `DATA_ROOT_BUSY` 并在 `details.pid` 给出活 pid）。多实例每次新 view 默认新槽位，明确传入 owned `instanceId` 才共享已有槽位。

## 注册描述符（仅受信宿主）

```js
host.register({
  id: 'notes', name: 'Notes', singleInstanceOnly: true,
  deployments: [{
    id: 'local', dataId: 'notes-v1', mode: 'owned',
    command: '/absolute/path/to/node',
    args: ['/absolute/path/to/app.mjs', '{{port}}', '{{dataDir}}'],
    env: {}, envAllowlist: [], embedding: 'gateway',
    readiness: { path: '/health', status: 200, bodyIncludes: 'NOTES_APP' },
    startTimeoutMs: 10000, stopGraceMs: 1000,
    gateway: { cookieAllowlist: ['notes_session'], allowAppAuthorization: false }
  }]
});
```

绝对 command、argv 数组、显式 envAllowlist；无 shell 拼接。模板只接受 `dataDir/port/instanceId/runtimeId/appId/deploymentId/dataId`，必须绑定 dataDir 与 port。部署不得 daemonize/setsid 脱离所拥有的进程组。dataDir、HOME、TMPDIR 与 XDG 由宿主计算；与既有持久记录不匹配时要求显式迁移，不猜测改绑。

attach 描述符只有 `url: http://127.0.0.1:<固定端口>` 与身份探针，不允许 command/args/env。attach 就绪是端点+标记匹配，不冒称对外部进程的所有权。

### 便携 runtime（rc.12）

应用包可以用 `runtime: { manifest, item, exec }` 代替绝对 `command`。`item` 必须精确命中 `manifest.items[].id`；`installTo` 与 `exec` 都只能是无空段、`.`、`..`、反斜杠、NUL 或绝对盘符的相对 POSIX 路径。存在 `runtime` 时禁止再提供 `command`。

宿主只从 `<dataRoot>/runtimes/<appId>/.provision/ledger.json` 认领安装结果，且账本中的 item 版本必须与描述符 manifest 完全一致。最终命令固定为 `<dataRoot>/runtimes/<appId>/<installTo>/<exec>`；文件不存在或没有可执行位统一失败为 `RUNTIME_MISSING`，绝不回退到 PATH、系统 Python、`process.execPath` 或应用提供的任意路径。`args`、`env`、凭据投射、readiness 与 K5 guardian 生命周期规则不变。

### 凭据声明与注入（rc.4，[凭据决策](../../../../Docs/Projects/hanamesh/decisions/2026-09-14-credentials-oauth-and-apikey.md) §3.3）

owned 部署可带 `credentialEnv: CredentialEnvEntry[]`：app 声明**需要什么**，从不声明值从哪来。

```js
credentialEnv: [
  { env: 'OPENAI_API_KEY', kind: 'api-key', providers: ['openai'], required: false, purpose: 'LLM' },
  { env: 'LANGCHAIN_PROVIDER' },                                     // 派生值，由 broker 按所选引用填
  { path: '.codex/auth.json', kind: 'grant', projection: 'file', providers: ['openai-chatgpt'] },
]
```

- `projection:'env'`（默认）：`env` 是 POSIX 标识符，不得是宿主控制变量（`DSH_*`、`NODE_OPTIONS`、`LD_*`、`DYLD_*`、`PATH`、`HOME`、`TMPDIR`、`XDG_*`），不得与静态 `env` 重名。
- `projection:'file'`：`path` 相对 **`base`**——`'home'`（默认，`<dataDir>/home`）或 `'dataDir'`（给 `$XXX_HOME={{dataDir}}` 这类 app，例如 Vibe 的 `auth/openai-codex.json`）；不含 `.`/`..` 段、不以 `/` 开头；写入 0600，父目录 0700。`format` 是给 broker 看的 opaque id（如 `codex-cli-auth-json`、`oauth-cli-kit`），宿主不解释。（rc.5 增：`base`/`format`）
- 值来自 **credential broker**：`new AppHost({ credentialResolver })` 或运行中 `host.setCredentialResolver(fn)`（返回 disposer；`plugin-auth-apikey` 在 DSH 里 `ctx.hanameshApps.setCredentialResolver(...)`）。每次 owned 启动前调用 `resolver({ appId, deploymentId, instanceId, principalId, credentialEnv })`，期望 `{ env?, files?, secrets? }`。
- **只接受声明过的名字/路径**：其余丢弃并记事件 `credential.env-rejected {names}`；注入成功记 `credential.injected {names}`（只有名字，永无值）；resolver 抛错记 `credential.resolver-failed {code}` 且**不阻止启动**（FR-02）；无 resolver 时行为与 rc.3 相同。
- **`sets`（rc.8）**：槽位可声明 `sets: { ENV: 'value' }`。每个键必须是同一 deployment 已声明的 env 槽位；模板由 Router 展开。宿主只校验形状，不解释、不注入。
- **文件生命周期（rc.6）**：resolver 的每个 `files[]` 项带 `policy`：`if-absent`（默认）——目标已存在就不动（app 自己旋转过的 token 保留），记事件 `credential.file-kept`；`overwrite`——新 grant 版本，替换；`remove`——撤销 / 切 app-owned 时删除，记 `credential.file-removed`。宿主**从不读回**投射文件；「投射已完成」由 `credential.injected` 事件（含 `file:<path>`）告知 broker（`host.subscribe`）。
- 注入值与 `files` 内容进入日志脱敏集合；静态 `env` 与宿主变量仍优先于注入值（不能用凭据覆盖 `HOME` 等）。
- `list()` 的 `apps[].deployments[].credentialEnv` 原样带出，供客户端渲染「缺凭据」；是否已授权由 broker 的 `plan` 回答，本宿主不存任何凭据。

### 定义变更（rc.7）

app 升级会改描述符。宿主只在数据绑定（dataDir/mode，`BINDING_PATH_INVALID`）上严格；**未运行的实例在下次 open 时直接采用新定义**，记事件 `instance.definition-adopted {previous,current}`（指纹前 12 位）；运行中的实例只能在停止后采用（`DEFINITION_CHANGED` 409）。

## Host service

`register / beginOpen / open / start / resume / recoverView / heartbeat / close / stop / stopAll / instance / instanceList / list / logTail / eventsSince / subscribe / dispose`。`.d.ts` 是可编译的精确字段定义。宿主方法省略 principal 时是受信 `host` 主体，浏览器路由必须使用认证系统给出的主体，不能从请求体读 principal。

`beginOpen` 在 durable reservation 和 bounded spawn 后返回回执，此时可 `close` 取消尚未就绪的启动；`open/start` 等待就绪，供受信调用者使用。回执包含持久 instance、view lease、`leaseToken`、`uiUrl`（未就绪时 null）。原始 token 不写入 sidecar，仅存哈希；只读列表与事件流不返回 token。

Open 请求为 `{appId,deploymentId,viewId,leaseToken?,instanceId?,originalSessionId?}`。已知 view 必须带其当前 token；重复 Open/Renew 保持 generation 和引用数，不重复 spawn。inactive/expired lease 显式 resume 时旋转 token/generation。Open 回执丢失不应生成另一个 view 来碰运气。

### 精确恢复

1. 工作台保存稳定 viewId 和 instanceId，凭据保存在其受保护的缓存；缓存不是实例权威。
2. 正常恢复：`resume({viewId,leaseToken})` 从持久绑定中找 app/deployment/data/instance，不“找第一个 ready”。
3. token 丢失：已认证 owner 调用 `recoverView({viewId,instanceId,confirm:true})`，必须先向用户确认撤销旧凭据；再用返回 token resume。恢复凭据本身不增加/续租、不启动应用；跨主体或不匹配 instance 拒绝。
4. 单次 Open 响应丢失可能留下一个可过期的预留；恢复操作解决“记录存在但浏览器没有 token”的场景，不能把传输超时当作未写入。

### Stop 与通知

`stop(id)` 有活跃视图时返回 `INSTANCE_IN_USE`，details.views 包含 viewId/generation/expiresAt。`stop(id,{confirm:true})` 先记录 stopping、清理自身网关/进程，再一次镜像发布 stopped、撤销租约和各 view 的 `view.stopped` 通知。`instance.stop-requested` 不是停止完成。

close 幂等，只关闭给定代的 owned view；最后一个活跃租约释放后停实例。并发新 Open 与最后 close 竞争时，重新检查占用，不误停新视图。Stop/cancel 期间的新 Open 返回可解释错误，不偷偷创建替代实例。attach Stop 只撤销附着和视图，不对外部服务发信号。

`eventsSince(after)` 返回 durable sequence、events、resetRequired；通知日志最多1024条，过旧游标应重新 list 后按稳定身份恢复。`subscribe` 仅面向受信宿主进程，浏览器不能订阅所有主体。已停止事件与视图状态原子发布。

## HTTP 控制面（必须安装认证/授权回调）

| 路径 | 方法 | 请求 |
|---|---|---|
| `/hanamesh/apps` | GET | 无查询参数；列表绝不产生引用 |
| `/apps/open` | POST | Open 请求；返回非阻塞回执 |
| `/apps/resume` | POST | `{viewId,leaseToken}`；精确恢复，可能仍 starting |
| `/apps/recover` | POST | `{viewId,instanceId,confirm:true}`；认证 owner 的显式凭据找回 |
| `/apps/heartbeat` | POST | `{viewId,leaseToken}` |
| `/apps/close` | POST | `{viewId,leaseToken}` |
| `/apps/stop` | POST | `{instanceId,confirm?:boolean}` |
| `/apps/events?after=0` | GET | 通知游标 |

请求必须命中具名 host，写入必须有准确 Origin、JSON 和 `X-HanaMesh-Client: workspace-v1`，禁止 iframe 控制请求。认证回调先获得主体，授权回调逐请求判断，缺失任意回调拒绝启动。响应隐藏 PID、dataDir、命令和环境，带 traceId。400/401/403/404/405/409/413/415/503/504 分别按实际错误返回；失败并不代表一定没有持久预留，应使用 view 身份检查。

文档原表将 open/close 列在“只读路由”下，但它们会修改租约；本候选使用 POST 保持“GET 无状态变更”边界。原型客户端的 method/descriptor 兼容性待比对，不能无版本地替换原接口。

## 工作台 SDK

```js
import { WorkspaceAppClient } from '@hanamesh/dsh-app-host/client';
const apps = new WorkspaceAppClient({ origin: location.origin });
const receipt = await apps.open({appId:'notes',deploymentId:'local',viewId:'stable-view-123'});
// 回执必须尽早保留，发生超时仍能显式 close 或恢复。
const ready = await apps.waitUntilReady(receipt);
iframe.src = ready.uiUrl;
// 按已配置 TTL 的约 1/3 周期 heartbeat({viewId,leaseToken})。
// 关闭或停止必须用该 lease；不依赖 unload 做最终回收。
```

SDK 只用于工作台顶层页面，不给应用 iframe。采用 same-origin credentials；认证由真实宿主处理，没有内置默认口令。polling 有界，原 view 的失败状态不会触发匿名重启。取消 waitUntilReady 只取消等待，不伪称撤销已经成功持久化的 Open；显式 close 才释放租约。

## 存储及迁移

完整快照 schema1：instances + leases + durable events + revision/sequence 一次发布。AtomicFileStore 是独立本地参考后端，不能冒称 dsh-storage-domain。目录锁、600 文件、symlink 拒绝、临时写 fsync → rename → 目录 fsync；后 rename 故障标记 COMMIT_UNCERTAIN，禁止继续猜测写入结果。重启清除旧 ready 端点，只保留持久身份。

DSH 绑定必须提供同一个 `single` domain 的一次完整镜像 publish 与 writer 排他权。两次 API 写入不等于事务。没有 Session.append 自定义事件。

候选容量：256个持久实例、2048个视图历史、1024条通知、每实例128条内存日志。达到容量拒绝新建而不偷偷删除未审计历史；尚无自动归档/迁移工具。默认租约90秒、扫描15秒；`sweepIntervalMs:0` 仅用于手动驱动/测试，生产必须启用扫描或可靠外部调用。

## 应用库配置（rc.26）

`library.sources` **未配置**（undefined）→ 默认 `[{manifestUrl:"https://market.hanamesh.com/catalog-source.json",enabled:true}]`；显式 `[]` → 无来源（`CATALOG_SOURCE_REQUIRED`，由用户在「应用库来源」里添加）。默认只在存储为空的首启播种；已保存的来源永不被默认覆盖。

`library.profileDir` / `profileName` / `dshBin` 与 `nodeBinary`：显式配置永远优先。缺省时按下列规则推断，推不出即留空（安装不可用 `LIBRARY_INSTALL_UNAVAILABLE`，浏览与已安装扫描仍照常）：

| 键 | 推断来源 | 拒绝条件 |
|---|---|---|
| `profileDir` | 本包真实安装根（`import.meta.url` 向上到 `@hanamesh/dsh-app-host` 包根，`realpath`）之上第一个 `node_modules/@hanamesh/dsh-app-host` 解析到该根、且 `package.json` 的 `dependencies` 或 `dsh.profile.bundles` 提到 hanamesh 的祖先目录 | pnpm `.pnpm` 存储目录（无 profile 清单）、非 hanamesh profile、源码 checkout |
| `profileName` | `basename(profileDir)` | 无 `profileDir` |
| `dshBin` | `process.argv[1]`，仅当以 `/@deepseek-ai/dsh/lib/bin.js` 结尾且为绝对路径；否则再尝试从 profile 解析 `@deepseek-ai/dsh/lib/bin.js` | 任何其它脚本 |
| `nodeBinary`（库操作用） | `process.execPath`，仅当 `process.versions.electron === undefined` | Electron（K5 fail-closed `NODE_RUNTIME_REQUIRED`） |

推断结果以一行结构化日志 `hanamesh-app-host library: inferred {…}` 打出（只含路径与来源 URL，不含凭据）。不从 cwd、`PATH` 或个人 `~/.dsh` 猜。

## 市场（rc.28，设计定案 2026-09-22 §4）

`/hanamesh/library*` 路由全部保留，语义只增不改：

| 路由 | 方法 | 输入 | 输出 |
|---|---|---|---|
| `/hanamesh/library` | GET | `q`、`category`（缺省 `hanamesh-app`；`category=` 空 = 全部）、`cursor` | `{source, items[], categories[], installed[], plugins[], restartRequired, page}`；`items[]` 每条目在目录字段之外加 `kind`（`application` = `hanamesh-app` + npm 包；`plugin` = 其它 npm 包；`listing` = 无 npm 包，仅收录）、`application`（兼容）、`installed`（应用行或插件行，或 `null`）、`upgradeAvailable`（目录 `latestVersion` 严格新于已装 `version`；已装行处于 `uninstalled-not-unloaded` 时恒 false）；`categories` = 本页条目出现过的类别（目录契约没有类别清单端点） |
| `/hanamesh/library/installedPlugins` | GET（POST → 405） | 无参数 | `{plugins[], apps[], restartRequired}`；`plugins[]`：`{packageName, version, kind:'plugin', bundle, active, state, errorCode?}`，`state` ∈ `installed` / `installed-not-loaded`（启动后新增）/ `uninstalled-not-unloaded`（启动后移除，进程仍加载）/ `invalid`（依赖里有、`node_modules` 里读不到）；`apps[]` = 原已安装应用扫描行（`registered` / `installed-not-loaded` / `runtime-missing` / `invalid`） |
| `/hanamesh/library/install` | POST | `{itemId, packageName?}` | 202 `{operationId,status:'started'}`；`packageName` 给出时用它精确查目录（`q=<包名>&category=`）再按 `itemId` 匹配；应用与插件同一路径 `dsh plugin add --save-exact <包>@<registry latest>`，应用另外供给 runtime；也是升级路径 |
| `/hanamesh/library/plugins/install` | POST | `{packageName}` | 202；包必须在启用目录里能搜到（否则 404 `CATALOG_ITEM_MISSING`）；目录条目是应用则走应用路径 |
| `/hanamesh/library/plugins/uninstall` | POST | `{packageName}` | 202；`dsh plugin remove <包>`；若该包是已装应用则转应用卸载（runtime 清理 + 运行中 `INSTANCE_IN_USE` 409） |
| `/hanamesh/library/provision` | POST | `{appId, packageName, runtimeItem}` 三者必填 | 202；缺字段/非法 → 400 `INVALID_INPUT`（`LIB-PROVISION-INPUT`） |
| `/hanamesh/library/uninstall` | POST | `{appId, packageName, runtimeItem?}` | 202；缺字段/非法 → 400 `INVALID_INPUT` |

事件流 `library.install-*` 增加 `kind`；`install-done.result` 对插件为 `{status:'restart-required', kind:'plugin', packageName, version}`。受保护包（`hanamesh-core`、`hanamesh-usage`、`@hanamesh/dsh-app-host` 及旧写法 `@hanamesh/dsh-core`、`@hanamesh/dsh-usage`）任何路径都 `PACKAGE_DENIED`：`plugins/*` 在启动操作前同步答 403，目录条目路径在操作内以 `-failed` 事件给出。「需重启」判定只来自本进程启动时的 profile 依赖快照（钉版本内核不暴露已加载插件集合）；快照不可读时一切已装计为已加载。客户端在壳内（`window.self !== window.top`）给 `hanamesh://restart` 深链，官方 DSH 直开时只提示文字；本包不重启 DSH。

## 应用使用证据（rc.27，用户 2026-09-21 定，STATUS `P2-USE-EVENTS`）

应用的 `open` / `use` 使用证据由 **app-host** 经 usage 插件的 record 座位上报；app-host 自己不存事件、不签名、不上传。三插件互不 import：`ctx.inject(['hanameshUsage'], …)` 以**可选**服务取得 `ctx.hanameshUsage`，只鸭子类型地要求 `record(input): Promise<{disposition:'recorded'|'duplicate'|'withheld'|'rejected', eventId?, code?}>`。座位缺席、形状不符、抛错或返回 `rejected`，一律**只打 debug 日志**，不抛、不阻止应用启动或网关转发；`withheld`（用户未同意）与 `duplicate`（重复）是正常结果，同样只 debug。

| 事件 | 触发点 | `idempotencyKey` | `occurredAt` |
|---|---|---|---|
| `open` | 实例到达 `ready`（视图真被服务）——每次成功启动一次；同一实例的第二个 view 不重复 | `open:<appId>:<instanceId>` | 就绪时刻 |
| `use` | 该实例的网关**真的转发**了一个已授权请求且应用回应不是 401/403（含成功的 WebSocket 升级）；每应用每 UTC 小时最多一次 | `use:<appId>:<YYYYMMDDHH>` | 该小时桶内第一个被转发请求的时刻 |

不计入 `use` 的：引导票据 `/__hanamesh_bootstrap/*`、网关拒绝（403 `GATEWAY_*`）、应用自己的 401/403 回应、宿主的就绪探针（探针直连上游，不经网关）、`embedding:'direct'` 部署（没有网关，没有活动信号）。每实例只记一个「上次小时桶」，实例 `stopped`/`failed`/`interrupted` 即丢弃，map 以活实例数为界。

`hanaRef` = 应用的 **npm 包名**（与 usage `validHana` 同形：`@scope/name` 或 `name`，≤128 字符），`sourcePlugin` = `@hanamesh/dsh-app-host`。包名来源按序：① 描述符可选字段 `packageName`（rc.27 新增，`validateDefinition` 校验形状；不带则完全向后兼容）；② 宿主启动时的已安装扫描（`<profile>/node_modules/<pkg>/app.json` → `id`）经 `host.bindPackageName(appId, packageName)` 绑定——应用包只注册纯 `app.json`，扫描先于应用包注册发生，所以绑定不要求 appId 已注册；③ 都没有 → 该应用不产生证据（debug 日志），启动照常。`list().apps[].packageName` 带出当前解析结果（无则 `null`）。

新的宿主面：`host.bindPackageName(appId,name)`、`host.packageName(appId)`、`host.onActivity(listener)`（内存内活动通知 `{type:'instance.activity',instanceId,appId,deploymentId,principalId,at}`，不落 `eventsSince`）；`FixedGateway({ onForward })`；`createUsageEvidence({ host, seat:()=>ctx.hanameshUsage, logger })` 是把二者接到 record 座位的适配器（`dsh.js` 已装好；`close()` 随插件卸载）。
