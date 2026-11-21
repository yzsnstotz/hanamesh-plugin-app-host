# Public Market owner contract fixture (R491)

`market-owner-package.json` records every file hash from the normal public npm
`@hanamesh/market@0.1.1` archive, SHA256
`6e2c80e79c2aa9d52ad7ef642c6414d9f4fc3fbe335d040245d349b76ddd849b`,
tag `market-v0.1.1` / Core repository `2ab4d90b` (R487).

The fixture adds no runtime dependency or implementation fork. The test policy
first checks the installed, frozen development dependency against that manifest,
then copies only its normal payload into an owned temporary provider. Each test
loads the provider's public `@hanamesh/market` self-reference with the declared
DSH test peers. No original package or profile is mutated. A self-reference
assertion prevents an original node_modules link from washing a mutant green.

The original M44/M58/M66/M67/M75/M126–M129 protection points target Market:
approved Origin, exact one-request consent, live public reader wiring, fixed
private/CORS-readable refusal, conditional PNA and successful GET preflight.
`OWN*` cases separately prove AppHost cannot revive the retired endpoints.
Numbers do not stand in for semantic coverage: the policy retains per-case
baseline/mutant TAP, exact source hashes, invariant-specific assertion reason
and the verified normal payload manifest.

`scripts/market-owner-mutations.mjs` is the targeted developer entry; the existing
full mutation entry also includes this public consumer contract. It uses the
existing public Devkit mutation runner and its original assertion/cleanup rules.
When the normal Market input changes, update this fixture only from the reviewed
normal published artifact and re-run the affected public consumer evidence.
