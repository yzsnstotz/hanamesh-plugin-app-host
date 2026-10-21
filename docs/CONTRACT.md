0.6.7 adds the explicitly consented public installation-status capability on both existing library listeners. Full request/response, strict refusals, configured official-reader support and scope/lifecycle are defined in [INSTALLATION_STATUS.md](INSTALLATION_STATUS.md); it does not authorize installation or alter recording consent.

# 公开契约 v1（候选，0.1.0-rc.41；rc.41 卸载 runtime 时清理生成的 Python 字节码缓存、未知残留仍 fail-closed；rc.40 市场只读查询待启动实例，ready 后一次 resume；前台即时 heartbeat 与失效帧显式清理；rc.39 Market seat 内打开应用时将原有应用帧固定铺满原生窗口并覆盖 Settings，同一回执/租约/关闭动作；rc.38 投射时仅提升 shell.overlay 层级以盖过原生 Settings；rc.35 市场开关按钮即时反馈、owned 应用已退出时提前结束 TERM 等待并确认精确进程组终止；rc.34 内置市场消费 heartbeat/视图清理；rc.33 owned 回收与启动握手分阶段限时；rc.32 客户端 `market` 席位与 dshmarket 互斥、壳内重启改走 postMessage 桥（见「市场席位」）；rc.28 HanaMesh 市场：插件与应用同路径装卸、已装含插件、可升级/需重启、`installedPlugins` 与 `plugins/*` 路由、`LIB-PROVISION-INPUT` 400（见「市场」）；rc.27 应用使用证据经 usage 插件 record 座位上报（见「应用使用证据」）；rc.26 应用库默认目录源 + 纯 DSH 位置推断（见「应用库配置」）；rc.15 目录条目校验补 updatedAt；rc.16 应用库默认 category=hanamesh-app、q/cursor 透传；rc.13/rc.14 与 rc.12 契约相同：rc.13 补许可证/repository/精确 peer，rc.14 去掉客户端对 hanameshCore 的读取）

冷恢复中断实例时，将对应旧活跃租约失效并在同一镜像记 `view.expired(reason=host-restart)`；旧视图仍可按原身份恢复并轮换凭据，新视图关闭不受旧租约占用。只有确认进程组退出后才持久发布 `stopped`。

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

`beginOpen` 在 durable reservation 和 bounded spawn 后返回回执（owned 所有权回收先按既有 5s bootstrap + stopGraceMs + 2s kill确认限时；仅 acquire 成功后启动后续独立 5s launcher/app握手，错误/guardian退出在两阶段立即失败），此时可 `close` 取消尚未就绪的启动；`open/start` 等待就绪，供受信调用者使用。回执包含持久 instance、view lease、`leaseToken`、`uiUrl`（未就绪时 null）。原始 token 不写入 sidecar，仅存哈希；只读列表与事件流不返回 token。

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

市场客户端待启动时用 GET `/hanamesh/apps` 只读查询精确实例状态，按原回执 `expiresAt` 对 pending lease 续租；看到 ready 才单次 POST `/apps/resume` 取得 URL。已展示视图在页面回到前台时立即尝试续租，终态 `LEASE_EXPIRED` 或 `INSTANCE_NOT_READY` 清除失效 iframe，由用户从市场显式重新打开。关闭/隐藏继续释放租约并停止最后一个自有视图对应进程；不延长 TTL，不静默恢复。

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
// 内置市场视图已消费此契约：按回执 expiresAt 串行续租；关闭/隐藏/卸载取消续租并显式 close。
// 关闭或停止必须用该 lease；不依赖 unload 做最终回收。
```

SDK 只用于工作台顶层页面，不给应用 iframe。采用 same-origin credentials；认证由真实宿主处理，没有内置默认口令。polling 有界，原 view 的失败状态不会触发匿名重启。取消 waitUntilReady 只取消等待，不伪称撤销已经成功持久化的 Open；显式 close 才释放租约。

## 存储及迁移

完整快照 schema1：instances + leases + durable events + revision/sequence 一次发布。AtomicFileStore 是独立本地参考后端，不能冒称 dsh-storage-domain。目录锁、600 文件、symlink 拒绝、临时写 fsync → rename → 目录 fsync；后 rename 故障标记 COMMIT_UNCERTAIN，禁止继续猜测写入结果。重启清除旧 ready 端点，只保留持久身份。

DSH 绑定必须提供同一个 `single` domain 的一次完整镜像 publish 与 writer 排他权。两次 API 写入不等于事务。没有 Session.append 自定义事件。

候选容量：256个持久实例、2048个视图历史、1024条通知、每实例128条内存日志。达到容量拒绝新建而不偷偷删除未审计历史；尚无自动归档/迁移工具。默认租约90秒、扫描15秒；`sweepIntervalMs:0` 仅用于手动驱动/测试，生产必须启用扫描或可靠外部调用。

## 应用库配置（rc.26）

`library.sources` **未配置**（undefined）→ 默认 `[{manifestUrl:"https://market.hanamesh.com/catalog-source.json?view=hanamesh",enabled:true}]`；显式 `[]` → 无来源（`CATALOG_SOURCE_REQUIRED`，由用户在「应用库来源」里添加）。默认只在初始 revision=0、来源为空的首启播种；已保存的旧来源、自定义来源或手动清空的列表保持原样，不自动迁移。

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

## 市场席位（rc.32，设计定案 2026-09-22 §4，T5）

客户端模块（`./client-ui`，浏览器包）在 DSH 客户端的 cordis 上下文上提供服务 **`market`**：

| 成员 | 形状 | 谁调用 |
|---|---|---|
| `render(options?)` | `options.preferredSubsectionId?: string` → React 元素 | 壳面板 `dsh-tauri-panel-extension`「扩展管理」的「市场」标签体；今天只传 `'installed'` |
| `setSettingsVisible(visible)` | `boolean` → `void` | 面板接管市场时 `false`、dispose 时 `true` |

席位名与形状取自钉死的 `dsh-tauri-panel-extension@1.0.0`（随 `hanamesh-desktop-tauri` 发布，`src-tauri/resources/node_modules/`）：它 `ctx.reflect.get('market')` 取值，`typeof value.render !== 'function'` 时当作没有；不是猜的名字。`render()` 返回的就是「HanaMesh 市场」页本身（内嵌形态：常显、无「关闭」按钮、`preferredSubsectionId==='installed'` 时「已安装」排在目录之前）；`setSettingsVisible(false)` 收起侧栏「市场」入口与覆盖页，`true` 恢复。无壳（官方 DSH 浏览器直开）时没有面板读这个席位，`provide` 不生效属正常，市场仍走侧栏入口。

Market seat 的「打开」保留原 receipt/heartbeat/close owner；应用 iframe 与「关闭视图」固定铺满原生窗口，覆盖 Settings 窄栏。关闭或 seat 卸载时视图清空，原 owner 只释放一次精确租约。无 seat 的侧栏市场仍走原来的 shell.overlay 视图。

**与 dshmarket 互斥（同名席位只能其一）**：cordis 的 `provide` 对同一名字的第二次注册直接抛 `service "market" has been registered at <…>`，抢座会把对方打挂。因此占座前先做两项判定——`ctx.reflect.get('market', false)`（非严格：尚未 active 的提供者也算占座）与一次 `GET /hanamesh/library/installedPlugins`（`plugins[]` 里有 `dshmarket` 即视为在场，无论是否已加载）。任一命中就**不 provide**，改为：宿主日志一条 warn，市场页顶部一条 `role="status"` 提示（`data-hanamesh-market-conflict="dshmarket"`），写明两者只能其一；其它功能（侧栏入口、覆盖页、安装/卸载/重启提示）全部照常，不报错。库路由答不上来（网络/宿主异常）时 fail open，照常占座——席位不承载任何持久事实。X01 边界 `market-seat-exclusive`。

**壳内重启（rc.32 改）**：`hanamesh://restart` 在壳 iframe 内改走壳已有的入站 postMessage 桥 —— `window.parent.postMessage({type:'hanamesh://restart'}, '*')`，与壳 → iframe 的 `hanamesh://bound-refresh` 同一命名空间；壳按 `event.source`/`event.origin` 校验来源后调用自己的重启。原因：WKWebView 不会把 iframe 内发起的自定义 scheme 导航交给系统，`location.assign('hanamesh://restart')` 在壳内不可达。`hanamesh://restart` 这个 URL 仍是系统级入口（外部浏览器 / `open hanamesh://restart`），由壳 `deep_link.rs` 的 `restart` 分支处理。官方 DSH 直开浏览器时仍只提示「请手动重启 DSH」。

## 应用使用证据（D-221，C-USAGE-LOCAL 第1版）

`instance.ready`、成功授权/HTTP资源转发、WebSocket升级、小时桶关闭、应用停止与旧receipt恢复都不能证明实际界面呈现或成功业务操作。AppHost目前没有连接已核实的普通应用公开原事实源，因此**不自动调用 Usage record**，不以接收端时钟、运行时就绪时间或流量时间制造事实。

`createUsageEvidence({host,seat,receipts?,logger?,clock?,sweepIntervalMs?})` 保留既有生命周期接口：
- 注册时通过现有logger给出有界 `USAGE_FACT_UNAVAILABLE` 诊断；不记录应用内容、身份、token、时间或服务响应，logger失败不影响应用。
- `host.onActivity` 仅累计独立Router诊断计数；终止事件清除该实例的路由引用。原401/403过滤、路由校验、计数/去抖持久化与保留规则不变。
- `flush` / `settle` 仅等待本地诊断账本持久化，不代表Usage受理、处理或提交确认。`flush`旧筛选参数仍可传，但不会筛选生成业务事件；`sweepIntervalMs`仍校验并接受，但不启动小时上报timer。
- 启动、flush、close及恢复旧行不发送record、不自动重试、不自动置reported。遗留 `reported` 位/显式 `markReported()` 操作是账本兼容状态，不能证明业务成功或Usage确认。

可选Usage席位仍经公开Cordis注入，不互相import。只有席位存在或返回recorded也不能使无源事实合法；缺席、不兼容、拒绝均不妨碍应用启动/转发。当前适配器不会向该席位提交运行时或流量观察。

`packageName`、`host.bindPackageName()`、`host.packageName()` 与 `list().apps[].packageName` 保持正常登记/安装读回归属能力，包名字符串或item/appId相似不证明完整映射。未来消费合法源必须先核正常安装的item/package/app/Hana关系及公开呈现/成功源与原UTC时间，按正式C-USAGE-LOCAL原键和可选归因调用record，并通过health/observeCollection区分重复、冲突、拒绝、pending/confirmed；不在AppHost复制提供方去重/签名或把pending=0当完成。当前缺面保持未知并交PM，不新造应用event/SDK/信任桥。

本轮SOURCE/FIXTURE负例证明停止伪事实；真实普通应用的两次新结果、合法原事实及真实Usage正向结果仍须独立产品取证。

## D-202 fixed Desktop extension

The plugin recognizes the exact upstream Desktop host entry and proves its profile link and runtime manifests before inferring paths. Explicit configuration wins; arbitrary cwd, ports or package names do not identify a Desktop. The declared standalone Node is inspected as Node, never substituted with Electron. Installation goes through the upstream public `runDesktopCli(runtimeDir, supportDir)` export with the reserved `plugin --profile desktop` arguments preserved; no upstream source is patched.

For the exact privileged workspace, the existing authenticated control transport gains `POST /apps/bootstrap-authorize` with `{viewId, leaseToken, gatewayOrigin, challenge}`, returning `{authorization}` only after complete ownership/live-generation checks. A challenge is loaded and exchanged once, valid only for its owning exact origin/view. Failures include `UNAUTHENTICATED`, `LEASE_NOT_OWNED`, `LEASE_EXPIRED`, `GATEWAY_CHALLENGE_DENIED`. The controlled page and workspace perform exact-origin and Window/source proof. AppHost returns a control bootstrap URL in the ordinary open/resume receipt, then the page naturally navigates to the bound data origin; applications receive no injected SDK or authorization.

Current C-MARKET edition 1 routes/readback and the hidden-by-default verification page remain intact. The direct C-WEB-CATALOG HanaMesh query is validated before all network access, including manifest discovery; the public market listing retains its own boundaries. Formal provider documents remain authoritative. No new Usage fields or observation calls are inferred from this implementation.

## D-230 activation cleanup and ordinary-app admission

Every acquired route, optional-service subscription, resolver/observer, domain, ledger and host is paired immediately with a once-only release. Failed activation attempts all acquired releases in reverse order and rethrows the original activation error. A failed release is reported with the fixed APPHOST_CLEANUP_FAILED diagnostic and its internal resource label; raw errors and credentials are excluded. Success uses the same releases for Cordis unload, without stopping another plugin or signalling attached applications.

Normal installation, registration and application readback remain separate: the application installer reads the declared hanamesh.app member or falls back to app.json after exact profile/module version readback; scanInstalled requires a truthy hanamesh.app declaration. Public config.applications can register a trusted definition but does not create an installed-application row or prove item/package/app/Hana ownership. An npm main/bin alone supplies neither. Explicit definition.packageName wins over the installed scan binding; this is a lookup rule, not proof of an installation or original business fact. No admission/Usage bridge is added.


## Plugin-managed standalone Node (2026-10-21 candidate)

Only AppHost owns `hanamesh_node_runtime` (single, v1): `{schema:1, revision, settings, active}`. Activation and settings saves never download. Saved settings override explicit plugin defaults; an existing proven/configured nodeBinary remains external until the person selects managed. A missing or invalid external binary fails visibly; it never silently switches to Electron, PATH or download.

Authenticated same-origin routes (normal workspace CSRF and connection cookie):
- GET `/hanamesh/library/node-runtime`: settings, names, supported platform, current verified binding and preparation progress/failure.
- POST `/hanamesh/library/node-runtime/settings`: exactly `{settings:{mode,version,sourceBase,storageRoot,externalBinary}}`. All five named settings are visible/editable in the plugin settings section. Source is credential/query-free HTTPS; version is one of the pinned, signed releases; storageRoot is an absolute dedicated path with no symlink components. Saving never acquires an asset.
- POST `/hanamesh/library/node-runtime/plan`: `{}`; reads platform/disk and returns exact source/version/archive bytes/extracted file bytes/space/root/SHA/license and opaque planId. No network or target directory creation. Latest plan wins; saves invalidate it.
- POST `/hanamesh/library/node-runtime/prepare`: exactly `{planId,confirm:true}`; accepts only the current unchanged plan. Starts one asynchronous operation with an operationId. Public lib-provision receives one confirmed source, immutable asset SHA, AbortSignal and visible progress; no automatic source switch or retry.
- POST `/hanamesh/library/node-runtime/cancel`: `{operationId}`; cancels only the active preparation, not accepted business operations. No new binding until file, ledger and independent version/platform/Electron checks complete, then the complete active record is persisted before ready.

Public install-target remains read-only and unchanged. Preparation never weakens authentication/CORS or guardian admission. Subsequent AppHost spawns, library CLI supervisors and installation readers capture the new standalone binding without restarting DSH. In-flight operations retain their delegate; settings/preparation reject while library/host operations are in use.

Support implementation: macOS13.5+ arm64/x64, known Node24.13.1 or24.22.0 (default24.22.0). Windows is explicitly unsupported: POSIX-owned process supervision, cancellation and reader chain need separate implementation and real-host proof. No Windows ready claim. mac x64 native proof is tracked separately from its signed archive integrity. No client or upstream files change. No npm lifecycle download.

Storage space budget is archive bytes + twice measured regular-file payload (new tree + staging); never delete another version or unknown files to make space. lib-provision alone owns staging/ledger/manifests; interrupted or cancelled downloads may leave its resumable owned cache. Another attempt requires a new visible confirmation. Existing versions remain until an explicit owned cleanup is designed; no automatic deletion or implied rollback. Offline startup verifies an existing active tree/ledger and standalone executable; failures are visible and never trigger a download.


## B17 套件安装包来源（2026-10-21 候选）

AppHost 自有设置页「套件安装包来源」，公开同源端点 `GET|POST /hanamesh/library/suite-source`。GET 无参数，返回 `{mode, configuredRegistry, observation, traceId}`；`mode` 为 `configured|core`。`configured` 是唯一新增默认：继续使用原 `library.registry`（未设仍为 `https://registry.npmjs.org`）。市场目录 `library.sources` 的未设播种、显式空数组、自定义及已保存值均独立保持；目录 manifest URL 不是 npm registry。

POST 严格只接受 `{mode:'configured'}` 或 `{mode:'core'}`，不接受 registry、版本或其他字段/查询参数。沿用精确 Host、同源 Origin、workspace-v1、Connection admission、逐操作 authorization、JSON/65536 字节及 no-store 规则。选择存自己的 `hanamesh_library` 单镜像可选 `suiteSource:{mode}`；未存值不改旧记录。来源、目录和网站交接设置按接收顺序串行读改写整个镜像，成功持久化后才发布新内存状态；保存失败 `500/SUITE_SOURCE_SAVE_FAILED`，旧选择和其他字段保持；关闭等待已排队写入。

GET 的 `observation` 为 `{observable:false,code}` 或 `{observable:true,state}`。后者仅转发公开 Core `hanameshSuiteSource` protocol `'1'` 同步 `getState()` 的六个字段：`protocolVersion/status/selection/registry/archiveCount/lastError`。status 为 `disabled|ready|failed|disposed`，selection 为 `configured|custom|disabled`。服务缺失（含尚未 provide）为 `CORE_SUITE_SOURCE_MISSING`，不杜撰 starting/ready；旧协议、读取异常或无效 DTO 为 `CORE_SUITE_SOURCE_INVALID`。GET 仅观察，保存不触发安装或授权。

明确选择 core 后，预览、确认、紧接执行之前各自重新读取当前 source 和 Core `getSuiteDeclaration({registry})`，并在异步声明返回后复核来源。`ready` 仅表示来源可读；兼容性仍唯一由 Core declaration 决定。disabled/failed/disposed 或无有效 registry 为 `409/CORE_SUITE_SOURCE_NOT_READY`；不缓存 ready、不回退配置 registry、不挑最新、不重试。沿用 declarationId、精确 tuple/metadata digest/repository、物理已装 baseline 和本人 planId。URL、selection、选择模式或提供服务的对象身份变化均终止原确认；新预览仍须本人确认。服务对象身份是 AppHost 内存内 opaque token，**不是 Core 的 generation/revision**；protocol 1 没有该事实或 watch，不能声称观察到两次读取间完全消失又恢复原状的事件。

最后执行仍调用现有官方 CLI `add --save-exact --strict-peer-dependencies --registry=<声明原址>`，精确三组件；正常市场外部包路径不变。正在执行时源连接丢失由实际 CLI/输运终态报告，不靠重试/退出屏障维持源。Core B17 服务只来自候选 `c5e1a7373b9896c385f14f79a64bb277f43bde5c` 的公开能力；无 Core 运行时 import，无 Desktop hook/bootstrap、三锁或先于插件加载的服务。源码/真实 Cordis+JSON domain（AUTH_DOUBLE）与正常包验证不等同真实原生安装或 owner 验收。

公开类型位于 `@hanamesh/dsh-app-host/dsh` 的 `SuiteSourceMode/CoreSuiteSourceState/SuiteSourceSettings/SuiteSourceSettingsInput`；页面导出 `SuiteSourceSettingsSection`。回归：`suite-source.test.mjs`、`handoff-integration.test.mjs` B17-CORDIS，变异 M84–M89（M61 检查全部后续读取被错误缓存）。


B17 review repair（同0.6.8候选）：`AppHost` 未注入 `runtimeLedgerReader` 时，默认经正常依赖 `@hanamesh/lib-provision` 的公开 `ledger(root)` 读取 `<dataRoot>/runtimes/<appId>/.provision/ledger.json`。不存在的历史 `./provision/index.js` 导入已撤除；不复制账本实现或回退其它根。匹配版本与可执行检查仍 fail-closed。`AH-P05` 与正常tgz消费者均不注入 reader，使用有效真实账本启动实际 runtime、读回就绪响应与应用数据；M90检验错误导入不能回归。这仍不等于真实桌面应用的 owner 验收。
