# AppHost existing public startup and runtime contract

2026-10-06: PM优先核现有同源Host HTTP入口承载原生窗口。AppHost已有公开配置与供应路径可复用，本轮不提出新Admission/header/API。正式客户端有效配置与真实runtime均NOT_CAPTURED/NOT_RUN。

## 最小有效参数与归属

下面均为现有AppHost DSH插件配置；由启动Host/profile的宿主装配者提供真实路径。不是新增配置，也不是要求PM查源码或owner执行命令。

| 现有键 | 有效值 / 可省条件 |
| --- | --- |
| 顶层 `nodeBinary` | 实际可执行的独立Node绝对路径。Electron execPath不会自动推断成Node；不能拿Electron可执行文件代填。`library.nodeBinary`不是公开键。实际Node能力/分发闭包归Host/Desktop装配者采证；AppHost owned guardian消费该路径 |
| `library.profileDir` | 当前隔离profile绝对根，包含该profile package.json及实际已装包node_modules；不是Host源码或共享vendor根。仅当AppHost真实包根的祖先有匹配manifest及同包link才自动推断。位于profile之外的共享store link不能证明profile，须显式配置 |
| `library.profileName` | 当前官方DSH启动profile的真实名字，仅字母数字、下划线、点、短横线。缺省可由profileDir basename推断；若实际名字不同须显式提供 |
| `library.dshBin` | 官方DSH `lib/bin.js`绝对路径。可从argv[1]精确后缀推断；否则AppHost从profile package.json经公开Node解析 `@deepseek-ai/dsh/lib/bin.js`。该CLI rc2公开exports含 `./lib/*`，所以无需新增API；实际profile可解析性仍须实核 |
| 顶层 `parentOrigin` | 缺省为当前Host webServer数字回环 `http://127.0.0.1:<实际port>`；HTTP页面的自然Origin与目标Host须精确匹配。不能替renderer合成Origin或把localhost当127.0.0.1。沿正常Connection认证；frame/cross-site/client/authorize拒绝条件保持 |
| 顶层 `dataRoot` | 缺省隔离DSH_HOME下 `data/hanamesh-apps`。runtime根为 `<dataRoot>/runtimes/<appId>`；不要放进用户原profile或手造ledger |

`sources`、`registry`、`allowPrerelease`不属于本次已装应用补齐所需的新参数；保留现有默认目录，不用 `sources:[]`关闭产品目录。公开Config类型已含上述键。`src/dsh.js:159–175`只有profileDir/profileName/nodeBinary及可解析dshBin齐全时创建安装器。正常目录可出现但安装器仍可能未创建；缺安装器在通过请求认证授权后返回503/LIBRARY_INSTALL_UNAVAILABLE，不等于此前CSRF_DENIED。

## 供应与打开是两步

客户端POST相对 `/hanamesh/library/provision`，JSON `{appId,packageName,runtimeItem}`精确来自已装行，带workspace-v1标记，Origin由真实HTTP页面自然产生。顺序为Host/Origin/frame/client → 公共Connection authenticate → JSON → authorize → library.provision。202只表示operation已启动，随后观察公开events中的done/failed。

AppHost原installer从该profile已装package/app.json查runtime宣告，核appId、runtimeItem，再调用已有inline provision按manifest下载、SHA校验、解压落位、生成自己的ledger；不执行DSH plugin add来补齐已装runtime，不修改Vibe manifest。它返回restart-required；应用启动另走AppHost owned guardian，其Node有效性在spawn时核，不可用市场可浏览推定Node启动已成功。

Desktop最新REPORT读取冻结rc6 ASAR的Vibe rc1宣告为 `vibe-trading-runtime@0.1.15`、darwin-arm64归档及bin/vibe-trading版本检查；这是对方包片段事实。本worker未下载该runtime、未起Vibe、未对正式profile采有效参数，前轮正常供应使用测试归档。不得把fixtureledger搬进产品，或把rc6源等同当前产品AppHostrc2。无新产物/版本，本轮不要求Core最终rc53健康pin从当前产品rc2迁至rc6。

## 核准证据和下一项

现有library-locate suite新跑4/4 exit0：hoisted/同profile pnpm链接、显式优先、Electron不推Node、CLI后缀与默认source。新增config-probe四SOURCE/FIXTURE案例exit0：profile外store不推profile、CLI公开export解析、Electron过程事实下显式参数可复用、缺安装器503且operation为0。测试注入过程事实，不是实际Electron启动。无需npm安装或真实凭据。

owning source `src/{dsh.js,dsh.d.ts,runtime.js,library/{locate,service,install}.js}`；官方CLI公开export来源 `/Users/yzliu/work/projects/hanamesh/hanamesh-desktop/apps/cli/package.json` read-only，本轮哈希见public-config-inputs.json。真实产品参数缺口由既有Desktop writer报告：实际Host process Node/Electron类别、真实独立Node能力、当前profile根/名字、CLI解析结果、HTTP origin/正常认证承载事实，不输出cookie/token。AppHost无需先变更源；同实现者接到确定有效参数再核自身边界。正式F4补齐/应用打开仍归独立产品verifier，不重投d54那次失败按钮。

复跑：`python3 docs/acceptance/request-contract/run.py /absolute/new/run config node docs/acceptance/request-contract/config-probe.mjs /absolute/new/run/_evidence/request-contract/config.json`。脚本仅在自己的临时根造配置fixture，finally删除，realDesktop/realRuntime显式NOT_RUN。
