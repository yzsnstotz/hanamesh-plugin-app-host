/**
 * Crash-injection checkpoints for consistency tests (CONSISTENCY.md X02/X03).
 *
 * Set `HANAMESH_PROVISION_KILL_AT=<name>` to SIGKILL the current process the
 * first time that checkpoint is reached, or `download@<bytes>` to kill once the
 * download has written at least that many bytes. Every checkpoint sits *after*
 * the durability point of the step it names (file closed / fsync'd / rename returned),
 * never after a merely resolved promise.
 */
export type CheckpointName = 'after-download' | 'after-sha256' | 'after-extract' | 'after-check' | 'after-manifest-temp' | 'after-trash' | 'after-manifest' | 'after-rename' | 'after-ledger';
export declare function checkpoint(name: CheckpointName): void;
export declare function downloadCheckpoint(bytes: number): void;
