# HanaMesh 市场（原应用库）

> rc.28：入口改名「市场」，插件与应用同一入口、同一 `dsh plugin add/remove` 路径；已装列表含插件；可升级 / 需重启；新路由与响应形状见 `CONTRACT.md`「市场」。下文旧称「应用库」的段落仍然成立。

## 范围

应用库是 app-host 自带的 DSH 页面，不依赖第三方市场。它读取一个启用的目录源，同时独立扫描当前 profile 已安装的应用包；由 Community Market 安装的同一包会被接管，不做宿主市场探测。

## 目录源

- `library.fixture` 只用于受控验收；内容必须符合 `schemas/catalog-provider-page.schema.json`。
- `library.sources` **未配置**时默认为 HanaMesh 目录源 `https://market.hanamesh.com/catalog-source.json`（rc.26；显式 `[]` = 不要来源）；可有多项，但浏览时必须恰好启用一项。远端 manifest 只接受标准端口 HTTPS、无凭据/query/fragment；endpoint 必须同源。
- 请求固定 `Accept: application/json` 与 `Accept-Encoding: identity`；最多三次同源跳转，拒绝压缩响应与超过 2 MiB 的响应。
- `categories` 含 `hanamesh-app` 且 `package.registry` 为 `npm` 的条目是应用（安装后读 `app.json`、供给 runtime）；其它 `package.registry` 为 `npm` 的条目是插件（rc.28 起同样可装卸，只跑 `dsh plugin add/remove`）；无 npm 包的条目（repository-only）只展示。

## Profile 与安装

钉版本 DSH 没有向插件公开 profile 目录或 profile 名。桌面壳通过 overlay 显式给出 `library.profileDir`（绝对路径）、`library.profileName`、`library.dshBin` 与 `nodeBinary`，显式值永远优先。**纯 DSH CLI profile（rc.26）** 下缺省值按 `CONTRACT.md`「应用库配置」推断：`profileDir` 来自本包自身真实安装位置所属的 profile、`profileName` 为其目录名、`dshBin` 只取启动本进程的 `@deepseek-ai/dsh/lib/bin.js`、`nodeBinary` 只在非 Electron 进程取 `process.execPath`。Electron 下仍必须由 dsh-runtime/core 提供绝对 `nodeBinary`；应用库不会在 Electron 里回退到 `process.execPath`。

安装先向 registry 的 `latest` 端点复核精确稳定版本，再用显式 Node 执行 DSH 自己的 `bin.js plugin --profile <name> add --save-exact <package>@<version>`。成功后读取包内 `app.json`；如果描述符声明 runtime，则调用随包内联的锁定 `@hanamesh/lib-provision@0.1.0-rc.1`。生产默认拒绝 prerelease；隔离 Verdaccio 验收可显式设 `allowPrerelease: true`。

安装/卸载完成只返回 `restart-required`，绝不静默重启 DSH。卸载只删除包与 lib-provision 账本认领的 runtime 文件，保留 `<dataRoot>` 下应用数据；彻底删除需用户手动处理对应数据目录。

## 状态与路由

已安装应用扫描给出 `registered`、`installed-not-loaded`、`runtime-missing` 或 `invalid`；已安装插件扫描（rc.28）给出 `installed`、`installed-not-loaded`、`uninstalled-not-unloaded` 或 `invalid`。浏览器路由为 `/hanamesh/library`、`/hanamesh/library/sources`、`/hanamesh/library/install`、`/hanamesh/library/provision`、`/hanamesh/library/uninstall`、`/hanamesh/library/events`、`/hanamesh/library/installedPlugins`、`/hanamesh/library/plugins/install` 和 `/hanamesh/library/plugins/uninstall`，全部复用 app-host 的 Host/Origin/iframe/auth/CSRF 防护链。

应用打开仍只走 app-host 的视图租约 API；页面只保存临时 receipt，不拥有第二份实例状态。

## 锁定产物

私有依赖同时保留精确 peer 与 `file:vendor/` 开发依赖。build 从 vendor tgz 提取 `lib/**` 到 `dist/provision/`，并带入 notices 与 `LICENSE` 标记；来源和 SHA-256 记录在 `docs/PROVENANCE.json`。


## rc.16 · 浏览语义（2026-09-20 线上目录门后定）

- `GET /hanamesh/library?q=&category=&cursor=`：`category` 缺省为 `hanamesh-app`（本页是**应用库**，只列应用条目）；显式 `category=`（空）列出来源的全部条目；`q` 与 `cursor` 原样透传给目录源的 `/v1/plugins`（`limit=50`）。未知参数 → `UNKNOWN_FIELDS`。
- 客户端：搜索框（回车/「搜索」）、「只看应用」开关（默认开）、「更多」按 `page.nextCursor` 追加。
- 背景：真实来源 `market.hanamesh.com` 有 12,121 条，rc.15 之前只显示按更新时间排序的前 50 条且无搜索，应用条目实际不可达。

## rc.28 · 市场浏览语义

- 市场页默认 `category=`（全部）；筛选：全部 / 应用（`hanamesh-app`）/ 插件（客户端视图：本页非应用的 npm 条目）/ 目录页里出现过的类别（累积自 `categories`）。路由 `/hanamesh/library` 的缺省 `category=hanamesh-app` 不变（向后兼容）。
- 卡片：`kind · 发布者 · latestVersion · 类别`；已装行显示状态与版本；「升级到 x.y.z」出现在 `upgradeAvailable` 时；插件「卸载」走 `plugins/uninstall`。页面底部「已安装」列出应用与插件（含 bundle 未启用为 profile 层的提示）。
- 「需重启 DSH」横幅：任一装卸操作完成后，或列表 `restartRequired` 为真时显示；壳内为 `hanamesh://restart` 链接，官方 DSH 直开为文字提示。
