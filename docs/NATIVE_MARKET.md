# CL6 native market work in progress

These building blocks are implemented and locally tested. **Normal activation has
not switched to `plugins.tab` yet.** The original migration red tests remain red.
This branch is not ready to merge, package or release.

The final tab must use DSH's `install()` after confirmation, `listBundles()` for
installation facts, and `openPackage()` for both installed and newer-version
actions. It must never maintain a second installed inventory. Unsupported targets
offer copy-command and website actions only. AI installation and plugin-provided
security review are excluded by the owner decision of 2026-11-19.

`createNativeMarketActions` captures one reviewed target and invalidates it on
cancel, replacement or confirmation. Its compatibility input must come from the
host policy; its install target must be produced from the verified source target,
not a source shell command. This is UI state, not an authorization boundary. The
native installation dialog still owns checks, execution, cancellation and results.

`createNativeMarketPolicy` resolves the actual host `dsh-app-boot` through a trusted
installation anchor, calls its `getDshRuntimeVersion` and
`evaluatePluginCompatibility`, and rereads native exact-version exemptions for
each evaluation. An absent or changed manager is unavailable. Installation status
reads `listBundles` afresh, with SemVer comparison through the already declared
`semver` dependency. No profile scan or compatibility/exemption algorithm is copied.

`createNativeMarketListing` requests one page of 50 entries and native bundles.
Previous accepted rows remain during loading and errors. An unavailable bundle
read makes installed facts unknown. Retry is explicit, and preserves the failed
page. Replacing a query invalidates late responses; disposal aborts the public
read and ignores any pending native reply. This component neither downloads the
whole catalog nor invents tag counts or recommendation rankings.

`NativeMarketConfirmation` requires the supplied native Modal and shows version,
publisher, source and trust text. `NativeMarketResults` provides an initial
skeleton, retained results, retry and show-more controls. These components are not
yet wired to a real tab. Synthetic component tests do not establish native focus,
Escape, rendering, screenshot fidelity or compatibility across DSH versions.

`readNativeMarketDetail` defines the sequence of three reader ports:
`meta.detail`, package README, repository README. Only `status: none` advances to
the next reader. An invalid or failed declared document remains an error. The
actual locale/document/image readers are not connected; these ports do not
implement a replacement for the official package-document library.

The pending integration must supply the formal bounded public catalog read path,
type/tag facets, recommendation groups, pack data and actual document readers;
migrate application leases/runtime controls, suite flows, website handoffs and
technical configuration; retire the old market entries; and pass the full module
gates plus isolated rc.4/rc.3/rc.1 DSH and design comparisons.

The implementation follows the official Discover confirmation and retained-list
patterns, the native plugin manager contract, and the actual host compatibility
evaluator. Primary source: [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness),
`packages/client/ui-plugin-market`, `packages/client/ui-plugin-manager`,
`packages/boot/plugin-market`, `packages/boot/app-boot`, and
`packages/util/plugin-detail`. The exact locally inspected revision and source
snapshots are recorded in the CL6 evidence directory. The development SDK test
uses `@deepseek-ai/dsh-app-boot@0.2.2-rc.1`; it is not a three-version native gate.
