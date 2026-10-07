# P06-APPHOST-INSTALL-TARGET-01 · rc7 implementation evidence

Origin: hanamesh-plugin-app-host. Base 1697ac87f56afdd9302ba380c9785eff8247dff6, including metadata rc6 at 2788ecfc29e2d63d96094ec114d63119b3e207f4. No new dependencies, peers or vendor bytes. Existing suite distribution license partition remains intact.

Public contract: docs/INSTALL_TARGET.md. Normal workspace navigation uses #hanamesh-install?itemId=...&packageName=...; the existing AppHost client and market service also export openInstallTarget(). All metadata resolution, confirmation, installation and readback remain market owned. The original install route retains Host/Origin/frame/CSRF/identity/authorization checks. GET target resolution does not install. Duplicate confirmed installs share the existing operation.

Run root: /Users/yzliu/.cache/hanamesh-runs/P06-APPHOST-INSTALL-TARGET-01/. Native return locations and logs are retained there.

- Node 24.13.1 / pnpm 10.33.0 / TypeScript 5.8.3 toolchain verified.
- Final module tests: 178 total, 175 passed, zero failed, three skipped. The two isolated Chromium tests lack a binary; AH-VL08 is the pre-existing explicit opt-in long lease test.
- Install-target tests IT01–IT08 cover market catalog identity resolution and untrusted fields, HTTP fences, shared operation, visible confirmation/cancel, double click/repeated input, denied auth, installed readback missing, and public fragment navigation. Initial missing-feature failures, readback regression failure, fragment regression failure and subsequent passing logs are retained.
- Build, strict type consumption, consistency and development preflight passed. An additional package/client regression passed after the package validator change.
- Frozen tarball: candidate/hanamesh-dsh-app-host-0.2.0-rc.7.tgz, 157542 bytes, SHA256 bc8cd8bd875be0bca0998e297cdd9e6b3fd1260ef16d66b45252ce5e05d6bfe9. Packed client UI, declarations, library route and service match exact source bytes. Independent artifact JS and host-peer TS consumers passed, with a real owned process writing its own data and zero source-tree imports.

Earlier failures are preserved: the run-directory shell selected Node 22 until PATH was explicitly pinned; initial pack used an unwritable configured default npm cache until the card cache was explicitly supplied; the new pack validator compared Buffer against string before correcting the validator to compare bytes; an offline consumer lacked its pnpm metadata until the exact existing runtime/host peers were warmed in the card's isolated store. No package bytes were changed or same-version package reissued after the frozen successful pack. No installation/authentication fences were weakened.

These are SOURCE/FIXTURE/ISOLATED_PACKAGE checks, not the product gate. This card did not rerun the old mutation matrix, independent verification, dry/clean machine, remote/VNC, or earlier P02 GUI observations. AppHost rc7 is not yet installed into /Applications/HanaMesh.app and no product first-step screenshot exists. Desktop owns consuming the new frozen package through normal assembly; after that this worker resumes the real market first step. No TO_TEST or owner acceptance is claimed.
