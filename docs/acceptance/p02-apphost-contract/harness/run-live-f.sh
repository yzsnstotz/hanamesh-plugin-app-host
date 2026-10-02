#!/bin/bash
# GREEN case F (live, no restart): through DSH's own live user-patch reload (web profile patchReload: live), disable the
# app-host entry while the app is open, re-enable it, then disable the app entry while it is open. Patch = documented
# Loader entry option `disabled`. Restores the patch file afterwards.
. "$(dirname "$0")/lib.sh"; PORT=35416; S=live; P=l1; PR="$RUN/home-$S/dsh/profiles/$P"; DATA="$RUN/home-$S/dsh/data/hanamesh-apps"
# fresh DSH_HOME: setup + Core46 + fixture v2; base patch = Core stub knobs + test-only log tap (outside the repo)
rm -f "$RUN"/lF.leases.json
[ -f "$PR/package.json" ] || { "$H/setup.sh" $S $P "$RUN/inputs/hanamesh-dsh-app-host-0.1.0-rc.42.tgz" > "$RUN/$P-setup.out" 2>&1 || exit 1
  cp "$RUN/inputs/hanamesh-app-contract-fixture-0.0.2.tgz" "$PR/.inputs/"
  "$H/step.sh" lF-add-core "$H/dsh.sh" $S plugin --profile $P add "file:$PR/.inputs/hanamesh-core-0.2.0-rc.46.tgz"
  "$H/step.sh" lF-add-v2 "$H/dsh.sh" $S plugin --profile $P add "file:$PR/.inputs/hanamesh-app-contract-fixture-0.0.2.tgz"
  { cat "$PR/cordis.patch.yml"; cat "$RUN/l1-logtap.yml"; } > "$RUN/l1-base.yml"; }
cp "$RUN/l1-base.yml" "$PR/cordis.patch.yml"; : > "$EVID/logs/live-cordis-log.jsonl"
# wait until /hanamesh/apps answers the expected status (the live reload is asynchronous); records how long it took
# Atomic replace (write a sibling, then rename): an in-place truncate+write lets DSH's HMR read a half-written file
# ("must be a top-level YAML array") and coalesce the follow-up event — observed 2026-10-02, see logs/live-cordis-log*.
patch() { { cat "$RUN/l1-base.yml"; printf '%s' "$1"; } > "$PR/.cordis.patch.next"; mv "$PR/.cordis.patch.next" "$PR/cordis.patch.yml"; cp "$PR/cordis.patch.yml" "$EVID/logs/$2-cordis.patch.yml"
  for i in $(seq 1 60); do sleep 0.5; c=$("$NODE" "$H/probe.mjs" lF $PORT routes 2>/dev/null | grep -o '"/hanamesh/apps":[0-9]*' | cut -d: -f2); [ "$c" = "$3" ] && break; done
  echo "{\"tag\":\"$2\",\"settledAfterMs\":$((i*500)),\"/hanamesh/apps\":$c}" | tee -a "$EVID/logs/probes.jsonl"; sleep 1; }
up $S $P lF || exit 1
probe lF apps; probe lF open v-f; probe lF wait-ready; probe lF procs "$DATA"
patch $'- id: hanamesh-app-host\n  disabled: true\n' lF1-host-disabled 404
probe lF routes; probe lF procs "$DATA"
EVID=$EVID RUN=$RUN "$NODE" "$H/ui.mjs" lF $PORT lF1-host-disabled '[{"capture":"home"}]' | tee -a "$EVID/logs/ui.jsonl"
patch '' lF2-host-enabled 200
probe lF apps; probe lF events; probe lF open v-f2; probe lF wait-ready; probe lF procs "$DATA"
patch $'- id: hanamesh-app-contract-fixture\n  disabled: true\n' lF3-app-disabled 200
for i in $(seq 1 40); do "$NODE" "$H/probe.mjs" lF $PORT apps 2>/dev/null | grep -q '"appCount":0' && break; sleep 0.5; done; echo "{\"tag\":\"lF3-app-disabled\",\"appsEmptyAfterMs\":$((i*500))}" | tee -a "$EVID/logs/probes.jsonl"
probe lF apps; probe lF procs "$DATA"; probe lF events
patch '' lF4-app-enabled 200
for i in $(seq 1 40); do "$NODE" "$H/probe.mjs" lF $PORT apps 2>/dev/null | grep -q '"appCount":1' && break; sleep 0.5; done
probe lF apps; probe lF events
down lF
grep -v '^\s*at ' "$EVID/logs/lF.boot.log" | grep -iE 'error|warn|hanamesh' | head -40 > "$EVID/logs/lF-boot-notable.log"
