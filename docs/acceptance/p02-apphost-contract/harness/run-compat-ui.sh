#!/bin/bash
# Real Chrome: the market's installed list on rc.42 tells the user that an old (v1) app must be uninstalled before the suite.
. "$(dirname "$0")/lib.sh"; PORT=35418; S=compatui; P=c2; PR="$RUN/home-$S/dsh/profiles/$P"
[ -f "$PR/package.json" ] || { "$H/setup.sh" $S $P "$RUN/inputs/hanamesh-dsh-app-host-0.1.0-rc.42.tgz" > "$RUN/$P-setup.out" 2>&1 || exit 1
  cp "$RUN"/inputs/hanamesh-app-contract-fixture-0.0.1.tgz "$PR/.inputs/"
  "$H/step.sh" cU-add-core "$H/dsh.sh" $S plugin --profile $P add "file:$PR/.inputs/hanamesh-core-0.2.0-rc.46.tgz"
  "$H/step.sh" cU-add-v1 "$H/dsh.sh" $S plugin --profile $P add "file:$PR/.inputs/hanamesh-app-contract-fixture-0.0.1.tgz"; }
up $S $P cU || exit 1
EVID=$EVID RUN=$RUN "$NODE" "$H/ui.mjs" cU $PORT cU-v1-on-rc42 '[{"click":"市场"},{"wait":3000},{"capture":"market"}]' | tee -a "$EVID/logs/ui.jsonl"
down cU
