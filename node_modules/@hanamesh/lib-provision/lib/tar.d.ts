import { type ArchiveEntry } from './archive.js';
/**
 * Minimal streaming ustar/GNU/pax reader over a gzip stream. Supports regular files,
 * directories, symlinks, hardlinks, GNU long names/links and pax path/linkpath/size.
 * Anything else is refused with `E_ARCHIVE`.
 */
export declare function readTarGz(file: string, item: string): AsyncGenerator<ArchiveEntry>;
