# HanaMesh 市场（原应用库）

> rc.28：入口改名「市场」，插件与应用同一入口、同一 `dsh plugin add/remove` 路径；已装列表含插件；可升级 / 需重启；新路由与响应形状见 `CONTRACT.md`「市场」。下文旧称「应用库」的段落仍然成立。

## 范围

应用库是 app-host 自带的 DSH 页面，不依赖第三方市场。它读取一个启用的目录源，同时独立扫描当前 profile 已安装的应用包；由 Community Market 安装的同一包会被接管，不做宿主市场探测。

## 目录源

- `library.fixture` 只用于受控验收；内容必须符合 `schemas/catalog-provider-page.schema.json`。
- `library.sources` **未配置**时默认为 HanaMesh 目录源 `https://market.hanamesh.com/catalog-source.json?view=hanamesh`（rc.26；显式 `[]` = 不要来源）；可有多项，但浏览时必须恰好启用一项。目录 manifest 接受标准端口 HTTPS；本机回环 127.0.0.1、::1、localhost 另接受任意端口 HTTP（Node URL 解析后精确匹配主机名，安全上下文回环例外）。无凭据/fragment，仅允许可选查询 view=hanamesh；endpoint 和重定向必须保持完整同源（协议、主机、端口），不把主机别名互换。新默认仅在初始 revision=0 且来源为空时播种，已保存旧来源、自定义来源和手动清空列表均不自动改写。
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
- 「需重新打开客户端」横幅：任一装卸操作完成后，或列表 `restartRequired` 为真时显示；所有渠道均提示完全退出 HanaMesh 客户端或 DSH 后重新打开，关闭窗口不等于退出。不提供旧壳深链或 postMessage 重启桥；只有正式宿主重启 API 供给后才另行接入。

### 0.3.0 · catalog major compatibility

Catalog `manifestVersion` / `schemaVersion` accept valid SemVer with major 1, including additive minor/patch inputs; different majors and malformed versions remain refused. Schema field checks and HTTPS/same-origin controls remain enforced. Known optional additions (attribution notice / item updatedAt) are preserved; arbitrary unknown fields remain invalid. Install-target `contractVersion: "1"`, storage schema numbers and installed-package exact readback are distinct fields and retain their original grammar. This does not claim that a 0.x package caret includes every minor.

Both SOURCE fixture sets and suites ship as `@hanamesh/dsh-app-host/catalog/suite` (`runCatalogProviderSuite`, `runCatalogConsumerSuite`) with schema exports under `catalog/schema/`. The default consumer suite drives this package's actual catalog loader against labelled transport fixtures; it is not a live market or product acceptance gate. Version grammar follows [SemVer 2.0.0](https://semver.org/).

## HanaMesh 套件

市场只显示一张官方、不计分的「HanaMesh 套件」卡。完整性只显示 Core 的 `completeness`，同时展示 `installed` 的要求范围、实际版本、状态和 `blocked` 的具名原因；Core 缺席或读取失败时完整性为 unknown，并保留物理包版本供诊断。Core、使用记录、应用库不再分别作为普通可安装卡。品牌插件只属于 HanaMesh 自有客户端。

DSH 首次安装或缺组件时，完全退出客户端后执行同一行，再重新打开：

```sh
dsh plugin --profile desktop add --save-exact '@hanamesh/core@0.3.21' '@hanamesh/usage@0.3.0-rc.6' '@hanamesh/dsh-app-host@0.6.14'
```

套件版本范围、是否完整、候选来源及兼容/升级规则唯一属于 Core。App-host 只读物理安装版本，不能用它们推导兼容或安装许可；不自行读取 npm latest、计算组件组合、校验候选宿主 peers 或持有 Core 的版本范围副本。普通安装/卸载接口继续拒绝套件包。

DSH 入口通过既有 optional injection 监听 `hanameshCore` 出现/卸载，仅消费字符串 protocol `'1'` 的可选 `getSuiteDeclaration`（C-CORE D）。市场事实读取不传 request，不触发候选 registry 网络；查询升级时传入实际执行 `registry`。缺方法、旧 Core 或卸载后明确显示 **Core 未提供套件声明**，「检查兼容升级」不可点；直接查询升级目标返回503 `CORE_SUITE_DECLARATION_MISSING`，不回退 getHealth、内部 profile、旧范围或 registry latest。DTO 形状无效返回 `CORE_SUITE_DECLARATION_INVALID`；具名 Core 错误保持传播，事实读取失败为 unknown。

公开 adapter 仅检查 DTO/精确命令的形状与固定三包边界，不重算范围、Node、peer、来源或升级排序。默认展示 `upgrades` 的第一条组合，保留完整 `declarationId`、规范 registry、目标身份/来源/摘要/版本及物理基线；其他候选的 blocked 行不会否决这条 Core 已提供的有效组合。`completeness` 非 complete、来源不符或没有组合分别明确拒绝。`createLibraryInstaller({coreSuitePlan})` 仍是内部归一化执行测试接缝，不是公开 Core DTO、配置项或浏览器权限；替身测试不能证明真实 Core 包接通。

本人确认当前计划才执行一次官方 CLI；执行前重读并比较 declarationId、registry、选中组合和 Core 物理基线（checkedAt 不参与比较），再检查磁盘版本及启用清单；改变/撤回即拒绝，不静默重试。安装后按精确 profile/module 版本和启用状态读回，不以 Core 回执冒充实际安装结果。网站只能经允许名单交接此意图。

成功须读回三个精确保存的版本、实际解析版本与启用状态，随后完全退出并重新打开客户端。安装命令失败或读回不符时，界面显示实际组件状态、错误与同一行补齐命令；部分变更不冒充成功或未安装，不自动静默重试。

套件卡不把 Core 版本当作 agent 套件分发版本：`suite.version` 保持为 Core 实际版本，界面明确标为 Core，组件逐项显示。`unknown` 表示 Core 无法确认事实，不等于组件缺失。预览阶段被 Core 拒绝时说明尚未执行安装，保留具名 blocked 原因；已执行失败仍显示物理读回及修复步骤。网站四渠道面板和 Claude/Codex 安装状态不从 App-host 监听是否存在推断。

### 0.6.8 · HanaMesh 目录展示字段

HanaMesh 视图原样保留可选 `official:boolean`（包括 false）与 C-INDEXER-CATALOG 的 `SuitePresentationDTO`；suite 的角色、组件、版本事实及 GitHub 精确 ref 按公开形状逐层校验，未知字段和畸形字段仍拒绝。历史可选版本事实缺省时不补猜。旧 major-1 视图不增加这些字段。该展示信息不构成安装权限；兼容与升级仍只读取公开 Core 声明。

### 宿主主题（2026-10-21候选）

市场覆盖页、内嵌应用框、表单控件与状态提示消费正式 DSH ui-theme 的公开 `--dsw-alias-bg-layer-2`、`label-primary/secondary`、`border-l2`、`state-error/success/warn/business-*` token，不写白底黑字或新增全局色。主题值与切换仍归宿主；不修改客户端或覆盖其它插件。缺主题提供方时不能把本候选截图当正式宿主支持。


0.6.12：目录条目的展示/跳转链接（`sourceLinks.sourceUrl`、`homepage`、`repository.url`、`publisher.url`）接受 fragment 并原样保留；目录自身 attribution 展示链接亦保留 fragment。manifest 来源和 `transport.endpoint` 等请求 URL 校验不变。单条非法仍拒绝整个 provider page，不返回部分结果。

## 0.6.16 · 安装查询来源与失败诊断

市场通过公开 `pluginManager.registries()` 读取 DSH 的首选源、顺序 fallback 和 pnpm 已解析的源；复用公开 `@deepseek-ai/dsh-plugin-manager/registry` 的 `registryPlan` / `attributeFailure`，不读取私有配置或发明兜底源。`library.registry` 若显式设置，沿用 DSH 对请求源的规则（外部私有源单独使用）。查询 latest 成功后，精确版本及同一实际源以 `add --save-exact --registry=<source>` 传入原有受控 CLI；缺公开源能力或 pnpm 自有源无法解析，明确 `REGISTRY_CONFIG_UNAVAILABLE`，不猜 npmjs。DSH rc.2、alpha.2、rc.3 均公开这些端口。

整个查询（配置读取、配置源顺序查询、JSON 读回）共享 30000ms 上限。到期 abort 并报 `REGISTRY_LOOKUP_TIMEOUT`，不重试、不在超时后继续 fallback。只有 DSH 规则允许的网络/未找到失败才查询其已配置后继源；HTTP 认证/权限拒绝及无效 JSON 不换源。包版本稳定性策略、受控 CLI、读回、补偿、restart-required 行为保留。

原生 lookup 异常包为 `REGISTRY_LOOKUP_FAILED`，原 Error 保留于 cause；已知具名码保留。`library.*-failed.details.diagnostic` 最多4001字符，含脱敏异常类型/消息/cause.code 与实际 registry configuration/fetch/readback、CLI run、profile readback 阶段；CLI 非零另含 exit、signal 与 stderr/输出摘要。同一摘要及 operationId 写宿主 logger.warn（logger失效时安全console），UI已有可展开技术详情显示，并提示检查 DSH 源设置/网络后手动重试。不记录请求头、正文、环境、stack 或任意 details；不猜历史丢失的原错。
