# Real manager fixtures for R115

These are development test tools, not runtime/package dependencies. No manager binary or user configuration is bundled. `installation-shell-managers.test.mjs` writes an isolated HOME, the official asdf shim template / mise symlink, a global version selection and a harmless CLI leaf. It executes the real manager in a neutral cwd. Every temporary tree is removed by the test.

| Tool | Version / licence / source | Archive SHA256 | Extracted executable SHA256 |
|---|---|---|---|
| asdf | 0.20.2, [MIT](https://github.com/asdf-vm/asdf/blob/v0.20.2/LICENSE), [darwin-arm64 release](https://github.com/asdf-vm/asdf/releases/download/v0.20.2/asdf-v0.20.2-darwin-arm64.tar.gz) | 81638f812ec0e6bf8fe6f446f92a270f5682d001d1b15aa93e87fe6805e4ab3c | d9bbd3608115899dc79841bb60be956ebe4a118fd28f33444e0ab27fbdb736b5 |
| mise | 2026.11.4, [MIT](https://github.com/jdx/mise/blob/v2026.11.4/LICENSE), [macos-arm64 release](https://github.com/jdx/mise/releases/download/v2026.11.4/mise-v2026.11.4-macos-arm64.tar.gz) | d37c01389b0918a19bbf763ee8ed339e533eebdb281be4911e9ad71d00b51477 | 21c269cd3c88e31c56aad7f7ccd9916b6fa78683937d93e5d17129b783d6f962 |

The test validates the executable hash before running it. Acquire/extract the official archives in a dedicated test-tool directory; do not replace a global manager. Set `AH1_ASDF_BINARY` and `AH1_MISE_BINARY` to those absolute executable paths when running `npm run check` or the targeted test. The R115 local full gate supplies both; missing tools or another OS/architecture explicitly skip only the real-manager cases, never claim native coverage. The Bash and infrastructure-environment regression cases do not need downloaded managers.

```sh
AH1_ASDF_BINARY=/absolute/test-tools/asdf \
AH1_MISE_BINARY=/absolute/test-tools/mise/bin/mise \
node --test --test-concurrency=1 tests/installation-shell-managers.test.mjs
```

Source of the asdf shim template: [v0.20.2 shims.go](https://github.com/asdf-vm/asdf/blob/v0.20.2/internal/shims/shims.go#L420). Mise global selection and XDG semantics: [official directories](https://mise.jdx.dev/directories.html). CLI leaf output is test data, not real user inventory. Neither test downloads Node or changes manager settings outside its temporary HOME.
