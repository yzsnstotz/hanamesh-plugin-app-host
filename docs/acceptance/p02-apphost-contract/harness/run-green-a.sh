#!/bin/bash
# GREEN case A: contract v2 app installed BEFORE any host; then the suite (Core46 → AppHost rc.42 candidate) arrives.
. "$(dirname "$0")/lib.sh"; PORT=35412; S=green; P=g1; PR="$RUN/home-$S/dsh/profiles/$P"
up $S $P gA1-app-only || { echo "gA1 boot failed"; exit 1; }
probe gA1-app-only routes
EVID=$EVID RUN=$RUN "$NODE" "$H/ui.mjs" gA1-app-only $PORT gA1-app-only '[{"capture":"home"}]' | tee -a "$EVID/logs/ui.jsonl"
down gA1-app-only
"$H/step.sh" gA-add-core "$H/dsh.sh" $S plugin --profile $P add "file:$PR/.inputs/hanamesh-core-0.2.0-rc.46.tgz"
"$H/step.sh" gA-dump-with-host "$H/dsh.sh" $S --profile $P --dump-config
up $S $P gA2-host-arrives || { echo "gA2 boot failed"; exit 1; }
probe gA2-host-arrives apps; probe gA2-host-arrives routes
down gA2-host-arrives
