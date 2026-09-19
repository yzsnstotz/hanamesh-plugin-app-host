const ENV = 'HANAMESH_PROVISION_KILL_AT';
export function checkpoint(name) {
    const want = process.env[ENV];
    if (want === undefined || want !== name)
        return;
    killSelf(name);
}
export function downloadCheckpoint(bytes) {
    const want = process.env[ENV];
    if (want === undefined || !want.startsWith('download@'))
        return;
    const threshold = Number(want.slice('download@'.length));
    if (Number.isFinite(threshold) && bytes >= threshold)
        killSelf(want);
}
function killSelf(name) {
    process.stderr.write(`[hanamesh-provision] kill injected at ${name}\n`);
    process.kill(process.pid, 'SIGKILL');
    // SIGKILL is not deliverable to ourselves synchronously on every platform; block until it lands.
    for (;;) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
    }
}
