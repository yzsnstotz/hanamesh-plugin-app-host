# Fixed development package supply

Only the shared release gate (`@hanamesh/release-platform-gate`, development-only) remains here as a
packed public archive; its provenance is `release-platform-gate.json`. Devkit and lib-provision are
installed from the public npm registry by caret range, with version and sha512 integrity pinned in
`pnpm-lock.yaml`; lib-provision stays bundled in the app-host runtime tarball. This vendor directory is
excluded from app-host runtime publication by package.json files and verified pack tests.

Run `shasum -a 256 -c vendor/SHA256SUMS` then the guarded frozen pnpm install.
