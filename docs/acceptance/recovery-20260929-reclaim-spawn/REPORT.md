# APPHOST rc33 回收/启动阶段有限修复（2026-09-29）

## 有限范围与复现

- 唯一 origin：hanamesh-plugin-app-host / `@hanamesh/dsh-app-host`。base rc32 `335591d9ea01097b1830db899b8e99d5be681d25`；独立 worktree `branches/apphost-lifecycle/worktree`，branch `codex/apphost-reclaim-lifecycle`。原 main不动，remote已公开（没有public push授权），不push/tag/publish。
- 产品消费者 P01-M02/M06、P08-U03；APPHOST owned生命周期 → MAC-COMPOSE，父本机有限修复计划 SHA256 `bb066b5eaacb59ae214e47d578c2f47c400ff7310b9698df4f797646d1f529b5`。不是整包runner。
- 父 fresh REAL_UI/REAL_DB观察：CORE34/USAGE9/APPHOST32，Vibe卸载重装与重启后原入口Open重复~5s TIMEOUT。已去敏原证据 `p04-acceptance/validator-evidence/v3-open-timeout-*`；现场profile进程/锁/DB由validator/父持有，本分支未操作。
- 隔离 RED：只自建临时数据根，dead owner的runtime lock记录可证明自有launcher孤儿；等待真实ORPHAN_READY信号处理器握手之后回收，SIGTERM被明确忽略。原spawnOwned于5007ms TIMEOUT，orphanAlive=true、旧lock id不变（raw/reclaim-spawn-red.tap）。不是fixture误早杀/僵尸误判，数据用真实processIdentity证明。
- 根因：guardian先FileLock.acquire，里面先declared stopGrace5000，再SIGKILL/确认最多2000，之后才launcher/app handshake；父spawned的5000预算却从spawn guardian开始，提前stop guardian，其child尚未创建，旧孤儿回收被打断。下次重试又走相同旧锁。

## 最小修复

- guardian只在FileLock.acquire成功且未取消后发内部ownership-ready。
- runtime先race ownershipReady与spawned，预算严格为已有bootstrap/probe5000 + declared stopGraceMs + 既有kill-confirm2000。spawn error/guardian exit立即reject同一个spawned promise，race已观察其拒绝；不会留下unhandled rejection。
- ownership-ready后才使用独立既有5000 launcher/app握手限时。超时仍TIMEOUT/504，其他原错误保持，不新增配置或公开返回字段。
- FileLock安全判断、PID start token/executable证明、unknown/PID reuse拒绝逻辑未改；不接管应用决定或VIBE/CORE/USAGE/PROVISION。没有新deps/peer/UI/schema。
- 元数据APPHOST33；原package-lock root版本rc28滞后，仅两个root version同步rc33，依赖闭包不变。dist runtime/guardian生成产物字节匹配source。

## 本次实际验证

Node24.13.1 macOS arm64；现有TypeScript5.8.3（本仓lock未改），隔离npmcache；所有实际进程门env whitelist HOME/DSH_HOME/PATH/TMPDIR，无继承凭据/模型调用。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 原RED真实自有孤儿 | ERR_ASSERTION（TIMEOUT5007ms/仍活/旧锁） | raw/reclaim-spawn-red.tap |
| 固定回收真实进程 | PASS，5121ms新应用启动，旧孤儿退出、锁新owner | raw/reclaim-spawn-green.tap |
| 阶段回归 | 7/7 PASS；hung ownership按7050预算终止；hung handshake按5000终止；error/exit在before/after均<2s | raw/reclaim-stages.tap |
| 更精确owner/应用annotate断言 | PASS；锁owner===new exact guardian，children含new app PID | raw/reclaim-exact-owner-green.tap |
| build | PASS，self-contained ESM/types/vendor provision | raw/build.log |
| consistency | 4groups/4boundaries PASS | raw/consistency.log |
| 全tests含real SIGKILL/unknown/PID reuse/真实DSH服务栈 | 137tests：135PASS/0fail/2明确skip（isolated Chromium absent） | raw/tests.tap |
| source mutations | 18/18 DETECTED，包括M18旧回收争用spawn预算；新mutant为ERR_ASSERTION | raw/mutations.log；raw/M18-*.tap；完整TAP分支外raw/mutations |
| publicconsumer types | PASS strict NodeNext | raw/types.log |
| 离源码离线tgz安装及真实owned app/data | PASS，应用真实写文件/运行，exports '.'/'./client'；DSH入口peer缺失拒绝符合既有包门 | raw/package-verify.log |
| tar内容/deps/peers/vendor与base校验 | PASS，dist===source、无依赖变化、PROVISION1逐字节不变 | 本机断言 |
| diff --check | PASS | 本机命令 |

父独立review已Node24复跑7/7阶段门PASS，来源父 `root-review-reclaim-spawn-node24.tap`；这不代替完整产品UI。

## 产物与剩余门

`artifacts/hanamesh-dsh-app-host-0.1.0-rc.33.tgz` SHA256 `0d67b7ec8bd2dcb9391cc2e1233048748e6712cd8942dbcbc9449df049bcc946`。产物同时保存在分支根，rc32没有重封。真实profile应随后组合CORE35/USAGE9/APPHOST33/PROVISION1。

READY_FOR_CHECKPOINT。本分支证据是SOURCE/FIXTURE_STAGE_GUARDIAN/REAL_PROCESS_ISOLATED/真实DSH服务栈；完整真实产品UI、Vibe/provider、真实重启恢复NOT_RUN由不同validator从最终入口重跑。现场orphan/locks保留归父；没有触碰~/.dsh、3080、研究runtime、生产凭据/DB或被测Codex。STATUS和最终产品判定归父，ACCEPTED只由用户给。

| 平台 | 本次门 | 产品REAL_UI |
| --- | --- | --- |
| macOS arm64 Node24 | 上述独立进程门PASS | NOT_RUN（父validator） |
| macOS x64 / Linux x64 | NOT_RUN（本机无机器） | NOT_RUN |
| Windows x64 | NOT_RUN，既有owned拒绝不改 | NOT_RUN |
| Linux/Windows arm64 | 既有unsupported边界不改 | NOT_RUN |
