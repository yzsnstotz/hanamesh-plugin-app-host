# P06 rc9 independent Chrome trial · partial evidence

Business code remains signed v0.2.0-rc.9 (9632c64). This directory records the real official DSH profile and authenticated Chrome UI. It is not a product acceptance or a new package release.

The market first step, four-field confirmation, cancellation, invalid input and catalog-missing reasons were visible. Explicit confirmation issued one original install POST for a canonical test fixture and one for public npm dsh-notify@0.1.7. Reentry during the latter kept the installing state and issued no second install POST. The fixture failed registry lookup; dsh-notify failed DSH_PLUGIN_FAILED. Real profile manifest, lockfiles and module metadata were unchanged; target absent.

An official CLI diagnosis in a copied profile using the same minimal installer environment reproduced ERR_PNPM_UNEXPECTED_STORE. Bootstrap node_modules points at /Users/yzliu/Library/pnpm/store/v10; the installer uses isolated HOME/Library/pnpm/store/v10. This is a named run environment failure, not evidence of a protocol bug. No global pnpm config or source code was changed. Diagnostic copied profile was not substituted as the product profile.

Chrome localhost:49228 was blocked by client on its first clean navigation. Screenshot retained; no retry, normal-token attempt on that origin, policy change or bypass. GUI lock released. 127 parameter UI, successful install/readback/open, visible auth failure, already-installed dedup and whole rollback after a later application/runtime failure remain unverified.

Filename 11-real-install-readback.jpg shows the failed result; it does not prove an installed readback. Browser network receipts omit Cookie/Authorization and private startup URLs. The raw startup log and token-bearing entry remain 0600 files only in the named run; neither is in Git. Exact signed pack identity and original three source catalog fixtures were checked. Contract conformance evidence is referenced from the admitted rc9 contract report; no old contract gate was rerun.
