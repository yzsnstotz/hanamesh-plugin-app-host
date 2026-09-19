/**
 * Public types of @hanamesh/lib-provision.
 *
 * The manifest is authored by the caller; this library only executes it.
 * Nothing here is ever guessed from the host machine except the platform key.
 */
/** Normalised `${process.platform}-${process.arch}` (e.g. `darwin-arm64`). */
export type PlatformKey = string;
export type SourceKind = 'https' | 'file';
export interface ManifestSource {
    /** Stable id, referenced by `sourceOrder` / `--source`. */
    id: string;
    kind: SourceKind;
    /** Base URL. `https:` or `file:` only. Item assets are resolved relative to it. */
    base: string;
}
export type ArchiveKind = 'tar.gz' | 'zip';
export interface PlatformAsset {
    /** File name (or relative path) appended to each source base, unless `url` is given. */
    asset: string;
    /** Lower-case hex sha256 of the archive. Mandatory: an item without it is refused. */
    sha256: string;
    /** Expected byte size (informational; used for progress totals and sanity checks). */
    size?: number;
    /** Leading path components to strip on extraction (like `tar --strip-components`). */
    strip?: number;
    /** Absolute `https:`/`file:` URL overriding `sources` resolution for this asset. */
    url?: string;
}
export interface VerifySpec {
    /** Path inside the extracted tree (after strip) of the executable to run. */
    exec: string;
    args?: string[];
    /** Exact expected stdout (trimmed). Omit to only require exit code 0. */
    expect?: string;
    /** Timeout in ms (default 60000). */
    timeoutMs?: number;
}
export interface ManifestItem {
    id: string;
    version: string;
    kind: ArchiveKind;
    /** Target directory relative to root (POSIX separators). */
    installTo: string;
    platforms: Record<PlatformKey, PlatformAsset>;
    verify?: VerifySpec;
}
export interface Manifest {
    schema: 1;
    sources: ManifestSource[];
    items: ManifestItem[];
}
export type PlanState = 'absent' | 'installed' | 'stale' | 'unsupported';
export interface PlanEntry {
    item: string;
    version: string;
    platform: PlatformKey;
    /** Undefined when `state === 'unsupported'`. */
    asset?: string;
    sha256?: string;
    /** Absolute target path (external form, never `\\?\`-prefixed). */
    target: string;
    state: PlanState;
    /** Ledger entry currently recorded for this item, if any. */
    current?: LedgerEntry;
}
export interface LedgerEntry {
    version: string;
    sha256: string;
    platform: PlatformKey;
    /** ISO-8601 timestamp. */
    installedAt: string;
    /** Absolute target path at install time (external form). */
    target: string;
    /** `installTo` relative to root; this is what `verify`/`remove` resolve against. */
    installTo: string;
    /** Source id (or `url` when the asset carried its own URL). */
    source: string;
}
export interface Ledger {
    schema: 1;
    items: Record<string, LedgerEntry>;
}
export interface OwnedFile {
    /** Relative POSIX path inside the target. */
    path: string;
    size: number;
    sha256: string;
    /** POSIX mode bits (0o777 mask). */
    mode: number;
}
export interface OwnedSymlink {
    path: string;
    target: string;
}
/** `<target>.manifest.json` — the deletion authority for `remove`. */
export interface OwnershipManifest {
    schema: 1;
    item: string;
    version: string;
    platform: PlatformKey;
    /** sha256 of the archive this tree came from. */
    sha256: string;
    source: string;
    installTo: string;
    files: OwnedFile[];
    dirs: string[];
    symlinks: OwnedSymlink[];
}
export type ProgressPhase = 'download' | 'verify' | 'extract' | 'check' | 'promote';
export interface ProgressEvent {
    item: string;
    phase: ProgressPhase;
    bytes?: number | undefined;
    total?: number | undefined;
    /** Source id in use (download phase). */
    source?: string | undefined;
    /** Free-form note (e.g. `resume`, `source-failed`), never containing URL queries. */
    note?: string | undefined;
}
export interface ProvisionOptions {
    root: string;
    platform?: PlatformKey;
    onProgress?: (event: ProgressEvent) => void;
    signal?: AbortSignal;
    /** Source ids to try, in order. Unlisted sources are not used. Default: manifest order. */
    sourceOrder?: string[];
    /** Restrict to these item ids. */
    only?: string[];
    /** Re-install even when the ledger says the same sha256 is installed. */
    force?: boolean;
}
export interface PlanOptions {
    root: string;
    platform?: PlatformKey;
    only?: string[];
}
export type ProvisionAction = 'installed' | 'skipped' | 'unsupported';
export interface ProvisionResult {
    item: string;
    version: string;
    platform: PlatformKey;
    target: string;
    action: ProvisionAction;
    sha256?: string;
    source?: string;
}
export interface RemoveResult {
    item: string;
    target: string;
    removedFiles: number;
    removedSymlinks: number;
    removedDirs: number;
    /** Paths that were present in the target but not in the ownership manifest; left untouched. */
    kept: string[];
}
export type VerifyState = 'ok' | 'repaired' | 'missing' | 'corrupt' | 'unmanaged';
export interface VerifyItem {
    item: string;
    target: string;
    state: VerifyState;
    /** Human-readable detail (what was repaired / which file mismatched). */
    detail?: string;
    version?: string;
    sha256?: string;
}
export interface VerifyResult {
    root: string;
    items: VerifyItem[];
    /** True when every item is `ok` or `repaired`. */
    ok: boolean;
    /** Leftovers cleaned under `.provision/` (staging, trash, temp files). */
    cleaned: string[];
}
