import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ProvisionError } from './errors.js';
import { fsyncDir, sha256File } from './fsutil.js';
import { isInside, safeEntrySegments, safeLinkTarget } from './paths.js';
import { readTarGz } from './tar.js';
import { readZip } from './zip.js';
function unsafe(item, what, name) {
    return new ProvisionError('E_UNSAFE_PATH', `refusing archive entry (${what}): ${JSON.stringify(name)}`, { item });
}
/**
 * Extract an archive into `dest` (which must be empty or absent). Every entry is checked
 * before anything touches the disk: no absolute paths, no `..`, no symlink that resolves
 * outside `dest`, no write through a symlinked ancestor. Returns the ownership lists.
 */
export async function extractArchive(kind, archive, dest, opts) {
    const { item } = opts;
    const strip = opts.strip ?? 0;
    const destAbs = path.resolve(dest);
    await fs.mkdir(destAbs, { recursive: true });
    const files = [];
    const dirs = new Set();
    const symlinks = [];
    const symlinkPaths = new Set();
    const filePaths = new Map(); // rel -> abs (for hardlinks)
    let entries = 0;
    const entryStream = kind === 'tar.gz' ? readTarGz(archive, item) : readZip(archive, item);
    const ensureNoSymlinkAncestor = (segments, name) => {
        for (let i = 1; i < segments.length; i++) {
            if (symlinkPaths.has(segments.slice(0, i).join('/')))
                throw unsafe(item, 'write through symlink', name);
        }
    };
    const resolveDest = (segments, name) => {
        const abs = path.join(destAbs, ...segments);
        if (!isInside(destAbs, abs) || abs === destAbs)
            throw unsafe(item, 'escapes destination', name);
        return abs;
    };
    for await (const entry of entryStream) {
        entries++;
        const rawSegments = safeEntrySegments(entry.name);
        if (rawSegments === null)
            throw unsafe(item, 'absolute or traversal path', entry.name);
        if (rawSegments.length <= strip) {
            // Stripped away entirely (e.g. the top-level directory). Body drained by the reader.
            for await (const _ of entry.body) {
                /* drain */
            }
            continue;
        }
        const segments = rawSegments.slice(strip);
        const rel = segments.join('/');
        ensureNoSymlinkAncestor(segments, entry.name);
        const abs = resolveDest(segments, entry.name);
        switch (entry.kind) {
            case 'dir': {
                await fs.mkdir(abs, { recursive: true });
                dirs.add(rel);
                break;
            }
            case 'file': {
                await fs.mkdir(path.dirname(abs), { recursive: true });
                for (let i = 1; i < segments.length; i++)
                    dirs.add(segments.slice(0, i).join('/'));
                const mode = (entry.mode & 0o777) || 0o644;
                const handle = await fs.open(abs, 'wx', mode);
                const hash = createHash('sha256');
                let size = 0;
                try {
                    for await (const chunk of entry.body) {
                        hash.update(chunk);
                        await handle.write(chunk);
                        size += chunk.length;
                    }
                    // No per-file fsync: it costs ~20 s for a Node tree on APFS and buys nothing against
                    // process termination (the level X02 proves). Power-loss corruption is caught by
                    // `verify` through the per-file digests in the ownership manifest.
                }
                finally {
                    await handle.close();
                }
                if (process.platform !== 'win32')
                    await fs.chmod(abs, mode);
                files.push({ path: rel, size, sha256: hash.digest('hex'), mode });
                filePaths.set(rel, abs);
                break;
            }
            case 'symlink': {
                const target = entry.linkTarget ?? '';
                const resolved = safeLinkTarget(segments, target);
                /* MUTATION:symlink-escape */
                if (resolved === null)
                    throw unsafe(item, `symlink escapes destination (-> ${target})`, entry.name);
                await fs.mkdir(path.dirname(abs), { recursive: true });
                for (let i = 1; i < segments.length; i++)
                    dirs.add(segments.slice(0, i).join('/'));
                await fs.symlink(target.split(/[\\/]+/).join(path.sep), abs);
                symlinks.push({ path: rel, target });
                symlinkPaths.add(rel);
                break;
            }
            case 'hardlink': {
                const targetSegments = safeEntrySegments(entry.linkTarget ?? '');
                if (targetSegments === null || targetSegments.length <= strip)
                    throw unsafe(item, 'hardlink target', entry.name);
                const targetRel = targetSegments.slice(strip).join('/');
                const src = filePaths.get(targetRel);
                if (src === undefined)
                    throw unsafe(item, 'hardlink to unknown file', entry.name);
                await fs.mkdir(path.dirname(abs), { recursive: true });
                await fs.copyFile(src, abs);
                const st = await fs.stat(abs);
                files.push({ path: rel, size: st.size, sha256: await sha256File(abs), mode: st.mode & 0o777 });
                filePaths.set(rel, abs);
                break;
            }
        }
        opts.onProgress?.({ item, phase: 'extract', bytes: entries });
    }
    await fsyncDir(destAbs);
    return { files, dirs: [...dirs].sort(), symlinks };
}
