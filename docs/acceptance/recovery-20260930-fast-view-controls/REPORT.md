# APPHOST35 · P01-U02/P08 视图按钮延迟修复

状态：SOURCE + PACKAGE 候选；真实产品组合与独立 REAL_UI 验证待父组合执行，用户 ACCEPTED 未给。

实际消费者：HanaMesh 桌面市场内的 Vibe Trading 视图，计划固定 CORE37 / USAGE9 / APPHOST35 / VIBE30。仅改 `hanamesh-plugin-app-host` 原 origin 的 guardian 与市场客户端。无新 dependency、配置、端口或应用包改动。

## 故障与修复

- 用户隔离真实入口 APPHOST34/VIBE29：最后视图关闭到 `instance.stopped` 约 5.05 秒。50ms 进程采样中，Vibe 应用 PID 在 `stopping` 后约 0.16 秒已退出，宿主约 5 秒后才持久化 stopped。真实重开到 ready 约 3.2 秒，期间「打开」按钮无反馈。
- launcher 故意不响应 SIGTERM 以锚定精确自有进程组；旧 guardian 却只等待 launcher 的 `close` 或完整 5 秒 stopGraceMs。正常应用已退出仍会消耗宽限期。
- guardian 在 launcher 发出可信 `app-exit` 后提前结束 TERM 等待，再 SIGKILL 仍在场的**原自有进程组**并确认整组退出，之后才释放锁、通知 stopped。应用不退出仍等声明的 stopGraceMs；失败仍保留锁。
- 现有按钮在请求期间立即显示并禁用「打开中…」「关闭中…」，完成或报错后恢复；未改布局或应用供应商选择。

## 本机可复核证据

| 门 | 结果 |
|---|---|
| TDD AH-L11 真进程+抗 TERM 后代，stopGraceMs=5000 | 旧实现 RED：关闭 5061ms；新实现 GREEN：479–522ms，`stopped`、应用与后代 PID 退出、立即再次打开 ready |
| TDD AH-UI15/16 | 旧实现两项 RED；新实现打开/关闭请求挂起时按钮即时变文案且 disabled，结束后正常渲染 |
| 相关生命周期回归 | 17/17 PASS，包含 late Open、heartbeat、关闭失败重试及重叠关闭 |
| `npm run check` | build、X01 4 groups/4 boundaries、155 tests: 152 pass / 0 fail / 3 skip；22/22 真实源码变异 DETECTED |
| `npm run test:types` | PASS |
| `npm pack --pack-destination artifacts --json` | PASS，82 文件，`hanamesh-dsh-app-host-0.1.0-rc.35.tgz` SHA256 `3a4f272385edcc32bfc7d24066b5f51e345bce5d2d7940bab782fb1c5b46591a` |
| 干净临时工程、只装 tgz 的 `scripts/verify-package.mjs` | PASS：真实受管 PID 写数据、`.`/`./client` 从安装包导入，0 源码树 import；`./dsh` 仍需固定 DSH peers，在真实 profile 门另验 |

3 个 skip 是现有独立 Chromium 不可用的 2 个浏览器用例与 1 个显式跳过的默认 90 秒长留用例；不能用上述 SOURCE/PACKAGE 门代替完整产品验证。此报告不声称长时客户端间歇无响应、真实 Provider 回复、真实积分或重启恢复已闭合。
