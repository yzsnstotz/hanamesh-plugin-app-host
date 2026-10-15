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

AppHost reads public package metadata resolved from the proven Desktop runtime, or the CLI/profile package anchor.
It never infers capability from the presence of a method alone or from function source text. Unknown versions do not
enable live exact installation. Compatible manager versions at least `0.2.1-alpha.2` support `saveExact`.

For a proven packaged macOS ASAR layout, AppHost uses the executable public `runtime/cli/bin/dsh` launcher unchanged.
That launcher supports the reserved `desktop` profile and owns Electron/pnpm startup. `DSH_HOME` is derived from the
same proven `profiles/desktop`; argument construction uses an array, not a shell command. The exact dependency and
installed package version are still both read back. A CLI install reports `restart-required`; it never claims live apply.
Prepared non-ASAR layouts retain the existing public `runDesktopCli` route. Windows' `.cmd` carrier and Linux packaged
Desktop launcher have no new validation here; absent supported carriers remain unavailable rather than being guessed.

Without either exact-save capability or a usable public CLI, the probe returns `ready:false` with readable `need`;
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
