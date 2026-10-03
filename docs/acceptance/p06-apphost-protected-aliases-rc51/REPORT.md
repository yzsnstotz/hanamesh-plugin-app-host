# P06-APPHOST-PROTECTED-ALIASES-01 · rc.51 本地实施

2026-10-03。唯一 owning origin：`hanamesh-plugin-app-host`。从固定 rc.50 commit `37a7ee3c569b3011f2cdd5cbd914da2d74bceafb` 的 clean worktree 实施。冻结卡 `P06-APPHOST-PROTECTED-ALIASES-01.md` SHA-256 `d95c153ca5133261ccb0ff3c3d47cd8d7149d86cd2027192a7d5a4999d28a111`，独立规格判 `PASS_SPEC`。**实施者结论：本地 SOURCE/UNIT/HTTP/包门通过，待独立 QUALITY；真实 DSH/原生 UI 与 P06 产品均 NOT_RUN/UNPROVEN。**

## 变更和保护边界

- `src/client-ui.js` 的逐字保护集从 3 名增至与本仓 installer 相同的 5 名：`@hanamesh/dsh-app-host`、`hanamesh-core`、`hanamesh-usage`、`@hanamesh/dsh-core`、`@hanamesh/dsh-usage`。目录卡在任何安装、升级、卸载动作分支之前判保护；已安装列表继续按同一集合隐藏卸载。非保护插件三种动作保持。
- 服务端 `src/library/service.js`、`src/library/install.js`、HTTP 路由及其原有拒绝时序未改：插件专用 install/uninstall 对受保护包同步 `PACKAGE_DENIED` 403，通用目录路先 202、后由操作事件报告拒绝。未新增依赖、peer、随包 tgz、配置或跨插件 import。版本仅递增 `0.1.0-rc.51`，README/CONTRACT 描述相应 UI 行为。
- 源码/编译物固定 commit **`8861e98537995b5811563b6e7a368a359673fe72`**，tree **`bf73c52a5a49c403b4a8b0bbe7a0095656b3642d`**。未覆盖 rc.50 包。

## RED → GREEN 与防退化

| 证据层 | 原件 | 实际结果 |
| --- | --- | --- |
| `UNIT_REAL_CLIENT_HARNESS` RED | Node24 `node --test --test-reporter=tap tests/protected-aliases-ui.test.mjs`，[TAP](raw/red-ui.tap.gz) | 当前 rc.50 UI 下 **2/2 FAIL**：目录卡仍出现保护包操作；已安装旧别名仍出现卸载按钮。 |
| `UNIT_REAL_CLIENT_HARNESS` GREEN | [定向 TAP](raw/green-directed.tap.gz) | 与市场测试合跑 **10/10 PASS**。对五名逐一核目录卡的未装、可升级、已装三态均无安装/升级/卸载按钮；五名真实客户端已安装行无卸载；非保护插件安装、升级、目录卸载、已装列表卸载均仍显示。未发 POST。 |
| `LOCAL_PROFILE+HTTP` 原有服务端栅栏 | [基线 HTTP TAP](raw/baseline-http.tap.gz) 和[定向 TAP](raw/green-directed.tap.gz) | 两旧 scoped 名写进全新临时 profile 的 `package.json.dependencies`，经实际 `scanInstalledPlugins()` 均成 `installed`；插件专用 install/uninstall 四次 loopback HTTP 均 **403 `PACKAGE_DENIED`**，DSH spawn/registry 查询 0、operation event 0、profile manifest 字节不变。这是本机随机回环端口的测试服务，非 DSH 宿主。 |
| `MUTATION` | [总日志](raw/mutations-final.log.gz)、[结果 JSON](raw/mutation-results.json)、[M47 原始 TAP](raw/M47-mutant.tap.gz)、[M48 原始 TAP](raw/M48-mutant.tap.gz) | **48/48 `ERR_ASSERTION`**。新增 M47 移除目录卡前置保护判定、M48 移除两旧别名，均被本卡行为测试检出；两者 baseline 原件也在 `raw/`。 |

## Node24 全套与固定包

[版本](raw/versions.txt)：Node `v24.13.1`、npm `10.9.0`、TypeScript `5.8.3`。`npm ci` 前同 shell 设全新 `npm_config_cache=$(mktemp -d)`；最终安装 exit 0、审计 0 vulnerabilities，[原始输出](raw/npm-ci-final.log.gz)。

| 门 | 结果与原件 |
| --- | --- |
| `npm run build` | exit 0，[日志](raw/build.log.gz)；`dist/client-ui.js` 与包内同文件 SHA-256 均 `2475a486ecdda94e7875f4cca15aca409cec221b43b2ad603e43e4baa1398fba`，[双摘要](raw/dist-client-sha256.txt)。 |
| `npm run test:types` | exit 0，[日志](raw/test-types.log.gz) |
| `npm run check:consistency` | exit 0，4 groups / 4 boundaries，[日志](raw/check-consistency.log.gz) |
| Node24 `node --test --test-concurrency=1 --test-reporter=tap tests/*.test.mjs` | 最终 **198 total / 195 pass / 0 fail / 3 既有 skip**，[完整 TAP](raw/tests-final.tap.gz) |
| `npm run test:mutation` | exit 0，48/48，[总日志](raw/mutations-final.log.gz) |
| `git diff --check`、staged check | 均 exit 0；提交前已复核 |

固定 tgz：`/Users/yzliu/work/projects/hanamesh/_deliveries/p06-public-consumer-20261003/apphost-protected-aliases-rc51/hanamesh-dsh-app-host-0.1.0-rc.51.tgz`，SHA-256 **`54d34a50348f4b18b79e3c475e7ab39319be2798d58c1038fd3dddd8a8241835`**，[摘要](raw/tgz-sha256.txt)。`npm pack --json` exit 0；stdout 的 prepack 构建行和 JSON 原样存于[原件](raw/pack.stdout.gz)，解析出的[清单](raw/pack-manifest.json)是 rc.51、83 文件。全新目录通过 npm 10 `--legacy-peer-deps` 安装该固定 tgz，核安装版本、五名客户端保护集、前置动作保护、SDK 导入，[成功原件](raw/pack-smoke-retry.log.gz)。`--legacy-peer-deps` 仅用于空工程缺少 DSH 私有 peer 的离线包烟测姿态，不代表真实 DSH 安装门。

首次烟测命令误在源码工作树执行，安装到错误目录、校验失败，[原件](raw/pack-smoke.log.gz)。已恢复源码仓 manifest/lock 到仅有 rc.51 版本差异，重新 `npm ci` 并复跑最终全套；固定 tgz 在误操作之前已生成且未覆盖。新包烟测在独立目录通过。

## 未跑与清理

本卡没有启动 DSH、桌面壳、生产服务或个人 profile；没有接触 P05 原生、`~/.dsh`、3080 或研究 runtime。测试仅使用短命随机回环 HTTP 服务和临时 profile，均由测试关闭/清理。Mutation 脚本生成的历史 `docs/acceptance/mutations` 输出已留在本地可恢复 Git stash，本卡原始 M47/M48 TAP 与结果 JSON 另复制到 `raw/`；源码工作树无需承载其他生成物。

`REAL_HOST` 官方 DSH、`REAL_UI` 原生市场、默认 Core/Desktop 重钉、生产目录和用户安装动作均 **NOT_RUN**。本卡只修 AppHost 客户端提示与动作呈现；独立 QUALITY 复核后才可判 AppHost rc.51 组件是否 `PASS_LOCAL`。P06 完整产品仍 `UNPROVEN`，用户未 `ACCEPTED`。AppHost origin 为 public，本卡只本地 commit/pack，**不 push、tag、merge、publish、deploy**。
