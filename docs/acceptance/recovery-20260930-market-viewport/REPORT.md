# APPHOST39 · 原生 Market 应用视图修复

2026-09-30。缺陷所属 origin：`hanamesh-plugin-app-host`；实际消费者：HanaMesh Mac 客户端 rc.19 的 `Extension Management → Market` 席位，使用 `@hanamesh/app-vibe-trading` rc.34 / HKUDS Vibe-Trading 0.1.15。组合节点：P01 U02/U05、P08 会话入口。原版 Vibe 应用及其 runtime 归档均未改。

原生 Settings 中的 Market 内容栏只有约 740 CSS px，令原版 Vibe 的 Sessions 导航落入小屏隐藏分支。rc.37/38 尝试把视图投到 `shell.overlay`，真实 WKWebView 里被 DSH Settings 固定层遮住，两版均判 `REAL_UI FAIL`。rc.39 保留 Market owner、原 iframe、视图租约与 `/apps/close` 路径，仅把拥有中的应用帧固定铺满原生窗口并置于 Settings 之上。关闭后仍返回 Market。

源测试：`npm test` 157 项中 154 PASS、3 既有 SKIP、0 FAIL；`npm run build`、`npm run test:types`、`npm run check:consistency`、`git diff --check` PASS；`npm run test:mutation` 22/22 检出。新增 AH-UI17 验证 Market 中打开 iframe、关闭动作只提交一个精确租约及返回目录。包 `artifacts/hanamesh-dsh-app-host-0.1.0-rc.39.tgz` SHA-256 `c6b829371db4367f108849f9d2d0e4a67294aebb7c80514b80cc61bc95d75321`，只发本机私有 registry。

父任务在隔离 `DSH_HOME`、原生 `/Applications/HanaMesh.app`、端口 34580 的同一 profile 中装入 CORE41/USAGE9/APPHOST39/VIBE34。真实 Market 打开后，Vibe 全屏呈现，AX 和截图均能看到 Sessions 与此前中文模型回复；`关闭视图` 后 Market 返回约 1.25 秒，重开约 1 秒。`⌘Q` 冷启动后同设备绑定、同意、安装、积分与旧会话可读。此处仅记录父任务的 `REAL_UI` 首轮，最终产品结论由不同 validator 的独立报告及 `STATUS.md` 决定；额外 Codex 模型调用为 0。

边界：普通 1280×840 窗口的 Sessions 区域靠近底部，最大化后两条旧会话清楚可见；这一可用性限制需要写入产品验收清单。公共 npm 分发、P08 全功能和其它平台没有因本修复而通过。
