# rc.24 · 模型随路由（2026-09-21，本机真实 DSH）

真实 DSH 0.1.5-alpha.1（桌面壳随包 runtime）+ 隔离 profile + `router.codingOauth.mode: file` 网关（模型列表 spark/5.4/5.5/5.6-sol）：
路由表「模型」列 = 下拉（应用默认（gpt-5.5）+ 网关模型）；选 gpt-5.5 → 行变「手动指定」、plan.model=gpt-5.5；`POST /hanamesh/router/model` 设 gpt-5.6-sol / '' 各自生效。截图 `routing-table-model-column.png`。
附带发现（壳侧，非本仓）：桌面壳 `--patch` 覆盖 app-host 整个 config，profile `cordis.patch.yml` 里的 `router` 段落会被吃掉；用户实机用 http 模式不受影响。
