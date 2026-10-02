#!/bin/bash
# Compat gates on rc.42: (1) an OLD contract v1 app (Vibe36 shape) is flagged host-required in the market UI, and removing
# the suite still breaks DSH boot — rc.42 cannot repair an old bundle; (2) a broken v2 definition is loud but not fatal.
. "$(dirname "$0")/lib.sh"; PORT=35418; S=compat; P=c1; PR="$RUN/home-$S/dsh/profiles/$P"
[ -f "$PR/package.json" ] || { "$H/setup.sh" $S $P "$RUN/inputs/hanamesh-dsh-app-host-0.1.0-rc.42.tgz" > "$RUN/$P-setup.out" 2>&1 || exit 1; }
cp "$RUN"/inputs/hanamesh-app-contract-fixture-0.0.{1,3}.tgz "$PR/.inputs/"; cp "$PR/cordis.patch.yml" "$RUN/c1-base.yml"
{ cat "$RUN/c1-base.yml"; printf -- "- insert:\n  - id: p02-log-tap\n    name: %s\n    config:\n      file: %s\n" "$RUN/diag/log-tap.mjs" "$EVID/logs/compat-cordis-log.jsonl"; } > "$PR/.next"; mv "$PR/.next" "$PR/cordis.patch.yml"; : > "$EVID/logs/compat-cordis-log.jsonl"
"$H/step.sh" cA-add-core "$H/dsh.sh" $S plugin --profile $P add "file:$PR/.inputs/hanamesh-core-0.2.0-rc.46.tgz"
"$H/step.sh" cA-add-v1 "$H/dsh.sh" $S plugin --profile $P add "file:$PR/.inputs/hanamesh-app-contract-fixture-0.0.1.tgz"
up $S $P cA-v1-on-rc42 || exit 1
probe cA-v1-on-rc42 apps; probe cA-v1-on-rc42 installed
EVID=$EVID RUN=$RUN "$NODE" "$H/ui.mjs" cA-v1-on-rc42 $PORT cA-v1-on-rc42 '[{"click":"HanaMesh 市场"},{"wait":2500},{"capture":"market"}]' | tee -a "$EVID/logs/ui.jsonl"
down cA-v1-on-rc42
"$H/step.sh" cA-remove-core "$H/dsh.sh" $S plugin --profile $P remove hanamesh-core
boot_once $S $P cA-v1-host-removed
# (2) broken v2 definition: restore the suite, replace v1 with the broken v2 build
"$H/step.sh" cB-readd-core "$H/dsh.sh" $S plugin --profile $P add "file:$PR/.inputs/hanamesh-core-0.2.0-rc.46.tgz"
"$H/step.sh" cB-remove-v1 "$H/dsh.sh" $S plugin --profile $P remove @hanamesh/app-contract-fixture
"$H/step.sh" cB-add-broken-v2 "$H/dsh.sh" $S plugin --profile $P add "file:$PR/.inputs/hanamesh-app-contract-fixture-0.0.3.tgz"
up $S $P cB-broken-v2 || { echo "cB boot failed"; exit 1; }
probe cB-broken-v2 apps; probe cB-broken-v2 installed; probe cB-broken-v2 routes
down cB-broken-v2
"$H/step.sh" cB-remove-core "$H/dsh.sh" $S plugin --profile $P remove hanamesh-core
up $S $P cB-broken-v2-host-removed || echo "cB2 boot failed"; probe cB-broken-v2-host-removed routes; down cB-broken-v2-host-removed
