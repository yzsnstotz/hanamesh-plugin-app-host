#!/bin/bash
# GREEN case E: the app is uninstalled (1) live, while DSH runs with the app open (profile patchReload: live), (2) then boot again.
. "$(dirname "$0")/lib.sh"; PORT=35413; S=green; P=g2; PR="$RUN/home-$S/dsh/profiles/$P"; DATA="$RUN/home-$S/dsh/data/hanamesh-apps"
storage() { ( cd "$RUN/home-$S/dsh" && find storages data -type f 2>/dev/null | sort | sed 's#[0-9a-f]\{24\}#<ns>#' ) > "$EVID/logs/$1-storage-files.txt"; wc -l < "$EVID/logs/$1-storage-files.txt" | sed "s/^/$1 storage_files=/" | tee -a "$EVID/logs/probes.jsonl"; }
up $S $P gE-live || exit 1
probe gE-live open v-e; probe gE-live wait-ready; probe gE-live procs "$DATA"
EVID=$EVID RUN=$RUN "$NODE" "$H/ui.mjs" gE-live $PORT gE-live-before '[{"capture":"home"}]' | tee -a "$EVID/logs/ui.jsonl"
"$H/step.sh" gE-remove-app-live "$H/dsh.sh" $S plugin --profile $P remove @hanamesh/app-contract-fixture
for i in $(seq 1 20); do sleep 0.5; done
probe gE-live apps; probe gE-live procs "$DATA"; probe gE-live events
down gE-live; storage gE
up $S $P gE-reboot || { echo "gE boot failed"; exit 1; }
probe gE-reboot apps; probe gE-reboot installed; probe gE-reboot procs "$DATA"; probe gE-reboot routes
down gE-reboot
