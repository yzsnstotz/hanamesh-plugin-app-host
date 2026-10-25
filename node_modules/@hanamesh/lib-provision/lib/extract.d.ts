import type { ArchiveKind, OwnedFile, OwnedSymlink, ProgressEvent } from './types.js';
export interface ExtractOptions {
    item: string;
    strip?: number | undefined;
    onProgress?: ((e: ProgressEvent) => void) | undefined;
}
export interface ExtractedTree {
    files: OwnedFile[];
    dirs: string[];
    symlinks: OwnedSymlink[];
}
/**
 * Extract an archive into `dest` (which must be empty or absent). Every entry is checked
 * before anything touches the disk: no absolute paths, no `..`, no symlink that resolves
 * outside `dest`, no write through a symlinked ancestor. Returns the ownership lists.
 */
export declare function extractArchive(kind: ArchiveKind, archive: string, dest: string, opts: ExtractOptions): Promise<ExtractedTree>;
