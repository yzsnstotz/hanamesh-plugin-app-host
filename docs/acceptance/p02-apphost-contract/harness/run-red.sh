#!/bin/bash
# RED: contract v1 fixture + Core46/AppHost41; then the user's real step `dsh plugin remove hanamesh-core`; reboot.
. "$(dirname "$0")/lib.sh"; PORT=35411; S=red; P=p3; PR="$RUN/home-$S/dsh/profiles/$P"
up $S $P red-a-with-host; probe red-a-with-host apps; probe red-a-with-host routes; down red-a-with-host
"$H/step.sh" red-remove-core "$H/dsh.sh" $S plugin --profile $P remove hanamesh-core
"$H/step.sh" red-dump-after-remove "$H/dsh.sh" $S --profile $P --dump-config
"$H/step.sh" red-after-remove-node-modules ls "$PR/node_modules/@hanamesh" "$PR/node_modules"
boot_once $S $P red-b-host-removed
