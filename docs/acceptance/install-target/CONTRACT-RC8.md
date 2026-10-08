# CONTRACT-APPHOST-INSTALL-01 · install-target contract v1 (rc8) evidence

Origin hanamesh-plugin-app-host. Source base: rc7 30ff8559bcf5341c5bbda53e95ba71c8abc4883f (codex/p06-apphost-install-target-01), itself one commit over main 1697ac8. No new dependency, peer, vendor byte or configuration. rc7 tarball (bc8cd8bd…bfe9) is untouched.

Change (minor, additive): optional `contractVersion` on the existing install target; absent keeps rc7 v1 semantics, `'1'` accepted, anything else refused with `CONTRACT_VERSION_UNSUPPORTED` (400, details.supported) before field checks. GET target results add `contractVersion`; package.json declares `hanamesh.installTarget`. Schema, provider/consumer fixtures and the reusable suite ship in the package (docs/INSTALL_TARGET.md §合约版本与一致性套件).

Run root: /Users/yzliu/.cache/hanamesh-runs/CONTRACT-APPHOST-INSTALL-01/ (check/, candidate/, consumer/, evidence/).

- Baseline on untouched rc7 source: npm test 178 total / 175 pass / 0 fail / 3 skip, exit 0.
- `npm run check` on rc8 source: exit 0; tests 182 / 179 pass / 0 fail / 3 skip (same three pre-existing skips); mutations 23/23 detected including M23 (provider accepting an unsupported declaration is caught by ITC01 via PV05/http); strict types and development preflight pass.
- `npm pack` → hanamesh-dsh-app-host-0.2.0-rc.8.tgz, 171721 bytes, SHA256 e06df1a821d1e9fd67ea246a13e5c87b2ca5eff08e8228b0105e79781b6a3706 (artifacts/…rc.8.tgz.sha256). `node scripts/verify-package.mjs <tgz>` exit 0: packed install-target bytes equal source; the offline no-peer consumer ran every shipped suite from the installed tarball (INSTALL_TARGET_CONTRACT PASS).
- Independent consumer project (consumer/, only the rc8 tgz, the frozen rc7 tgz under an alias, and zod): `run.js provider` 47/47; `run.js consumer` (reference fixture v1) consumer 15/15, chain 6/6; `--unversioned` consumer 11 pass + 4 handshake skips, chain 5/5; Desktop's own install-link.ts (byte snapshot of hanamesh-desktop ad3aa02, blob 75cd9b53…) as unversioned consumer: 9 pass + 6 skips (single-identifier targets refused — Desktop requires both — and handshake n/a), chain 3 pass + 2 skips, 0 fail. Cross-version: v1 consumer accepts rc8, refuses rc7 (no declaration); rc7 provider resolves unversioned input and refuses a declared input with INVALID_INPUT. All exit 0.

These are SOURCE/FIXTURE/ISOLATED_PACKAGE checks. No product install, GUI, Desktop change or owner gate was run; the real market first step remains P06-APPHOST-INSTALL-TARGET-01's.
