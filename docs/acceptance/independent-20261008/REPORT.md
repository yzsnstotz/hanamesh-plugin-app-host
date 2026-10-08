# P06-APPHOST-INSTALL-TARGET-01 · REPORT

结果：**PARTIAL · NEW_INDEPENDENT_OFFICIAL_DSH_RUNNING / UI_FIRST_STEP_NOT_ESTABLISHED**。本轮已建立全新独立官方DSH运行环境，真实正常安装已签AppHost rc8；首次内置浏览器导航返回 `net::ERR_BLOCKED_BY_CLIENT`，首步截图0，未重试/换浏览器/绕过。另有localhost API HOST_DENIED拒绝的发布合约前件，见下。NOT_TO_TEST / NOT_ACCEPTED。原rc7、旧窗口PARTIAL、WITHDRAWN清单保持。

## 改动与独立运行

唯一工程origin `hanamesh-plugin-app-host`；业务源码/协议/包版本未改。源分支 `codex/p06-apphost-independent-20261008t090117z` 从已签 `d8121a7ac1f437f37a0e52d46dd95fe08b13f15d` 建立，源码仅新增本轮接受前证据；没有重发rc8、覆盖tag或制造rc9候选。无新product dependency/peer/vendor/config字段，不改Desktop/Core/Usage/WEB或宿主。

使用 Node24.13.1、pnpm10.33.0，官方 `@deepseek-ai/dsh@0.2.0-rc.2`（MIT，[官方源](https://github.com/deepseek-ai/deepseek-harness)）。官方CLI装在本run toolchain；全新 `HOME=/Users/yzliu/.cache/hanamesh-runs/P06-APPHOST-INSTALL-TARGET-01/independent-20261008T090117Z/home`、`DSH_HOME=/Users/yzliu/.cache/hanamesh-runs/P06-APPHOST-INSTALL-TARGET-01/independent-20261008T090117Z/dsh-home`，全新 `profiles/web`。正常命令：官方 `lib/bin.js plugin --profile web add --save-exact <已签rc8.tgz>`，exit0。profile初始dependencies只有 `@hanamesh/dsh-app-host`，bundles只有官方base/web与本插件；Core、Usage及dsh-notify均未安装。包安装时peer未在profile内单独安装有正常pnpm提示；官方profile启动及真实路由已成功，本轮没有自造peer桥或改宿主。

运行命令：官方 `lib/bin.js web --host 127.0.0.1 --port 0 --no-open --trusted-host localhost`。实际OS端口 **49228**；PID **68995**、PPID1，脱离工具会话常驻，CPU读回0.0%。配置仅正常profile用户patch设置既有 `library.fixture`，dataRoot/安装profile/DSH bin/Node按自身实际位置的既有公开规则解析。不猜cwd/PATH/个人profile，不动~/.dsh、3080、研究runtime或其他运行实例。

**试用入口尚未交成**。真实服务候选地址为 `http://127.0.0.1:49228/` 与 `http://localhost:49228/`；公开干净URL未带cookie时按官方认证返回401，正常官方token交换后重定向到干净URL返回200。私有启动URL/token仅0600本run文件中保留，未打印/写报告/提交。没有新USER_CHECKLIST或LAUNCH登记，不能把候选地址当owner已可操作入口。

## 供给与合约一致性

- 精确业务包：`@hanamesh/dsh-app-host@0.2.0-rc.8`；发布tag `v0.2.0-rc.8` → `d8121a7ac1f437f37a0e52d46dd95fe08b13f15d`。
- 直接使用已签 `CONTRACT-APPHOST-INSTALL-01/release/out/hanamesh-dsh-app-host-0.2.0-rc.8.tgz`，171721字节，SHA256 `e06df1a821d1e9fd67ea246a13e5c87b2ca5eff08e8228b0105e79781b6a3706`。安装后 **92/92包文件byte-equal**。未新pack、未公开发布。
- **合约一致性：@hanamesh/dsh-app-host v0.2.0-rc.8 通过**。运行已实际安装发布包 `dist/install-target/run.js provider`，同源导出 `@hanamesh/dsh-app-host/install-target/suite`；47 total/47 pass/0 fail/0 skip。这是本功能对发布源suite的自测（SOURCE/FIXTURE），不是重做合约writer发布或产品UI。
- 源工作树基线：build exit0；npm test 182 tests/179 pass/0 fail/3既有skip。没有业务源修改，未扩测mutation/类型/新打包矩阵；不以这些闭合UI门。

## 目录fixture与真实安装边界

使用已签发布包导出 `./install-target/fixtures/catalog.json` 的三项原始fixture，运行时派生页只增加一项「测试目录 · dsh-notify（公开真实包）」；保留原条目、源hash和派生hash。非生产目录，确认四字段的来源会显示「测试目录（fixture）」；现客户端既有文本不改。未留vendor合约副本或修改源fixture。

公开目标 npm metadata 本轮读回 `dsh-notify@0.1.7`、MIT、[来源](https://github.com/Pasumao/dsh-plugin-notify)；这里只作为测试目录中的真实可分发安装目标，还未安装、执行或宣称其业务可用。AppHost/DSH原安装器、事件、实际profile读回与鉴权原封未替换；没有fake installer或假成功。

## 本轮实际证据

| 证据 | 结果 | 边界 |
|---|---|---|
| REAL_RUNTIME · 正常官方profile安装AppHost | rc8已安装，92/92字节一致；常驻PID68995 | 初始业务仅本插件，未安装目标 |
| REAL_RUNTIME_HTTP_DIAGNOSTIC · 官方认证/root | 127/localhost正常token交换cookie后均200；带参数root均200；未认证root401 | 只诊断，不代浏览器首步 |
| REAL_RUNTIME_HTTP_DIAGNOSTIC · 127目标解析 | 200，contractVersion1，dsh-notify/0.1.7/测试displayName/source.kind fixture | 没有POST install，安装请求0 |
| REAL_RUNTIME_HTTP_DIAGNOSTIC · 鉴权拒绝 | 127未认证target401 | 保持认证边界，不代可见授权失败操作 |
| 浏览器首步 | CUA createBrowserTab iab → `net::ERR_BLOCKED_BY_CLIENT` | 导航尝试1，截图0；没有看到市场或输入，不把HTTP当首步 |
| localhost目标接口 | 已认证仍403 HOST_DENIED，未认证也403 | 不声称localhost功能路径可用 |

GUI锁已正常ACQUIRED→RELEASED；未守窗口、换profile重演旧输入或再试浏览器。实际常驻日志末行：`dsh web: http://127.0.0.1:49228/?token=[REDACTED]`。没有正在等待的安装任务；CPU0.0%。内置浏览器错误原因未知，不从它推出AppHost/DSH源码bug，也不笼统宣称安全审查已拒绝本源码。

## 合约变更请求 / 接续前件

1. **合法可操作的浏览器入口**：内置浏览器本次导航被客户端阻止；首步尚未成立。不得换工具/放宽管理员策略来绕过。PM需明确允许且可操作的公共浏览器路径，再由原功能worker走首步。
2. **同一独立DSH的回环别名**：localhost页面经过官方真实认证可200，但AppHost `/hanamesh/library/target` 返回403。已定位 `src/library/routes.js:10` 固定比较 `req.headers.host === new URL(parentOrigin).host`，`src/dsh.js:118` 当前default parentOrigin为127地址；还存在同类Origin/CSRF和其他AppHost路由边界。当前已签版本仅允许单一parentOrigin，卡要求127/localhost完整可开有缺口。请求PM按提供方合约机制明确同实例同端口127/localhost的授权语义，并在源tag/suite覆盖后让本功能消费；仍保持未知host/port、跨Origin、iframe、CSRF、真实DSH认证拒绝。不能只改overlay把parentOrigin换成localhost而让127失败，也不改DSH/邻仓。

## 未跑的产品门与完成判据

市场可见首步、itemId/packageName真实可见输入、四字段可见确认、明确确认→安装/事件/实际已装读回→打开、取消/无效/缺目录/授权失败/安装失败可见结果，以及真正共享操作/失败回滚：**本轮REAL_UI全部NOT_RUN**。原rc7历史证据仍以原版本/原环境封存，不用来补新独立门。来源suite中的fixture通过不代这些门。

无owner账号、OTP/sudo/资金待办，owner工程动作0。没有新TO_TEST/ACCEPTED。下一步等上述公共前件，原writer保持单源接续，不接WEB。

## 证据、git与构建清理

原始run：`/Users/yzliu/.cache/hanamesh-runs/P06-APPHOST-INSTALL-TARGET-01/independent-20261008T090117Z`；公开收据在 `evidence/`，凭据URL/raw日志在0600私有文件，未复制进git。此前shared自己的REPORT/BLOCKED原件先保存在PREVIOUS-*并记录SHA，不删旧截图/rc7/撤回清单。源码独立分支与docs独立分支正常commit/push，实际sha/remote/工作树干净见本run `GIT-DELIVERY.json` 和PM通知；shared其他dirty不stage、不声明全仓干净。

构建清理：删除0；本轮无新候选/tgz，只有当前基线build和当前运行DSH所需安装/锁文件。保留活动toolchain/profile、合约fixture派生配置、当前source与本轮证据供接续；未清卡外、旧拒绝probe、rc7/rc8供给或历史PARTIAL。未生成被替代安装包。
