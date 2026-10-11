# Controlled owned socket-probe diagnostics (AH-06)

Set `HANAMESH_APPHOST_RUN_DIR` to an existing, isolated card-run directory to enable
`owned-lsof.jsonl`. Unset means no observers or diagnostic writes. This is an
engineering diagnostic switch, not a new launch configuration or public API.

The macOS readiness/socket-ownership stage retains the exact original lsof
arguments (`-nP -iTCP:<port> -sTCP:LISTEN -FpgLn`), 1000ms execFile timeout and
SIGTERM behavior. Group and exact loopback-listener parsing, readiness retries
and errors remain unchanged. Diagnostics never grant ownership.

Each child handle produces start/end records with PID, queried loopback port,
arguments, wall-clock timestamps, monotonic elapsed time, exit code, signal and
Node's `child.killed` fact (signal sent, not proof of termination). An exact-PID
ps observer records PGID; if the process exits too quickly or ps fails, PGID is
unknown and the reason is retained. Source/stage fields distinguish identity,
slow-window observation and execFile exit. No lsof output, process command lines,
credentials or environment values enter this log.

At 250ms, only if the owned probe is still alive, a single exact-PID ps command
collects `pid,pgid,stat,wchan`, bounded to 150ms and 4096 bytes. Probe exit cancels
the timer and sends SIGTERM only to still-live observer child handles. File
writes and observers are never awaited by the product readiness path. Sink
failures are ignored by that path; verify the directory is writable before use.

Observation limits: ps may fail, return no row, or provide no useful wait channel.
PID observation has a small OS scheduling/PID-reuse race after the live-handle
check; no follow-up observation targets a completed probe. No other process is
monitored or signalled. macOS sample help specifies duration in seconds and a
10-second default; stack collection is omitted because it cannot be assumed to
finish without interfering with the original 1000ms budget. ps state is evidence
of an observed wait, not a diagnosis of the historical cause.

The isolated slow Node child tests exercise diagnostic plumbing, timeout,
exit/signal retention and cleanup. They do not reproduce a slow lsof call.
AH-01 historical /health=200 then lsof timeout/SIGTERM evidence remains intact;
without natural reproduction its root cause remains NOT_REPRODUCED.
