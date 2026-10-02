#!/bin/bash
# usage: step.sh <tag> <command...> — runs the command, keeps its full output in logs/<tag>.log and the real exit code in logs/steps.log
. "$(dirname "$0")/env.sh"
TAG=$1; shift
{ echo "\$ $*"; "$@"; } > "$EVID/logs/$TAG.log" 2>&1; rc=$?
echo "$(date -u +%FT%TZ) $TAG rc=$rc :: $*" | sed "s#$RUN#\$RUN#g" | tee -a "$EVID/logs/steps.log"; exit $rc
