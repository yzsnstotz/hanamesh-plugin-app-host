#!/bin/bash
# Diagnostic for the live host-disable: isolate (a) the write pattern from (b) a running app instance.
. "$(dirname "$0")/lib.sh"; PORT=35416; S=live; P=l1; PR="$RUN/home-$S/dsh/profiles/$P"; DATA="$RUN/home-$S/dsh/data/hanamesh-apps"; : > "$EVID/logs/live-cordis-log.jsonl"
wait_apps() { for i in $(seq 1 40); do c=$("$NODE" "$H/probe.mjs" $1 $PORT routes 2>/dev/null | grep -o '"/hanamesh/apps":[0-9]*' | cut -d: -f2); [ "$c" = "$2" ] && break; sleep 0.5; done; echo "{\"tag\":\"$1\",\"case\":\"$3\",\"want\":$2,\"got\":$c,\"afterMs\":$((i*500))}" | tee -a "$EVID/logs/probes.jsonl"; }
cp "$RUN/l1-base.yml" "$PR/cordis.patch.yml"
up $S $P lD || exit 1
# (a) cp-then-append write, no instance
cp "$RUN/l1-base.yml" "$PR/cordis.patch.yml"; printf -- '- id: hanamesh-app-host\n  disabled: true\n' >> "$PR/cordis.patch.yml"; wait_apps lD 404 a-cp-append-no-instance
cp "$RUN/l1-base.yml" "$PR/cordis.patch.yml"; wait_apps lD 200 a-restore
# (b) plain append, with a running instance
probe lD open v-d1; probe lD wait-ready; probe lD procs "$DATA"
printf -- '- id: hanamesh-app-host\n  disabled: true\n' >> "$PR/cordis.patch.yml"; wait_apps lD 404 b-append-with-instance
probe lD procs "$DATA"
cp "$RUN/l1-base.yml" "$PR/cordis.patch.yml"; wait_apps lD 200 b-restore
probe lD apps; probe lD events
down lD
