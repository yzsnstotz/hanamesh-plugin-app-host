0.6.7 installation-status is a separately consented read capability: exact existing loopback Host/approved Origin, credentials omitted, strict POST body before any reader. Core is authoritative; CLI executable/profile/target/budgets are static trusted settings, never browser input. Official list output is whitelisted and no raw paths, unrelated inventory or errors leave the host. A live detached IPC anchor owns cancellation and parent-disconnect group cleanup; no cached installed answer. See INSTALLATION_STATUS.md for exact protocol and scope limits.

D-230: failed activation releases only resources acquired by that AppHost activation, including partially registered routes and optional-service listeners. Once-only releases also serve normal Cordis unload. All failed-startup releases are attempted in reverse order; APPHOST_CLEANUP_FAILED names the internal resource without raw errors or credentials, and logger failures cannot replace the original activation error. No authentication, origin, lease, application or browser policy is relaxed.

D-221: service availability, package binding, readiness and authorized traffic are not proof of application presentation/business success. No verified original fact source is connected, so the adapter emits no automatic Usage record or timestamp and logs only a fixed USAGE_FACT_UNAVAILABLE capability diagnostic. Independent Router counts, including legacy reported bits, do not prove business success or Usage confirmation. No application event/SDK/credential or trust bridge is introduced.

D-214: verification is trusted producer/client-view configuration, never a Target/URL/global-page capability. Normal builds remain off. Verification uses the existing authenticated/authorized endpoints and explicit installation confirmation; showing full public error JSON does not expose internal exceptions or grant application privileges. Native test automation stays card-local and validates actual owned PID/start/PPID/PGID/argv before claiming launcher evidence.

# 安全与运行边界

## 可信边界

注册描述符、DSH bridge 与宿主代码可信；浏览器请求、应用 HTTP 内容、旧租约和磁盘错误不可信。浏览器不能传命令、argv、env、cwd、dataDir 或任意上游 URL。实际 HTTP 拒绝和负向测试见 acceptance。

本实现**不是 OS 沙箱**。独立数据路径证明正常应用按配置写入隔离目录，不保证恶意的同 UID 本地程序不能访问其他文件、网络或自行调用 setsid。需要强隔离时应另行使用经过验收的 OS sandbox/container，本模块没有实现也没有宣称实现该能力。禁止 daemonizing 启动器；上游适配包必须验证应用使用所分配的 data/HOME/XDG 路径。

## owned 与 attach

每个 owned runtime 使用独立 guardian 及锚定进程组的 launcher。宿主 IPC 断开会触发 guardian 清理；清理仅对该精确子进程创建的进程组，绝不按名称匹配或复用磁盘 PID 发 kill。收到清理确认才发布 stopped。attach 无 guardian、无 kill 路径。

主机断电、内核崩溃、存储损坏、恶意 daemon 脱离进程组不在此次证明范围。

### runtime lock 的死主接管（rc.25）

每个 owned 数据根下的 `.runtime.lock` 由 guardian 持有，记录 `{pid, start, id, children:[{pid,start,command,role,group}], port}`：`start` 是进程启动时间令牌（macOS/Linux 由 `ps -o lstart=` 或 `/proc/<pid>/stat` + boot_id 得到），`children` 是 guardian 自己创建的 launcher（进程组组长）与应用进程。launcher 在收到 launch 指令之前就已被记录，所以它还没机会派生任何东西时锁里已经有它。

guardian 被强杀（桌面壳整棵树被 kill、`kill -9`）后，下一次 acquire 的判定顺序固定为：

1. **owner 活着**（pid 存在且启动令牌一致，或旧格式无令牌但 pid 存在）→ `DATA_ROOT_BUSY`，`details = {pid, start, reason:'owner-alive', port}`，不发任何信号。
2. **owner 死了**（pid 不存在，或同 pid 启动令牌不同 = pid 被复用）→ 逐个核对 `children`：
   - pid 不存在、或启动令牌与记录不同（pid 被无关进程复用）→ 视为已消失，**不发信号**；
   - pid + 启动令牌 + 可执行文件（realpath 比较）三者一致 → **可证明是我们的孤儿**，先 SIGTERM（进程组组长连同 `-pid` 组一起），等 `stopGraceMs`，再 SIGKILL，确认退出后接管；
   - 活着但证明不了（记录或平台缺启动令牌、可执行文件不同）→ `DATA_ROOT_BUSY`，`details = {pid, pids, ownerPid, reason:'orphan-unproven', children}`，不发信号，锁原样保留。
3. 接管仍走原有的 `.recovery` 独占标记序列化；损坏的锁文件依旧 `LOCK_RECOVERY_REQUIRED`，不自动删。

Windows 与无 `ps` 的环境退化为只判 pid 存活：活着的进程永远无法被证明是我们的，只会 `DATA_ROOT_BUSY`，不会接管。绝不按进程名匹配，不 `pkill node`；人工维修时先看 `details.pid`。

Linux 的 socket 所有权检查已实际运行；macOS lsof 路径未实测；Windows owned 在 spawn 前拒绝。平台声明不是跨平台验收。

## 网关

仅 `http://127.0.0.1:<显式端口>`，固定一个上游，不解析用户传入 target，不跟随 redirect，不接受 CONNECT 或绝对请求目标。只有携带当前租约 generation 能力 cookie 的请求可访问；bootstrap 限时单次票据要求指定父页面的 iframe 导航。直接顶层导航、未列名 Origin、过期/旧代能力拒绝。应用响应正文不改写，不注入 HTML、SDK 或 postMessage bridge。

只删除 X-Frame-Options、将 CSP 的 frame-ancestors 设为一个 parent origin，保留其他 CSP 指令和应用头。HTTP hop-by-hop framing/连接由 Node 传输管理；不是网络原始报文字节镜像。bootstrap 是本模块自己的303响应，不冒称上游应用响应。真实浏览器 cookie/iframe 行为本环境被管理员策略拦截，所以不保证 H13 已全通过。

DSH/宿主 cookie、控制头与 Authorization 默认不传上游；应用 cookie 必须逐名白名单，应用 Authorization 需要受信显式开启。父页和应用均在127.0.0.1时，浏览器 cookie 不是按端口隔离的，因此不把“不同端口”当作 cookie 安全边界。本网关的转发过滤只守住到上游这一跳，不能代替原应用正确设计自己的 cookie/auth。

不更改原应用 Origin/CSRF/CORS；带严格自身 origin 校验或绝对 URL 的应用可能拒绝网关请求，必须如实报告并由适配器走受支持的配置，不得通过关掉应用安全策略解决。direct embedding 返回原上游 URL，沿用原应用自己的认证/框架限制，不具有 gateway 能力保护。

## 日志与凭据

市场异步操作失败只投影有界脱敏的Error类型/消息、最多两层cause与既有CLI退出摘要，记录实际执行阶段和operationId；同一安全诊断进入技术详情与宿主logger。拒绝任意details、stack、response对象；Bearer、常见secret字段、URL userinfo/query和Authorization/Cookie行脱敏。不记录环境/请求正文，不承诺识别任意业务敏感文本。原生 registry 查询异常以 REGISTRY_LOOKUP_FAILED 具名并保留原 cause；其它安装异常保持原对象，logger故障不覆盖原异常。

日志有界、按完整行处理、Bearer/常见 token 字段及显式 secret env 值脱敏；超大行丢弃。此规则不可能识别任意业务敏感信息，默认不记录请求体/配置环境。leaseToken 原文只在回执中返回，磁盘保存哈希；工作台不得把 token 放进公开 URL、分析日志或应用 iframe。

恢复凭据属于同一已认证 owner 的显式操作，要求 confirm:true，旋转 generation；真实 DSH bridge 的 authorize 必须对该路径落实授权。示例/测试的固定认证值绝不能作为真实 DSH 身份实现。

## 浏览器测试限制

实际 Chromium 启动于独立临时 profile，但回环导航返回 `net::ERR_BLOCKED_BY_ADMINISTRATOR`。未改管理员 policy、未关 CSP、未使用绕过标志。两个 REAL_BROWSER 测试显式 skip 并在产品矩阵标 PARTIAL，不算 PASS。

测试 Chromium 的 `--no-sandbox` 仅为隔离容器内以 root 运行测试驱动所需，绝非生产应用/DSH 的启动配置；不应该移植到生产 profile。

## D-202 Desktop control and data origin separation

For the fixed Desktop workspace only, each full live view binding owns one independent loopback listener with two exact, freshly random 192-bit localhost names: `control-<nonce>.localhost:<port>` and `data-<nonce>.localhost:<port>`. Only 127.0.0.1 is listened on. Names are non-secret isolation identifiers, never credentials; known retired names cannot be reassigned. A reused OS port does not restore an old origin. Scope is principal/view/generation plus the owning instance and active lease checked by AppHost. A different live view never authorizes an old request.

The workspace checks the precise control origin and the iframe Window; the controlled bootstrap checks exactly `dsh-app://app` and its parent Window. The existing public connection authentication, lease ownership and single-use challenge exchange precede navigation. Authorization appears only in the authenticated response and exact-window message/exchange body, never URLs or logs. One natural control-to-data navigation consumes its own initial grant, then HTTP/resources require the exact data-origin context and live complete binding; WS requires the exact data Origin. Closing, generation rotation and restart invalidate prior authority.

Control serves only bootstrap/exchange, never application documents or resources. Data serves application bytes, never bootstrap authorization pages, so the application ServiceWorker cannot control the bootstrap origin. Only exact registered Host/Origin/Referer/WS origins are admitted; no wildcard localhost, null, aliases or unrelated live grants. Data CSP admits its exact data origin for nested application frames plus the approved workspace ancestor; control CSP does not admit data. Application bodies, SDK, auth/CSRF/CORS and other security headers are unchanged. Ordinary loopback workspace security and the separately specified public install-target endpoint retain their original boundaries.

These are source invariants, not native browser evidence. Component synthetic-header requests, genuine natural native requests, third-party cookie policy, retained frame/worker/SW attacks, same-response bytes, restart and final-tarball U2 are recorded separately. A constructor rejection, skipped browser, draft package or older UI observation cannot close those gates.


## 套件兼容声明边界

兼容、完整性与可升级目标由 Core 公开声明唯一决定；App-host 不复制范围/候选规则、不读其内部文件。内部 `coreSuitePlan` 只由可信装配适配器提供，不进入浏览器参数或用户配置。生产装配仅绑定可选 protocol `1` 的 `hanameshCore.getSuiteDeclaration()`，缺源必须明确 `CORE_SUITE_DECLARATION_MISSING` 并禁止升级，不以 registry latest 代替。执行端只校验固定包/精确版本的计划结构、重读确认和物理安装结果；来源及宿主兼容性由 Core 提供方承担，真实包联调、原生运行与 owner 验收仍须各自证据；物理三包齐全不能替代 Core 完整性。升级后的公开状态继续读 Core，物理读回只用于执行确认与失败诊断；Core 服务消失时不再公开缓存的完整已装状态。


## Managed Node trust boundary

The authenticated browser supplies settings or opaque plan/operation identifiers, never an executable manifest, arbitrary verification arguments or launch command. Only pinned official signed release digests enter the static manifest. Changing an HTTPS mirror changes transport, not the accepted digest. No user-info/query/hash URL or symlinked storage path is accepted. No download before current-plan confirmation. A per-runtime FileLock serializes lib-provision writes; SHA, ownership/ledger and clean-environment standalone platform/version checks precede publication. Host guardian remains unchanged and rejects Electron independently. Source or verification failure never silently falls back to system Node, another mirror or a retry.


B17 候选的套件来源选择仅在 AppHost 自有同源已准入设置端点写入。Core 来源状态是公开只读事实，不授予安装权限；预览/确认/执行及异步声明返回时复读来源，沿用原 planId/精确 tuple/物理 baseline，来源丢失或替换即拒绝原确认。设置保存只串行持久化选择，不触发下载/安装或改写 Core 配置；持久失败保持旧选择。无 service/watch/generation 时保持不可观察边界，不缓存 ready 或回退 registry。详见 CONTRACT.md B17 段。

0.6.16：只消费 DSH 公开源事实和公开排序/后继许可规则，不读 .npmrc、凭据、私有服务字段；配置源与受控 CLI 使用同一选择；null项沿用pnpm自有配置，不显式传registry。30秒上限只用于本次安装前查询，超时终止且不重试；配置源的顺序由 DSH 决定。诊断只投影脱敏的类型/消息/code/cause链及已知CLI字段，同时进既有UI和宿主日志；URL用户信息、全部查询值、Authorization/Cookie、token/secret均删除，限4001字符，不传任意details/stack/响应正文。

公开registry规则只从已证明的宿主manager安装位置加载，复用原版本守卫；不安装第二份manager、不复制生产规则、不从任意浏览器路径加载模块。tests/fixtures的原始MIT规则与SHA/许可证只作测试，不进发布包。
