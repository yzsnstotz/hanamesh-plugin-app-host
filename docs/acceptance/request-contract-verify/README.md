# Independent AppHost request verification

Frozen production source 1697ac87f56afdd9302ba380c9785eff8247dff6 (AppHost rc6), fetched from existing origin into a separate checkout; source production bytes unchanged. This branch adds independent evidence only. The implementation probe/fixtures were reviewed but not executed or imported; gate.mjs creates its own fixtures and helpers.

Own run: /Users/yzliu/.cache/hanamesh-runs/P02-APPHOST-REQUEST-01/request-contract-verify
Evidence: parent _evidence/request-contract-verify. Gate fixture/profile root is fresh every run and never copied from product. Archive previous evidence before another run; check lsof and remove only this verifier's prior fixture root before rerunning. No formal app/profile, GUI, Vibe, credentials, OAuth, model, remote peer or research runtime use.

Use the saved Node24.13.1 toolchain (run.py pins the independently resolved executable). After the prior own environment is removed and evidence archived:

```sh
python3 docs/acceptance/request-contract-verify/run.py /Users/yzliu/.cache/hanamesh-runs/P02-APPHOST-REQUEST-01/request-contract-verify install-new /bin/zsh -c 'export npm_config_cache=$(mktemp -d); print -r -- "$npm_config_cache" > npm-cache-path; npm ci'
python3 docs/acceptance/request-contract-verify/run.py /Users/yzliu/.cache/hanamesh-runs/P02-APPHOST-REQUEST-01/request-contract-verify build-new npm run build
python3 docs/acceptance/request-contract-verify/run.py /Users/yzliu/.cache/hanamesh-runs/P02-APPHOST-REQUEST-01/request-contract-verify gate-new node docs/acceptance/request-contract-verify/gate.mjs /Users/yzliu/.cache/hanamesh-runs/P02-APPHOST-REQUEST-01/_evidence/request-contract-verify/gate-new.json
python3 docs/acceptance/request-contract-verify/bytes.py /Users/yzliu/.cache/hanamesh-runs/P02-APPHOST-REQUEST-01/_evidence/request-contract-verify/bytes-new.json
```

15 HTTP matrix cases, 5 public-config assertions; original Loader/Connection/AppHost/installer/provision/storage execute in own processes. Test signing provider, app manifest, file archive, denial callback, Electron facts are FIXTURE. Normal launch token exchange is actual HTTP303 at /; explicitly supplied Node request headers are not Chromium sampling. Fixture CLI path is not executed by runtime provision. The final binary read/mode/exec smoke concerns only the supplied test shell executable.

32 original relevant regression tests, strict consumer types, toolchain and module preflight passed. Production changes/new dependencies/packages zero. No full suite/mutations/new pack required for this evidence-only commit. Formal effective Node/profile/CLI parameters NOT_CAPTURED. F4 native catalog/Vibe and five-plugin/OAuth/Usage/deployment/clean-machine gates remain with P02-ENTRY-01.

Initial own environment failures are retained: Node22 selection, invalid HTTP manifest source, non-existent Cordis start method, wrong auth exchange pathname, Node Set-Cookie array parsing. They were distinct newly localized environment defects and all occurred before the complete matrix; production/auth semantics unchanged. Final completed matrix ran once, exit0.
