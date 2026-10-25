import type { ProgressEvent } from './types.js';
export interface DownloadCandidate {
    source: string;
    kind: 'https' | 'file';
    url: URL;
}
export interface DownloadOptions {
    item: string;
    /** Final path of the archive (inside staging). `.part` / `.part.json` live next to it. */
    file: string;
    expectedSha256: string;
    expectedSize?: number | undefined;
    onProgress?: ((e: ProgressEvent) => void) | undefined;
    signal?: AbortSignal | undefined;
}
/**
 * Try each candidate in order until one yields a file whose sha256 equals `expectedSha256`.
 * A transport failure keeps the `.part` for a later resume; a digest mismatch deletes the file.
 * Returns the source id that succeeded.
 */
export declare function downloadVerified(candidates: DownloadCandidate[], opts: DownloadOptions): Promise<string>;
