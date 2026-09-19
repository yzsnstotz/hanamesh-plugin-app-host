import type { ArchiveEntry } from './archive.js';
export declare function crc32Update(crc: number, buf: Uint8Array): number;
/** Read a zip via its central directory (the only trustworthy index). Store and deflate only. */
export declare function readZip(file: string, item: string): AsyncGenerator<ArchiveEntry>;
