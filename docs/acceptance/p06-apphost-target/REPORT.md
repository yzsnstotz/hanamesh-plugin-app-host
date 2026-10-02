# P06-APPHOST-01 · rc.44 组件门（2026-10-03）

范围：仅 `hanamesh-plugin-app-host`，从 P02 rc.43 HEAD `63f8065f9d26119b48d8c94c6b5695315cd2d742` 起。`0.1.0-rc.44` 包 SHA256 `ee09b92d76356d2126311519513167120bc9fddc652c0e3cf6e096f3eefdab5e`；固定回滚 rc.43 包 SHA256 `0867f969f023b281bd2bf2a1aa158c75dc8838cbbcb53f8bb63dfce2a66bffaf`。本卡仅本地 branch/commit/pack，没有 push、tag、publish、merge 或部署。P06 产品仍 `UNPROVEN`，不得写用户 `ACCEPTED`。

## 实现

- `GET/POST /hanamesh/library/target`、`POST /hanamesh/library/target/consume` 复用既有 Host、Origin、frame、CSRF、认证和授权栅栏；目标仅内存保留、后到覆盖、旧 ID 不能消费新目标。合法性先于本切片 200 字符搜索限制；不改原 `list(q)`、catalog 截断、安装和来源行为。
- 客户端挂载期间以 1 s 轮询、失败 5 s 退避；新目标清空类别并搜索包名，按 npm registry 与包名精确匹配高亮全部同名卡；有 cursor 但当前页未命中显示 `not-on-loaded-pages`，耗尽才显示 `missing`；状态呈现后消费，不自动安装。
- 保留 rc.43 `registrationId`、v2 应用包入口与生命周期实现。未增加 dependency、peer、随包 tgz 或配置键。

## 冻结门结果

| 门 | 判定 | 证据与边界 |
|---|---|---|
| T01–T03 | PASS | 单测与隔离 DSH HTTP：N200 接受，N201/N214 `TARGET_SEARCH_UNSUPPORTED` 且旧目标不变，N215/大写先得 `INVALID_INPUT`；N200 `list(q)` 不报 `INVALID_QUERY`。`raw/real-host-target.json`、`raw/tests.tap`。 |
| T04 | PARTIAL | 单测覆盖 Host/Origin/frame/CSRF、401 与授权 403；`--skip-auth` REAL_HOST 覆盖 Host/Origin/frame/CSRF 和 GET 外部 Origin；另以同一 rc.44 克隆在完整认证姿态、无 cookie 下得到 401 `UNAUTHENTICATED`。真实 DSH 仅提供一个浏览器主体，不能通过外部请求构造已认证但被本插件授权器拒绝的另一主体；该 403 仅由单位门证明。`raw/real-host-target.json`、`raw/real-host-full-auth.json`、`raw/tests.tap`。 |
| T05–T07 | PASS | REAL_HOST 旧 ID 消费返回 false、当前 ID 消费 true、重复 false；来源 JSON SHA 和事件序列前后一致；目标写入后重启读回 null。UNIT 另以 spy 证明目录 fetch、installer、domain 写入均为 0。`raw/real-host-target.json`、`raw/tests.tap`。 |
| T08 | PASS | 假时钟覆盖 1 s、失败 5 s、恢复 1 s、卸载清 timer。`raw/tests.tap`。 |
| T09–T10、T10b | PASS | Chrome 实 UI 在面板市场 `dsh-pet` 高亮 4 个精确 npm 同名条目；不存在包为 `missing`；现网 `dsh` 首页有 cursor 时为 `not-on-loaded-pages`，点击现有“更多”后仍不误称 `missing`。`protected`/`catalog-unavailable` 由单位门覆盖。请求记录没有 install POST。UI 原件见下文。 |
| T11 | PASS（组合证据） | 单位门在现有 iframe/租约上交接目标后不发 `/apps/close`、不再次 open、iframe 仍在；REAL_HOST P02 v2 fixture 的 live view 在 POST target 前后均 ready，原 lease 仍 active；真实 Chrome 目标操作请求轨迹无 close/install。没有在 Chrome 里把 fixture iframe 作为市场卡打开，因该测试包不在目录。`raw/real-host-fixture.json`、`raw/tests.tap`。 |
| T12 | PASS | `docs/CONTRACT.md`、`docs/LIBRARY.md`、README 写明交接契约、200 限制、`--skip-auth`/完整认证 401、1 s/5 s、仅内存；consistency 4 groups/4 boundaries PASS。 |
| T13 | PASS（AppHost 局部门） | 独立 DSH 0.1.5-alpha.1 APFS clone，127.0.0.1:34974，回环 HTTP 模拟尚未实现的 DESKTOP 生产者（`SIMULATED_PRODUCER_LOCATING_ONLY`）。Chrome 分别观察 AppHost 持 `market` 席位的内嵌页、无 panel 的侧栏覆盖页、dshmarket@1.47.0 在场的侧栏覆盖页及“只能其一”提示；三态均 `found`/exact=4，另有 `missing` 和分页非 found，未自动安装。**源 clone 的 Core46 仍声明 AppHost rc41，设置页显示 `rc44 ≠ rc41`；此门不证明 Core46 完整消费者组合。** |
| T14 | PASS | Node 24.13.1：188 tests/185 pass/3 既有 skip/0 fail，build、types、consistency PASS；M01–M36 36/36 以 `ERR_ASSERTION` 被杀（M33–M36 是本卡新增）；干净 npm cache pack + 离线隔离装包烟测 PASS。`raw/` 日志及 `artifacts/*.tgz.sha256`。 |
| T15 | PASS | 同一隔离 profile 恢复固定 SHA 的 rc.43：target 路由 404（空体）、原市场 GET 200/50 条、Chrome 市场仍可见，P02 v2 fixture 仍注册。`raw/real-host-rollback.json`。 |
| T16 | PASS（AppHost 兼容门） | rc.43 v2 fixture `0.0.4`（peer 仍 rc.43）在 rc.44 真 DSH 中注册/open ready/close stopped；实时禁用应用条目后入口消失、实例 stopped，再启用后重新注册/open ready；事件 `duplicateSequences=0`，停机后 fixture runtime 进程 0。迟到旧 `registrationId` 不撤新注册和不误停另一应用由原 P02 回归单测/变异 M23–M32 守卫；不推断 Core46 已重钉 rc.44。`raw/real-host-fixture.json`、`raw/real-host-live-reload.json`、`raw/tests.tap`。 |

T04 的真实授权拒绝主体分支仍是 **PARTIAL**，所以本报告不把全部矩阵写作无条件 PASS；交 PM 独立审查决定是否补该门。AppHost 自身 HTTP/市场/回滚与 v2 消费者局部门已得到上述证据。

## 原始证据与隔离

- 本仓 `raw/tests.tap`、`raw/mutations.log`、`raw/build.log`、`raw/types.log`、`raw/consistency.log`、`raw/package-smoke.log`、`raw/pack.json`、`raw/sha256.txt` 和四个 `real-host-*.json`。
- Chrome DOM/请求 JSON 与 PNG 原件在 `/Users/yzliu/work/projects/hanamesh/_deliveries/p06-public-consumer-20261003/worker-real-host-rc44/`：`ui-found`、`ui-missing-or-page1`、`ui-not-on-loaded-pages`、`ui-after-more`、`ui-no-panel-clean`、`ui-dshmarket`；每组同名 `.json`/`.png`。
- `home` 是 P02 `u02pm` 的 APFS clone，并修正克隆中绝对/相对软链；`env -i`、独立 `HOME`/`DSH_HOME`/XDG/TMPDIR、随包 Node/DSH，Core 外部 origin 改指未监听的回环 34979。`34974` 真宿主与 `34975` 只读 registry 桩已停机；P05 `34815` 仍为原 PID 34526。没有使用 `~/.dsh`、3080 或研究 runtime。一次性启动 URL 未入报告/日志。
