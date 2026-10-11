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

日志有界、按完整行处理、Bearer/常见 token 字段及显式 secret env 值脱敏；超大行丢弃。此规则不可能识别任意业务敏感信息，默认不记录请求体/配置环境。leaseToken 原文只在回执中返回，磁盘保存哈希；工作台不得把 token 放进公开 URL、分析日志或应用 iframe。

恢复凭据属于同一已认证 owner 的显式操作，要求 confirm:true，旋转 generation；真实 DSH bridge 的 authorize 必须对该路径落实授权。示例/测试的固定认证值绝不能作为真实 DSH 身份实现。

## 浏览器测试限制

实际 Chromium 启动于独立临时 profile，但回环导航返回 `net::ERR_BLOCKED_BY_ADMINISTRATOR`。未改管理员 policy、未关 CSP、未使用绕过标志。两个 REAL_BROWSER 测试显式 skip 并在产品矩阵标 PARTIAL，不算 PASS。

测试 Chromium 的 `--no-sandbox` 仅为隔离容器内以 root 运行测试驱动所需，绝非生产应用/DSH 的启动配置；不应该移植到生产 profile。

J1S2-AH-02：仅工作区父来源新增精确 `dsh-app://app`；应用目标不放宽。Desktop 控制面通过准确 HTTP transport + 上游 cookie 认证接受壳转发后的无 Origin 请求，普通 HTTP 写入 Origin 规则不变。历史 0.5.1/0.5.2 网关 bootstrap 要求精确 Desktop Referer，实际 Chromium 省略该头时被拒绝；D-26 A 候选在下方说明，不能以 Desktop 来源替代能力授权。


## J1S2-AH-02 / D-26 A Desktop bootstrap candidate

Only exact `dsh-app://app` uses a controlled bootstrap page. Workspace checks the exact returned gateway origin and its own iframe Window; bootstrap checks `event.origin === "dsh-app://app"` and `event.source === parent`. The workspace then POSTs `/apps/bootstrap-authorize` with `{viewId, leaseToken, gatewayOrigin, challenge}` through the existing authenticated connection. The server checks the principal, complete lease identity, owning instance, generation and active lease before returning `{authorization}`. Errors include `UNAUTHENTICATED`, `LEASE_NOT_OWNED`, `LEASE_EXPIRED`, `GATEWAY_CHALLENGE_DENIED`. Example mock response: `{authorization: "test-only-not-a-real-grant"}`; mocks do not prove native source identity.

The authorization is sent only to that bootstrap Window at its exact origin, exchanged once in a same-origin POST body, and never put in URLs or logs. Each Desktop lease key owns a separate loopback gateway origin; the grant cannot authorize a different view. With cookies absent, HTTP needs same-origin Fetch Metadata plus exact Origin (when present) or exact gateway Referer, and a live grant bound to that lease. WS needs the exact per-view gateway Origin and the same live lease-bound grant. Closing/recovering/expiring a lease revokes its gateway and sockets; a different live view cannot keep it authorized. No application script or HTML is injected; application response bytes remain unchanged, only XFO and the named frame-ancestors are adjusted. Ordinary HTTP workspace bootstrap/authentication gates are unchanged. This is a candidate, not owner ACCEPTED.


**Q-47 BLOCKED / security RED:** The above Desktop data path is an experimental draft. A controlled port-reuse negative proves that a revoked view's old browser origin can be identical to a new view's origin and inherit its live grant (expected 403, actual 200). Per-view random ports are not a durable view identity. The native reciprocal handshake is proven, but full U2/security delivery is not established; do not merge/promote this draft. `tests/desktop-port-reuse.test.mjs` intentionally records this failing invariant. PM must decide a data-path identity mechanism within D-26 or obtain approval for any new trust boundary; this worker does not widen hostname, cookie, browser policy or application SDK/HTML boundaries.


## D27 Desktop 来源隔离（Q98 源码检查点，尚非完整验收）

固定 Desktop 下每个完整活 view 绑定独立192-bit随机 localhost 名，control/data 使用不同精确 Host，共用仅127.0.0.1的监听端口；端口复用不会复用完整origin。process生命周期内登记名不回收，随机碰撞拒绝。control仅服务受控bootstrap/单次exchange，不转发应用；data拒绝控制路径。公开connection认证及精确dsh-app://app与Window/source双向握手仍先于授权；兑换后的data首次导航仅一次且核对精确control Referer、iframe/navigate/cross-site及完整活view。后续data请求/WS只核对精确data来源、活lease及generation，撤销立即拒绝并关闭旧通路。localhost名非凭据，授权仍不进URL/日志；应用正文不改，HTTP工作区原门不变。

Q98新增来源/端口复用定位测试不代替最终包、第三方cookie禁用、并存profile/客户端、强杀/恢复及完整真实U2；当前保持PARTIAL，不能解锁workspace或宣称ACCEPTED。
