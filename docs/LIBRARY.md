# HanaMesh 市场（原应用库）

> rc.28：入口改名「市场」，插件与应用同一入口、同一 `dsh plugin add/remove` 路径；已装列表含插件；可升级 / 需重启；新路由与响应形状见 `CONTRACT.md`「市场」。下文旧称「应用库」的段落仍然成立。

## 范围

应用库是 app-host 自带的 DSH 页面，不依赖第三方市场。它读取一个启用的目录源，同时独立扫描当前 profile 已安装的应用包；由 Community Market 安装的同一包会被接管，不做宿主市场探测。

## 目录源

- `library.fixture` 只用于受控验收；内容必须符合 `schemas/catalog-provider-page.schema.json`。
- `library.sources` **未配置**时默认为 HanaMesh 目录源 `https://market.hanamesh.com/catalog-source.json?view=hanamesh`（rc.26；显式 `[]` = 不要来源）；可有多项，但浏览时必须恰好启用一项。远端 manifest 只接受标准端口 HTTPS、无凭据/fragment，仅允许可选查询 view=hanamesh；endpoint 必须同源。新默认仅在初始 revision=0 且来源为空时播种，已保存旧来源、自定义来源和手动清空列表均不自动改写。
- 请求固定 `Accept: application/json` 与 `Accept-Encoding: identity`；最多三次同源跳转，拒绝压缩响应与超过 2 MiB 的响应。
- `categories` 含 `hanamesh-app` 且 `package.registry` 为 `npm` 的条目是应用（安装后读 `app.json`、供给 runtime）；其它 `package.registry` 为 `npm` 的条目是插件（rc.28 起同样可装卸，只跑 `dsh plugin add/remove`）；无 npm 包的条目（repository-only）只展示。

## Profile 与安装

钉版本 DSH 没有向插件公开 profile 目录或 profile 名。桌面壳通过 overlay 显式给出 `library.profileDir`（绝对路径）、`library.profileName`、`library.dshBin` 与 `nodeBinary`，显式值永远优先。**纯 DSH CLI profile（rc.26）** 下缺省值按 `CONTRACT.md`「应用库配置」推断：`profileDir` 来自本包自身真实安装位置所属的 profile、`profileName` 为其目录名、`dshBin` 只取启动本进程的 `@deepseek-ai/dsh/lib/bin.js`、`nodeBinary` 只在非 Electron 进程取 `process.execPath`。Electron 下仍必须由 dsh-runtime/core 提供绝对 `nodeBinary`；应用库不会在 Electron 里回退到 `process.execPath`。

安装先向 registry 的 `latest` 端点复核精确稳定版本，再用显式 Node 执行 DSH 自己的 `bin.js plugin --profile <name> add --save-exact <package>@<version>`。成功后读取包内 `app.json`；如果描述符声明 runtime，则调用随包内联的锁定 `@hanamesh/lib-provision@0.1.0-rc.3`。生产默认拒绝 prerelease；隔离 Verdaccio 验收可显式设 `allowPrerelease: true`。

rc.10：add 之后的读回、定义校验或 provision 失败按基线补偿（新装 `dsh plugin remove`、升级 `dsh plugin add` 原规格，runtime 按 ownership 回收或按原定义重供），逐项读回后在 `library.install-failed` 的 `recovery` 里报告 `not-needed`/`restored`/`failed`；详见 `INSTALL_TARGET.md`「安装失败后的恢复」。

安装/卸载完成只返回 `restart-required`，绝不静默重启 DSH。卸载只删除包与 lib-provision 账本认领的 runtime 文件，保留 `<dataRoot>` 下应用数据；彻底删除需用户手动处理对应数据目录。

## 状态与路由

已安装应用扫描给出 `registered`、`installed-not-loaded`、`runtime-missing` 或 `invalid`；已安装插件扫描（rc.28）给出 `installed`、`installed-not-loaded`、`uninstalled-not-unloaded` 或 `invalid`。浏览器路由为 `/hanamesh/library`、`/hanamesh/library/sources`、`/hanamesh/library/install`、`/hanamesh/library/provision`、`/hanamesh/library/uninstall`、`/hanamesh/library/events`、`/hanamesh/library/installedPlugins`、`/hanamesh/library/plugins/install` 和 `/hanamesh/library/plugins/uninstall`，全部复用 app-host 的 Host/Origin/iframe/auth/CSRF 防护链。

应用打开仍只走 app-host 的视图租约 API；页面只保存临时 receipt，不拥有第二份实例状态。

## 锁定产物

私有 `@hanamesh/lib-provision` 不作为 package dependency 或 peer。build 校验 vendor tgz 的 SHA-256 后提取 `lib/**` 到 `dist/provision/`，并带入 notices 与独立 `LICENSE` 声明；来源、SHA-256 与许可分区记录在 `docs/PROVENANCE.json`、`docs/LICENSES.json` 和根 `LICENSE`。


## rc.16 · 浏览语义（2026-09-20 线上目录门后定）

- `GET /hanamesh/library?q=&category=&cursor=`：`category` 缺省为 `hanamesh-app`（本页是**应用库**，只列应用条目）；显式 `category=`（空）列出来源的全部条目；`q` 与 `cursor` 原样透传给目录源的 `/v1/plugins`（`limit=50`）。未知参数 → `UNKNOWN_FIELDS`。
- 客户端：搜索框（回车/「搜索」）、「只看应用」开关（默认开）、「更多」按 `page.nextCursor` 追加。
- 背景：真实来源 `market.hanamesh.com` 有 12,121 条，rc.15 之前只显示按更新时间排序的前 50 条且无搜索，应用条目实际不可达。

## rc.28 · 市场浏览语义

- 市场页默认 `category=`（全部）；筛选：全部 / 应用（`hanamesh-app`）/ 插件（客户端视图：本页非应用的 npm 条目）/ 目录页里出现过的类别（累积自 `categories`）。路由 `/hanamesh/library` 的缺省 `category=hanamesh-app` 不变（向后兼容）。
- 卡片：`kind · 发布者 · latestVersion · 类别`；已装行显示状态与版本；「升级到 x.y.z」出现在 `upgradeAvailable` 时；插件「卸载」走 `plugins/uninstall`。页面底部「已安装」列出应用与插件（含 bundle 未启用为 profile 层的提示）。
- 「需重启 DSH」横幅：任一装卸操作完成后，或列表 `restartRequired` 为真时显示；壳内为 `hanamesh://restart` 链接，官方 DSH 直开为文字提示。

### 0.3.0 · catalog major compatibility

Catalog `manifestVersion` / `schemaVersion` accept valid SemVer with major 1, including additive minor/patch inputs; different majors and malformed versions remain refused. Schema field checks and HTTPS/same-origin controls remain enforced. Known optional additions (attribution notice / item updatedAt) are preserved; arbitrary unknown fields remain invalid. Install-target `contractVersion: "1"`, storage schema numbers and installed-package exact readback are distinct fields and retain their original grammar. This does not claim that a 0.x package caret includes every minor.

Both SOURCE fixture sets and suites ship as `@hanamesh/dsh-app-host/catalog/suite` (`runCatalogProviderSuite`, `runCatalogConsumerSuite`) with schema exports under `catalog/schema/`. The default consumer suite drives this package's actual catalog loader against labelled transport fixtures; it is not a live market or product acceptance gate. Version grammar follows [SemVer 2.0.0](https://semver.org/).

## HanaMesh 套件

市场只显示一张官方、不计分的「HanaMesh 套件」卡。其组件版本来自当前 profile 实际包与启用清单；Core、使用记录、应用库不再分别作为普通可安装卡。品牌插件只属于 HanaMesh 自有客户端。

DSH 首次安装或缺组件时，完全退出客户端后执行同一行，再重新打开：

```sh
dsh plugin --profile desktop add --save-exact 'github:yzsnstotz/hanamesh-core#main' 'github:yzsnstotz/hanamesh-usage#main' 'github:yzsnstotz/hanamesh-plugin-app-host#main'
```

套件版本范围、是否完整、候选来源及兼容/升级规则唯一属于 Core。App-host 只读物理安装版本，不能用它们推导兼容或安装许可；不自行读取 npm latest、计算组件组合、校验候选宿主 peers 或持有 Core 的版本范围副本。普通安装/卸载接口继续拒绝套件包。

当前消费者候选尚未接通生产 Core 声明：Core 公开方法与数据版本由 G 在 C-CORE 提供后，才在 DSH 入口适配。缺源时套件卡明确显示 **Core 未提供套件声明**，「检查兼容升级」不可点；直接查询升级目标返回503 `CORE_SUITE_DECLARATION_MISSING`，不回退到旧范围或 registry latest。无效执行计划返回 `CORE_SUITE_DECLARATION_INVALID`；内部回调错误向上传播且不回退；HTTP沿现有AppHostError/未知错误边界处理，真实适配需按C-CORE映射公开具名错误。真实已装版本和普通应用安装仍可展示/使用。

`createLibraryInstaller({coreSuitePlan})` 的可选回调是 **App-host 内部执行接线槽**，不是 Core 的方法名或 wire DTO，也不是浏览器/config 权限。将来的适配器必须只经已文档化的 Core 公开接口，返回既有 App-host 执行计划 `{available:boolean,components:[{name,label?,from,to}]}`。三项必须是固定套件包、`from/to` 必须是精确版本；这只是执行范围/格式检查，不是兼容规则。Core 决定 `available`，App-host 不重算。当前 `src/dsh.js` 没有绑定猜测的 Core getter，生产默认缺源；正向测试使用明确的端口替身，不能证明真实 Core 接通。

接通后仍须本人确认当前计划才执行一次官方 CLI；执行前重读 Core 计划及物理安装版本，改变/撤回即拒绝，不静默重试。安装后按精确 profile/module 版本读回，不以 Core 回执冒充实际安装结果。网站只能经允许名单交接此意图。

成功须读回三个精确保存的版本、实际解析版本与启用状态，随后完全退出并重新打开客户端。安装命令失败或读回不符时，界面显示实际组件状态、错误与同一行补齐命令；部分变更不冒充成功或未安装，不自动静默重试。
