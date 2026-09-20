# rc.16 · 用户真实桌面 + 线上目录源（2026-09-20）

- 环境：用户本机 dsh-tauri 0.15.5（DSH 0.1.5-rc.2），profile `tauri`，core rc.14 / usage rc.5 / app-host rc.16 由本机私有 registry 按名安装。
- 来源：`POST /hanamesh/library/sources` → `https://market.hanamesh.com/catalog-source.json`（O2 生产，12,121 条）。
- 结果：`GET /hanamesh/library`（默认 `category=hanamesh-app`）→ 1 条 `@hanamesh/app-vibe-trading`，`application:true`，未安装；`?q=vibe&category=` → 22 条含它。真实 UI（`tauri-library-live.png`）：搜索框、「只看应用」、Vibe 卡片带「安装」。
- 未做：点击「安装」在用户桌面会报 `LIBRARY_INSTALL_UNAVAILABLE`（需壳注入 `profileDir/nodeBinary/dshBin/profileName`，归 O4 阶段 1）；目录里 Vibe 条目 `latestVersion 0.0.0`、无 publisher 是 O2 静态源 `sources/hanamesh.json` 缺字段（记 O2）。
