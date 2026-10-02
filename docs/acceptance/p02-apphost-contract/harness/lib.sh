# helpers sourced by scenario scripts
. "$(dirname "${BASH_SOURCE[0]}")/env.sh"; export RUN
H=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
up() { touch "$RUN/$3.hold"; ("$H/boot.sh" $1 $2 $PORT $3 0 &); for i in $(seq 1 150); do [ -f "$RUN/$3.up" ] && return 0; tail -1 "$EVID/logs/boot-summary.log" | grep -q "$3 web_up=NO" && return 1; sleep 0.5; done; return 1; }
down() { rm -f "$RUN/$1.hold"; for i in $(seq 1 60); do [ -f "$RUN/$1.up" ] || return 0; sleep 0.5; done; }
probe() { "$NODE" "$H/probe.mjs" $1 $PORT "${@:2}" | tee -a "$EVID/logs/probes.jsonl"; }
boot_once() { "$H/boot.sh" $1 $2 $PORT $3 0; }
