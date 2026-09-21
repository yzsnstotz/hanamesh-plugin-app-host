# rc.19/rc.20 · 桌面壳（Tauri/WKWebView）里打开应用空白 —— 根因与证据

现象：HanaMesh 桌面 rc.4 应用库「打开」Vibe，iframe 空白；同一宿主在 Chrome 直开 DSH 页面（`http://127.0.0.1:34580`）正常。

在隔离 rc.5 壳的 profile 里给网关加请求头日志，WKWebView 真实到达的两个请求：

```
/__hanamesh_bootstrap/<ticket>  referer=http://127.0.0.1:34580/  cookie=no  sec-fetch-site=same-site  sec-fetch-dest=iframe
/                                referer=(无)                     cookie=no  sec-fetch-site=same-site  sec-fetch-dest=iframe
```

三条根因（缺一个仍然空白，逐个实测）：
1. **第三方 cookie 被丢**：应用 frame 相对壳顶层 `tauri://localhost` 是第三方，303 设的 `SameSite=Strict` 引导 cookie 不会回传 → rc.19 加 Fetch Metadata 授权（H15）。
2. **引导 303 的 `referrer-policy: no-referrer` 作用于跳转那一跳** → `/` 到达时没有 Referer，无 cookie 路径匹配不上 → rc.20 去掉该头（Referer 本来就是父文档，不含票据）。
3. **`frame-ancestors` 对所有祖先生效**：壳 → DSH → 应用三层，只写 DSH origin 时 webview 拒绝渲染已下发的文档 → rc.20 新增 `frameAncestors` 配置（H16），桌面壳 rc.5 overlay 写入 `tauri://localhost`（Windows `http://tauri.localhost`）。

验证：桌面 rc.5（随包 app-host rc.20 同形 dist）在隔离 HOME 下打开 Vibe，AX 树出现 `Good morning.` / `Balance a 3-stock portfolio` 等应用内容，截图 `hanamesh-desktop-tauri/docs/acceptance/recovery-20260921/tauri-vibe-open.png`。93/93（91 + 2 skip）、变异 8/8；Vibe AH-P07 REAL_RUNTIME 经该网关 PASS。
