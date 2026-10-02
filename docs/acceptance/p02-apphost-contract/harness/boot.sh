#!/bin/bash
# usage: boot.sh <scenario> <profile> <port> <tag> [hold-seconds]
# Boots `dsh --profile P --no-open --port N`; "web up" = DSH printed its web URL and the port answers HTTP (401 without the
# session token is the authenticated web app answering). Records the real exit code. While up, the caller may probe using
# $RUN/<tag>.url (raw, 0600, holds the session token); touch $RUN/<tag>.hold to keep it running. Evidence log is token-redacted.
. "$(dirname "$0")/env.sh"
umask 077
S=$1; P=$2; PORT=$3; TAG=$4; HOLD=${5:-0}; RAW="$RUN/$TAG.raw.log"; LOG="$EVID/logs/$TAG.boot.log"
"$(dirname "$0")/dsh.sh" $S --profile $P --no-open --port $PORT > "$RAW" 2>&1 & pid=$!
up=0; for i in $(seq 1 240); do
  if ! kill -0 $pid 2>/dev/null; then break; fi
  if grep -q '^dsh web: http' "$RAW"; then code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/ || true)
    if [ "$code" != 000 ]; then up=1; break; fi; fi; sleep 0.5
done
if [ $up = 1 ]; then
  grep -m1 -o 'http://127.0.0.1:[0-9]*/?token=[A-Za-z0-9_-]*' "$RAW" > "$RUN/$TAG.url"
  echo "$(date -u +%FT%TZ) $TAG web_up port=$PORT root_without_token=$code" | tee -a "$EVID/logs/boot-summary.log"; echo $pid > "$RUN/$TAG.up"
  sleep "$HOLD"; while [ -f "$RUN/$TAG.hold" ]; do sleep 1; done
  kill -INT $pid; wait $pid; rc=$?; echo "$(date -u +%FT%TZ) $TAG stopped_by=SIGINT rc=$rc" | tee -a "$EVID/logs/boot-summary.log"
else
  wait $pid; rc=$?; echo "$(date -u +%FT%TZ) $TAG web_up=NO exit_rc=$rc" | tee -a "$EVID/logs/boot-summary.log"
fi
sed -E 's/token=[A-Za-z0-9_-]+/token=<redacted>/g' "$RAW" > "$LOG"; rm -f "$RUN/$TAG.up"
