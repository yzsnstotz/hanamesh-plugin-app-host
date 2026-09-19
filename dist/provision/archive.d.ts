/** Common archive entry shape shared by the tar.gz and zip readers. */
export type EntryKind = 'file' | 'dir' | 'symlink' | 'hardlink';
export interface ArchiveEntry {
    kind: EntryKind;
    /** Raw entry name as stored in the archive (unsafe until checked). */
    name: string;
    /** POSIX mode bits; 0 when the archive has none. */
    mode: number;
    size: number;
    /** Symlink / hardlink target as stored. */
    linkTarget?: string;
    /** File body. Must be fully consumed before the next entry is requested. */
    body: AsyncIterable<Uint8Array>;
}
/** Pull exact byte counts out of a chunk stream (used by the tar reader). */
export declare class ByteReader {
    private readonly it;
    private buffered;
    private bufferedLength;
    private done;
    constructor(source: AsyncIterable<Uint8Array>);
    private fill;
    /** Read exactly `n` bytes; returns fewer only at EOF. */
    read(n: number): Promise<Uint8Array>;
    /** Yield exactly `n` bytes as chunks. Throws on premature EOF. */
    stream(n: number): AsyncGenerator<Uint8Array>;
    skip(n: number): Promise<void>;
}
