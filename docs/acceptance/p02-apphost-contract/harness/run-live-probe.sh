#!/bin/bash
# Diagnostic: does the pinned DSH apply `disabled: true` from the profile user patch at startup, and live?
. "$(dirname "$0")/lib.sh"; PORT=35417; S=live; P=l1; PR="$RUN/home-$S/dsh/profiles/$P"
[ -f "$PR/package.json" ] || { "$H/setup.sh" $S $P "$RUN/inputs/hanamesh-dsh-app-host-0.1.0-rc.42.tgz" > "$RUN/$P-setup.out" 2>&1 || exit 1; }
cp "$RUN/inputs/hanamesh-app-contract-fixture-0.0.2.tgz" "$PR/.inputs/"
"$H/step.sh" lF-add-core "$H/dsh.sh" $S plugin --profile $P add "file:$PR/.inputs/hanamesh-core-0.2.0-rc.46.tgz" >/dev/null
"$H/step.sh" lF-add-v2 "$H/dsh.sh" $S plugin --profile $P add "file:$PR/.inputs/hanamesh-app-contract-fixture-0.0.2.tgz" >/dev/null
cp "$PR/cordis.patch.yml" "$RUN/l1-base.yml"
printf -- '- id: hanamesh-app-host\n  disabled: true\n' >> "$PR/cordis.patch.yml"
"$H/step.sh" lF-dump-startup-disabled "$H/dsh.sh" $S --profile $P --dump-config >/dev/null
grep -n -A3 "id: hanamesh-app-host" "$EVID/logs/lF-dump-startup-disabled.log"
up $S $P lF-startup-disabled || echo BOOTFAIL; probe lF-startup-disabled routes; down lF-startup-disabled
cp "$RUN/l1-base.yml" "$PR/cordis.patch.yml"
up $S $P lF-live || echo BOOTFAIL; probe lF-live routes
printf -- '- id: hanamesh-app-host\n  disabled: true\n' >> "$PR/cordis.patch.yml"
for i in 2 5 10 20; do sleep $i; probe lF-live routes; done
down lF-live; cp "$RUN/l1-base.yml" "$PR/cordis.patch.yml"
