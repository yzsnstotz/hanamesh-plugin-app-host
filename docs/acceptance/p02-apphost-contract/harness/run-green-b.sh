#!/bin/bash
# GREEN cases B–E on one fresh profile: host before app → host removed (app stays) → host restored → app uninstalled.
. "$(dirname "$0")/lib.sh"; PORT=35413; S=green; P=g2; PR="$RUN/home-$S/dsh/profiles/$P"; DATA="$RUN/home-$S/dsh/data/hanamesh-apps"
FIXTURE=${FIXTURE:-hanamesh-app-contract-fixture-0.0.2.tgz}   # rc.43 rerun: FIXTURE=…-0.0.4.tgz APPHOST_TGZ=…rc.43.tgz
storage() { ( cd "$RUN/home-$S/dsh" && find storages data -type f 2>/dev/null | sort | sed 's#[0-9a-f]\{24\}#<ns>#' ) > "$EVID/logs/$1-storage-files.txt"; wc -l < "$EVID/logs/$1-storage-files.txt" | sed "s/^/$1 storage_files=/" | tee -a "$EVID/logs/probes.jsonl"; }
"$H/setup.sh" $S $P "${APPHOST_TGZ:-$RUN/inputs/hanamesh-dsh-app-host-0.1.0-rc.42.tgz}" > "$RUN/$P-setup.out" 2>&1 || { cat "$RUN/$P-setup.out"; exit 1; }
cp "$RUN/inputs/$FIXTURE" "$PR/.inputs/"
# B: host first, then app
"$H/step.sh" gB-add-core "$H/dsh.sh" $S plugin --profile $P add "file:$PR/.inputs/hanamesh-core-0.2.0-rc.46.tgz"
"$H/step.sh" gB-add-v2 "$H/dsh.sh" $S plugin --profile $P add "file:$PR/.inputs/$FIXTURE"
"$H/step.sh" gB-installed-versions sh -c "grep '\"version\"' $PR/node_modules/@hanamesh/*/package.json $PR/node_modules/hanamesh-*/package.json"
up $S $P gB-host-then-app || exit 1
probe gB-host-then-app apps; probe gB-host-then-app installed
probe gB-host-then-app open v-b; probe gB-host-then-app wait-ready; probe gB-host-then-app procs "$DATA"
probe gB-host-then-app close v-b; sleep 2; probe gB-host-then-app procs "$DATA"; probe gB-host-then-app events
probe gB-host-then-app open v-b2; probe gB-host-then-app wait-ready   # left running on purpose: host stop must not orphan it
probe gB-host-then-app procs "$DATA"
down gB-host-then-app; sleep 1; probe gB-after-host-stop procs "$DATA"; storage gB
# C: host removed, app stays
"$H/step.sh" gC-remove-core "$H/dsh.sh" $S plugin --profile $P remove hanamesh-core
"$H/step.sh" gC-dump-host-removed "$H/dsh.sh" $S --profile $P --dump-config
"$H/step.sh" gC-node-modules ls "$PR/node_modules/@hanamesh" "$PR/node_modules"
up $S $P gC-host-removed || { echo "gC boot failed"; exit 1; }
probe gC-host-removed routes; probe gC-host-removed procs "$DATA"
EVID=$EVID RUN=$RUN "$NODE" "$H/ui.mjs" gC-host-removed $PORT gC-host-removed '[{"capture":"home"}]' | tee -a "$EVID/logs/ui.jsonl"
down gC-host-removed; storage gC
# D: host restored
"$H/step.sh" gD-readd-core "$H/dsh.sh" $S plugin --profile $P add "file:$PR/.inputs/hanamesh-core-0.2.0-rc.46.tgz"
up $S $P gD-host-restored || exit 1
probe gD-host-restored apps; probe gD-host-restored events
probe gD-host-restored open v-d; probe gD-host-restored wait-ready; probe gD-host-restored close v-d; sleep 2; probe gD-host-restored procs "$DATA"; probe gD-host-restored events
down gD-host-restored; storage gD
