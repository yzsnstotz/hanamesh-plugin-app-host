# APPHOST34 客户端视图租约修复

2026-09-29；唯一 origin `hanamesh-plugin-app-host`。有限切片见 SLICE.json：base rc33 `3b1db62249077c87b5f800bd1c84b80c07914e47`；P01-M02/M06、P08-U01/U03；实际消费者 LibraryOverlay / market 应用 iframe→MAC-COMPOSE。父计划 SHA `bb066b5eaacb59ae214e47d578c2f47c400ff7310b9698df4f797646d1f529b5`；不是整包 runner。canonical main335591d9未动，现有 PUBLIC origin未push/tag/publish。

## REAL_UI 根因与有限修复

父真实 final CORE35/USAGE9/APPHOST33/VIBE28，原入口打开 gateway64356正常，停留后 view.expired1790671227898→stoprequested7909→stopped1232949；expiresAt1218928、createdAt1123781；owned端口全部退出，再点Runtime出现模块脚本导入失败。独立validator在另一隔离profile138.28秒停留重现相同expired/模块导入失败/端口gone。父去敏持久事实原件复制 raw/ROOT_IDLE_HOLD_FAIL.json；validator原证据位于父 p04-acceptance/validator-evidence/v4-idle-*。本writer没有操作该profile/锁/DB/原生进程。

SOURCE证实 manager已有default leaseTtlMs90000、sweep15000，CONTRACT已有按TTL约1/3周期 POST /apps/heartbeat；内置market客户端只setReceipt/close，根本没有消费heartbeat。服务端按契约正常最终回收，缺陷归APPHOST自身客户端。

仅 src/client-ui.js/private holdViewLease 与生成 dist/client-ui.js 变更：按当前receipt expiresAt安排串行renew；只发送viewId/current leaseToken；返回expiresAt决定下轮；不增加引用、不旋转token、不匿名Open/resume。视图关闭/隐藏/卸载/pagehide清timer、abort在途HB并显式close，late响应不继续安排。cleanup为best effort且catch拒绝；最终断连仍靠原TTL回收。显式close失败允许后续用户重试，成功/并发close共享task，closing不恢复renew。迟到Open/resume回执遇hidden/unmounted/旧surfaceEpoch，精确close当前回执，不setState/继续poll/重开。

无新配置/dependency/peer/UI元素；manager、TTL/sweep、guardian/runtime/provider、应用描述符/供应商、PROVISION1全不变。package/lock根版本34、README/CONTRACT同步候选说明；公开HTTP/SDK/token语义不变。helper直接随现有src→dist构建打包，不存在仅源码遗漏。

## 本次门与证据

| 门 | 结果 | 原输出 |
|---|---|---|
| missing renew/cleanup TDD | 7项实际ERR_ASSERTION RED→GREEN | raw/client-red.tap / client-green.tap |
| close网络失败重试 / lateOpen隐藏卸载 / hide→reshow | 均先ERR_ASSERTION RED；最终14/14 PASS | raw/close-retry-red.tap / late-open-red.tap / surface-generation-red.tap / client-final-green.tap |
| default90s最终源码真实HTTP/owned进程 | PASS；95007ms保持；3真实HB，同实例、lease仍active、gateway200；close1后3个精确owned成员全退出 | raw/default90s-final-green.tap |
| build/publicconsumer types/consistency | PASS；Node24.13.1，原TS5.8.3，strict NodeNext；4groups/4boundaries | raw/build.log / types.log / consistency.log |
| 全现有tests +新回归 | 152tests：149PASS/0fail/3skip | raw/tests-final.tap |
| source mutation | 22/22 DETECTED，新增4个均ERR_ASSERTION；原18negative/SIGKILL安全门保留 | raw/mutations.log / mutations/results.json /各TAP |
| tarball与离源码离线安装/真实应用写数据 | PASS，原公开Zod4.5.4仅暖隔离cache；无sibling/source import | raw/package-verify.log |
| 范围及封包身份 | PASS；82文件，tar client===src===dist；依赖/peer不变，lock仅rootversion；runtime/guardian和PROVISION1字节不变 | raw/package-identity.json；git diff --check |

过程失败原样保留：real test fixture首次bootstrap没有既有父Referer/iframe头，403，不是产品失败；校正HTTP fixture后真实门通过（raw/default90s-fixture-bootstrap-failed.tap）。初次M22用hidden ready测试，备用hidden effect仍close而未杀死该mutant（raw/mutations-initial.log、M22-hidden-fallback-not-killed.tap）；改用有真实RED的unmounted消费者负门后ERR_ASSERTION杀死，未放宽判据。mutation runner只改输出目录到本报告raw，避免覆盖历史证据；所有源突变及断言来自本仓原scripts/mutations.mjs。

独立SOURCE reviewer web_cards对同clientSHAe46cbba9复跑14lifecycle+5marketseat+4HTTPguard/owned-process，23/23 PASS；final tar封条由其随后独立比对。独立review不代替产品REAL_UI。

## 产物与未跑

`hanamesh-dsh-app-host-0.1.0-rc.34.tgz` SHA256 `49e7bd7d454ec9428d978d063990fe644e9634799199c20f386dbc37682c2273`；分支根与artifacts字节相同。client UI SHA256 `e46cbba9eaa43744edb3422aa2adbd8b64917d69495935384552838d49cba755`。PROVISION1 SHA `386d57361ccc3c8578f54cad8137acc291dd72e01b3ff987e65dfaa716f2e0b0`。

默认真实90s门标签 **REAL_PROCESS/REAL_HTTP + HOOK_STANDIN/LIBRARY_STANDIN**：使用真实APPHOST/HTTP/进程和原client模块；React生命周期是测试standin、目录是fixture，不能说真实产品UI PASS。fulltests3skip为Chromium真实浏览器2门与默认不启用HM_REAL_CLIENT_LEASE的95秒门；95秒门已上方另按env白名单单独完成。完整REAL_UI/REAL_RUNTIME/Vibe/provider/积分/重启产品门由different validator在父组合CORE36/USAGE9/APPHOST34/VIBE29后另跑。未调用被测Codex、凭据/生产DB，未碰~/.dsh/3080/研究runtime。

状态最高有限SOURCE/PACKAGE交付；最终产品STATUS由父维护；ACCEPTED仅用户给。
