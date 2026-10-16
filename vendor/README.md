# Fixed public package supply

These are the normal packed public package surfaces at the exact source commits
in supply.json, with original package metadata and licenses unchanged. The owner
already authorized distribution in the packages' LICENSE notices. No repository
history, private configuration, development source tree, or credentials are
included. Provider source is not edited. Devkit is development-only; provision
remains bundled in the app-host runtime tarball. This vendor directory is excluded
from app-host runtime publication by package.json files and verified pack tests.

Run `sha256sum -c vendor/SHA256SUMS` then the guarded frozen pnpm install. The lock
also pins archive integrity. A fresh public CI needs no Git credentials or private
repository access. Future upgrades replace archives and update provenance/lock;
never modify provider code in this repository.
