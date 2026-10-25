# Official DSH compatibility · 0.6.2 candidate

The package admits the public host ranges in `package.json`; exact development dependencies remain reproducible test
inputs. The source audit compared the installed official `/Applications/DeepSeek Harness.app` `0.2.0-rc.2` against
upstream tag `dsh-v0.2.1-alpha.2`. The installed DSH packages are inside `Contents/Resources/app.asar/dsh/node_modules`,
while the physical `Contents/Resources/runtime` contains the public command launcher and dependency payload.

## Consumed public interfaces

| AppHost consumer | Public interface | rc.2 result |
| --- | --- | --- |
| `src/dsh.js`, domain declarations | Schemastery object/string/number/boolean/array/union/const/any/default; storage-domain `defineDomain` | Present; consumed signatures unchanged |
| `src/dsh.js` | Cordis `get`, `provide`, `effect`, `inject`, returned fiber `dispose`, logger info/warn/debug | Present; consumed signatures unchanged |
| `src/dsh.js`, store/router/library | `storageDomain.open(singleSpec)`, domain `global.get`, `global.set`, `close` | Present; whole-value publication unchanged |
| `src/dsh.js` | `webServer.port`, `register({kind:'exact',path,handler})` and disposer | Present |
| `src/dsh.js` | `connection.requestRejection(request)` → undefined / 401 / 403 | Present; AppHost delegates authentication to the host |
| `src/dsh.js`, `src/router/sources.js` | Optional credentials `describe`, `resolve`, `describeRecord`; llm `listProviders`, `listModels` | Present; consumed signatures unchanged |
| `src/library/install.js` | Optional `pluginManager.installBundle`, `removeBundle`, application outcome | Methods present; **rc.2 lacks install option `saveExact`** |
| `src/library/desktop-cli.js` | `runDesktopCli(runtimeDir,supportDir)` | Public in both versions; standalone Node cannot import ASAR |
| `src/client-ui.js` | `window.__ModuleLoader__.load({id,factory})`, React 18, Cordis effects/market seat | Present |
| `src/client-ui.js` | slots `inject`, `register`, `settings.section`, `sidebar.footer.action`, `shell.overlay` | Present; consumed registry and slot contracts unchanged |

The package's settings/locale client dependencies provide assembly ordering; AppHost calls no direct settings/locale
methods. Optional HanaMesh service seats and the legacy coding gateway endpoint are separate contracts, not official
DSH APIs. No other HanaMesh private module implementation was consulted for this audit.

Installed ASAR source evidence (paths below `dsh/node_modules/@deepseek-ai`): storage-domain `lib/index.js:61`,
`:157–172`, `:355–389`; host-webserver `lib/index.js:164–183`; client-connection `lib/index.js:586–588`;
cordis `lib/index.js:763`, `:800`, `:1169`, `:1600`; plugin-manager `lib/index.js:1749–1753`;
desktop-host `lib/cli.js:91–104`. The rc.2 public `InstallBundleOptions` is in upstream
`packages/boot/plugin-manager/src/types.ts:140–149`; alpha.2 adds `saveExact` at `:158` and forwards `--save-exact`.
Internal connection HTTPS/bind-address handling changed upstream; the local HTTP gate consumed here remains public.

## Installation behavior

0.6.15 retains the monitored public CLI. CLI failures carry bounded, redacted stdout and stderr through the asynchronous operation's diagnostic details; the market shows the original cause in an expandable panel. A minimum-release-age rejection prompts the person to upgrade DSH. No profile configuration, dependency exclusion or supply-chain policy is changed.

The official 0.2.0-rc.2 bundled pnpm 11.7.0 uses only the first matching package-name rule in `minimumReleaseAgeExclude`: an earlier exact old-version entry shadows a later exact new-version entry. The existing lockfile verifier can therefore reject an unrelated installation even though the new version is visibly listed. The 11.7.0 package obtained from npm has the same entry and core bytes as the supplied Desktop copy. Official Desktop 0.2.1-rc.3's pnpm 11.28.5 unions all matching exact versions and passes the same diagnostic profile. This establishes two tested endpoints, not the first fixed version. Both Desktop CLI and in-process manager use this pnpm path and set `ELECTRON_RUN_AS_NODE=1`; switching to the manager does not correct the 11.7.0 rule evaluation.

The rc.2 manager lacks the explicit `saveExact` option, but that alone does not prove exact installation unavailable: normal pnpm 10.33.0 and 11.7.0 both saved an explicitly supplied `name@version` as an exact spec in diagnostic runs. The retained CLI requirement below comes from the scoped environment and Git monitor contract; no manager path is added by 0.6.15.

AppHost reads public package metadata resolved from the proven Desktop runtime, or the CLI/profile package anchor.
It never infers capability from the presence of a method alone or from function source text. Unknown versions do not
enable live exact installation. Compatible manager versions at least `0.2.1-alpha.2` support `saveExact`,
but neither consumed manager exposes a scoped child environment/credential monitor. Since 0.6.5 all package mutations
therefore use the public CLI under the AppHost Git supervisor, including alpha hosts. The host environment is not mutated.

For a proven packaged macOS ASAR layout, AppHost uses the executable public `runtime/cli/bin/dsh` launcher unchanged.
That launcher supports the reserved `desktop` profile and owns Electron/pnpm startup. `DSH_HOME` is derived from the
same proven `profiles/desktop`; argument construction uses an array, not a shell command. The exact dependency and
installed package version are still both read back. A CLI install reports `restart-required`; it never claims live apply.
Prepared non-ASAR layouts retain the existing public `runDesktopCli` route. Windows' `.cmd` carrier and Linux packaged
Desktop launcher have no new validation here; absent supported carriers remain unavailable rather than being guessed.

Without a usable public CLI, the probe returns `ready:false` with readable `need`;
installation refuses before touching the profile. Browsing, existing installed rows and authenticated view APIs remain.

## Why the pins regressed

`7fc127c` introduced public host peer ranges. `b992d37` (2026-10-05) replaced the DSH ranges with exact rc.2 peers;
`b299d1e` made Cordis/Schemastery exact as well. `a00c80e` (2026-10-11) moved those exact peers to alpha.2 alongside
the fixed development runtime. Public admission had become coupled to development supply, contrary to
`laws/environment-matrix.md`. Version 0.6.2 restores that separation without modifying upstream.

## Evidence limits

Source/fixture tests exercise version selection, pre-mutation refusal, exact readback, public launcher arguments,
isolated profile selection, restart-required and alpha live results. They are not an actual rc.2 manager or Desktop.
Real isolated official Desktop load, its browser settings/market/view flow, actual CLI installation, and package/runtime
checks need separate receipts. Other operating-system matrix cells and owner acceptance remain independent gates.

The pnpm 11 distribution consumer supplies the coherent official rc.2 host package versions from
`tests/fixtures/official-rc2-host.json` and keeps strict peer checking. A bare auto-peer experiment failed: pnpm selected
Cordis `4.0.4` alongside newly available DSH `0.2.1-alpha.3` packages that require `~4.0.5-alpha.2`. Its failure and
`pnpm peers check` output are retained in the session run's `apphost-full-test-2.log` and
`apphost-package-regression.log`. This candidate does not claim a bare package can automatically assemble an arbitrary
new DSH host. Official Desktop supplies its own coherent runtime and disables automatic peer installation.

## I27 官方 rc.2：独立 Node 的公开配置

官方 macOS rc.2 的 Electron-as-Node 包装脚本不等于本模块的独立 Node 监督运行时。现 guardian 明确拒绝 `process.versions.electron`，受控子进程环境也不继承宿主 Electron 启动变量；不移除该拒绝、不猜应用路径或增加客户端 hook。

有独立 Node.js 24（24.13.1或更新24.x）时，在官方 profile 的公开插件用户配置层设置 AppHost **顶层** `nodeBinary` 为其实际绝对可执行路径；不是 library.nodeBinary，也不从PATH自动猜测。用户填写自己的真实安装路径，完全退出再重开。在网站安装交接设置和公开 install-target readback 看 ready/缺件；ready=true只代表安装前置具备，不是已安装或完整网站闭环。

```yaml
- id: hanamesh-app-host
  config:
    nodeBinary: <独立Node的实际绝对路径>
```

这是配置示意，尖括号不是可执行路径。保留原有其他AppHost配置；不改客户端、原生品牌、其他插件设置或凭据。当前支持范围仅独立Node，未声明官方Electron-as-Node安全监督兼容。


## R1 profile peers check (2026-10-21 candidate)

Official rc.2 supplies `ctx.slots` through `@deepseek-ai/dsh-client-ui-renderer`; the removed `dsh-client-ui-slots` peer/inject name does not exist in the official 0.2.1-rc.2 package tree. This candidate declares the actual public renderer instead, preserving the existing supported version range and exact alpha.2 development input.

The official pnpm 11.28.5 `peers check` reads the profile lock graph, which excludes installation-owned Host/Renderer supplies under the default `autoInstallPeers:false` policy. Missing lock edges are distinct from runtime injection. Its bundled range intersection also reports AppHost/Brand locale ranges as conflicting although both admit the actual 0.2.1-rc.2. The original static check remains RED, not waived; neither profile policy nor package presence is faked. Brand's finite supported ranges remain unchanged.

All client copy is registrant-owned through `ctx.locale.register/bind/subscribe`; settings labels are localized strings re-registered on change, as specified by the public settings slot contract. Styles remain within AppHost classes. The host settings column may still be clipped at390; no host selectors or client patches are used to conceal that restriction. Original provider errors retain their code/message/details under collapsed diagnostics, separate from localized explanations.
