import fs from 'node:fs/promises';
import path from 'node:path';
import { runCheck } from './check.js';
import { checkpoint } from './checkpoints.js';
import { downloadVerified } from './download.js';
import { ProvisionError } from './errors.js';
import { extractArchive } from './extract.js';
import { exists, fsyncDir, readJson, rmrf, sha256File, writeFileAtomic } from './fsutil.js';
import { ledger, ownershipPath, pendingDir, provisionDir, readOwnership, stagingDir, targetPath, trashRoot, writeLedger } from './ledger.js';
import { resolveCandidates, validateManifest } from './manifest.js';
import { externalPath, isInside } from './paths.js';
import { platformKey } from './platform.js';
function selectItems(manifest, only) {
    if (only === undefined)
        return manifest.items;
    const byId = new Map(manifest.items.map((i) => [i.id, i]));
    return only.map((id) => {
        const it = byId.get(id);
        if (it === undefined)
            throw new ProvisionError('E_MANIFEST', `unknown item id "${id}"`, { item: id });
        return it;
    });
}
/** Pure planning against the ledger: what would `provision` do for each item. */
export async function plan(manifestInput, options) {
    const manifest = validateManifest(manifestInput);
    const root = externalPath(options.root);
    const platform = options.platform ?? platformKey();
    const book = await ledger(root);
    const out = [];
    for (const item of selectItems(manifest, options.only)) {
        const target = targetPath(root, item.installTo);
        const asset = item.platforms[platform];
        const current = book.items[item.id];
        if (asset === undefined) {
            const e = { item: item.id, version: item.version, platform, target, state: 'unsupported' };
            if (current !== undefined)
                e.current = current;
            out.push(e);
            continue;
        }
        let state = 'absent';
        if (current !== undefined)
            state = current.sha256 === asset.sha256 && current.platform === platform && (await exists(target)) ? 'installed' : 'stale';
        const e = { item: item.id, version: item.version, platform, asset: asset.asset, sha256: asset.sha256, target, state };
        if (current !== undefined)
            e.current = current;
        out.push(e);
    }
    return out;
}
/** Download → sha256 → extract → check → atomic promote → ledger, item by item. */
export async function provision(manifestInput, options) {
    const manifest = validateManifest(manifestInput);
    const root = externalPath(options.root);
    const platform = options.platform ?? platformKey();
    await fs.mkdir(provisionDir(root), { recursive: true });
    const results = [];
    for (const item of selectItems(manifest, options.only)) {
        if (options.signal?.aborted)
            throw new ProvisionError('E_ABORTED', 'aborted by caller', { item: item.id });
        const target = targetPath(root, item.installTo);
        const asset = item.platforms[platform];
        if (asset === undefined) {
            results.push({ item: item.id, version: item.version, platform, target, action: 'unsupported' });
            continue;
        }
        const book = await ledger(root);
        const current = book.items[item.id];
        if (!options.force && current !== undefined && current.sha256 === asset.sha256 && current.platform === platform && (await exists(target))) {
            results.push({ item: item.id, version: item.version, platform, target, action: 'skipped', sha256: asset.sha256, source: current.source });
            continue;
        }
        const source = await provisionItem(manifest, item, asset, root, platform, options);
        results.push({ item: item.id, version: item.version, platform, target, action: 'installed', sha256: asset.sha256, source });
    }
    return results;
}
async function provisionItem(manifest, item, asset, root, platform, options) {
    const staging = stagingDir(root, item.id, asset.sha256);
    if (!isInside(root, staging))
        throw new ProvisionError('E_PROMOTE', 'staging escapes root', { item: item.id });
    const archive = path.join(staging, path.basename(asset.asset));
    const tree = path.join(staging, 'tree');
    const target = targetPath(root, item.installTo);
    const onProgress = options.onProgress;
    await fs.mkdir(staging, { recursive: true });
    await rmrf(tree); // a half-extracted tree from a killed run is never trusted
    try {
        const candidates = resolveCandidates(manifest, asset, options.sourceOrder);
        const source = await downloadVerified(candidates, {
            item: item.id,
            file: archive,
            expectedSha256: asset.sha256,
            expectedSize: asset.size,
            onProgress,
            signal: options.signal,
        });
        onProgress?.({ item: item.id, phase: 'extract' });
        const extracted = await extractArchive(item.kind, archive, tree, { item: item.id, strip: asset.strip, onProgress });
        checkpoint('after-extract');
        if (item.verify !== undefined) {
            onProgress?.({ item: item.id, phase: 'check' });
            await runCheck(tree, item.verify, item.id);
            checkpoint('after-check');
        }
        const ownership = {
            schema: 1,
            item: item.id,
            version: item.version,
            platform,
            sha256: asset.sha256,
            source,
            installTo: item.installTo,
            files: extracted.files,
            dirs: extracted.dirs,
            symlinks: extracted.symlinks,
        };
        onProgress?.({ item: item.id, phase: 'promote' });
        await promote(root, item, ownership, tree, target, options.force === true);
        await rmrf(staging);
        return source;
    }
    catch (err) {
        const keepPartial = err instanceof ProvisionError && (err.code === 'E_DOWNLOAD' || err.code === 'E_ABORTED');
        if (keepPartial)
            await rmrf(tree);
        else
            await rmrf(staging);
        throw err;
    }
}
/**
 * Atomic promotion. Order (each step durable before the next):
 *   pending record → ownership manifest (temp) → old target+manifest to trash →
 *   manifest temp → final → rename(tree → target) → ledger → drop trash + pending.
 * Any failure before the tree rename restores the old target from trash.
 */
async function promote(root, item, ownership, tree, target, force) {
    const manifestFile = ownershipPath(target);
    const manifestNext = manifestFile + '.next';
    const pending = path.join(pendingDir(root), `${item.id}.json`);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const trash = path.join(trashRoot(root), `${stamp}-${item.id}`);
    const oldTarget = path.join(trash, 'tree');
    const oldManifest = path.join(trash, 'manifest.json');
    const targetExists = await exists(target);
    const oldOwnership = await readOwnership(target);
    if (targetExists && oldOwnership === undefined && !force) {
        throw new ProvisionError('E_PROMOTE', `target exists but has no ownership manifest; refusing to replace unmanaged data at ${target} (use force)`, { item: item.id });
    }
    if (!isInside(root, target))
        throw new ProvisionError('E_PROMOTE', 'target escapes root', { item: item.id });
    const record = { item: item.id, installTo: item.installTo, version: item.version, sha256: ownership.sha256, startedAt: new Date().toISOString() };
    await writeFileAtomic(pending, JSON.stringify(record));
    await writeFileAtomic(manifestNext, JSON.stringify(ownership, null, 2) + '\n');
    checkpoint('after-manifest-temp');
    let movedTarget = false;
    let movedManifest = false;
    try {
        if (targetExists || (await exists(manifestFile))) {
            await fs.mkdir(trash, { recursive: true });
            if (targetExists) {
                await fs.rename(target, oldTarget);
                movedTarget = true;
            }
            if (await exists(manifestFile)) {
                await fs.rename(manifestFile, oldManifest);
                movedManifest = true;
            }
            await fsyncDir(path.dirname(target));
            checkpoint('after-trash');
        }
        await fs.rename(manifestNext, manifestFile);
        await fsyncDir(path.dirname(manifestFile));
        /* MUTATION:ledger-before-rename */
        checkpoint('after-manifest');
        await fs.mkdir(path.dirname(target), { recursive: true });
        try {
            await fs.rename(tree, target);
        }
        catch (err) {
            const code = err.code;
            throw new ProvisionError('E_PROMOTE', code === 'EXDEV' ? `staging and target are on different devices; refusing to copy (${target})` : `rename to target failed: ${err.message}`, { item: item.id, cause: err });
        }
        await fsyncDir(path.dirname(target));
        checkpoint('after-rename');
    }
    catch (err) {
        // Restore the previous state: new manifest out, old tree/manifest back.
        await fs.rm(manifestNext, { force: true });
        await fs.rm(manifestFile, { force: true }).catch(() => undefined);
        if (movedTarget)
            await fs.rename(oldTarget, target).catch(() => undefined);
        if (movedManifest)
            await fs.rename(oldManifest, manifestFile).catch(() => undefined);
        await rmrf(trash);
        await fs.rm(pending, { force: true });
        throw err;
    }
    const book = await ledger(root);
    const entry = {
        version: item.version,
        sha256: ownership.sha256,
        platform: ownership.platform,
        installedAt: new Date().toISOString(),
        target,
        installTo: item.installTo,
        source: ownership.source,
    };
    book.items[item.id] = entry;
    await writeLedger(root, book);
    checkpoint('after-ledger');
    await rmrf(trash);
    await fs.rm(pending, { force: true });
}
/** Delete exactly what the ownership manifest lists; anything else in the target is left alone. */
export async function remove(itemId, options) {
    const root = externalPath(options.root);
    const book = await ledger(root);
    const entry = book.items[itemId];
    if (entry === undefined)
        throw new ProvisionError('E_NOT_INSTALLED', `item "${itemId}" is not in the ledger`, { item: itemId });
    const target = targetPath(root, entry.installTo);
    if (!isInside(root, target))
        throw new ProvisionError('E_PROMOTE', 'target escapes root', { item: itemId });
    const ownership = await readOwnership(target);
    if (ownership === undefined) {
        throw new ProvisionError('E_NOT_INSTALLED', `ownership manifest missing for "${itemId}" (${ownershipPath(target)}); refusing to delete anything — run verify`, { item: itemId });
    }
    let removedFiles = 0;
    let removedSymlinks = 0;
    let removedDirs = 0;
    const unlink = async (rel) => {
        const abs = path.join(target, ...rel.split('/'));
        if (!isInside(target, abs))
            return false;
        try {
            await fs.unlink(abs);
            return true;
        }
        catch (err) {
            if (err.code === 'ENOENT')
                return false;
            throw err;
        }
    };
    for (const f of ownership.files)
        if (await unlink(f.path))
            removedFiles++;
    for (const s of ownership.symlinks)
        if (await unlink(s.path))
            removedSymlinks++;
    const dirs = [...ownership.dirs].sort((a, b) => b.length - a.length);
    for (const d of dirs) {
        const abs = path.join(target, ...d.split('/'));
        if (!isInside(target, abs))
            continue;
        try {
            await fs.rmdir(abs);
            removedDirs++;
        }
        catch {
            /* not empty (something we do not own) or already gone */
        }
    }
    try {
        await fs.rmdir(target);
        removedDirs++;
    }
    catch {
        /* leftovers we do not own */
    }
    const kept = await listTree(target);
    await fs.rm(ownershipPath(target), { force: true });
    delete book.items[itemId];
    await writeLedger(root, book);
    return { item: itemId, target, removedFiles, removedSymlinks, removedDirs, kept };
}
async function listTree(dir) {
    const out = [];
    const walk = async (d, rel) => {
        let entries;
        try {
            entries = await fs.readdir(d, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const e of entries) {
            const r = rel === '' ? e.name : `${rel}/${e.name}`;
            if (e.isDirectory())
                await walk(path.join(d, e.name), r);
            else
                out.push(r);
        }
    };
    await walk(dir, '');
    return out.sort();
}
async function checkTree(target, m) {
    for (const f of m.files) {
        const abs = path.join(target, ...f.path.split('/'));
        let st;
        try {
            st = await fs.lstat(abs);
        }
        catch {
            return `missing file ${f.path}`;
        }
        if (!st.isFile())
            return `not a regular file: ${f.path}`;
        if (st.size !== f.size)
            return `size mismatch ${f.path}: ${st.size} != ${f.size}`;
        if ((await sha256File(abs)) !== f.sha256)
            return `sha256 mismatch ${f.path}`;
    }
    for (const s of m.symlinks) {
        const abs = path.join(target, ...s.path.split('/'));
        try {
            const st = await fs.lstat(abs);
            if (!st.isSymbolicLink())
                return `not a symlink: ${s.path}`;
        }
        catch {
            return `missing symlink ${s.path}`;
        }
    }
    return undefined;
}
/**
 * Recompute every installed item's digests against its ownership manifest and reconcile the
 * ledger with what is really on disk. Repairs the state left by a kill between
 * `rename(tree → target)` and the ledger write, and restores an old tree left in trash.
 */
export async function verify(options) {
    const root = externalPath(options.root);
    const book = await ledger(root);
    const items = [];
    const cleaned = [];
    const pdir = pendingDir(root);
    const pendings = new Map();
    try {
        for (const name of await fs.readdir(pdir)) {
            const rec = await readJson(path.join(pdir, name));
            if (rec !== undefined && typeof rec.installTo === 'string')
                pendings.set(rec.item, rec);
        }
    }
    catch {
        /* no pending dir */
    }
    const trashDirs = new Map();
    try {
        for (const name of await fs.readdir(trashRoot(root))) {
            const m = /^\d{4}-\d{2}-\d{2}T[\d-]+Z-(.+)$/.exec(name);
            if (m === null)
                continue;
            const list = trashDirs.get(m[1]) ?? [];
            list.push(path.join(trashRoot(root), name));
            trashDirs.set(m[1], list);
        }
    }
    catch {
        /* no trash */
    }
    const ids = new Set([...Object.keys(book.items), ...pendings.keys()]);
    let ledgerDirty = false;
    for (const id of [...ids].sort()) {
        const entry = book.items[id];
        const installTo = entry?.installTo ?? pendings.get(id).installTo;
        const target = targetPath(root, installTo);
        const manifestFile = ownershipPath(target);
        const next = manifestFile + '.next';
        if (await exists(next)) {
            await fs.rm(next, { force: true });
            cleaned.push(next);
        }
        const trashes = (trashDirs.get(id) ?? []).sort();
        let targetExists = await exists(target);
        if (!targetExists) {
            // A kill between "old to trash" and "tree to target": bring the old version back.
            const last = trashes.at(-1);
            if (last !== undefined && (await exists(path.join(last, 'tree')))) {
                await fs.mkdir(path.dirname(target), { recursive: true });
                await fs.rename(path.join(last, 'tree'), target);
                await fs.rm(manifestFile, { force: true });
                if (await exists(path.join(last, 'manifest.json')))
                    await fs.rename(path.join(last, 'manifest.json'), manifestFile);
                await fsyncDir(path.dirname(target));
                cleaned.push(`${last} (restored)`);
                targetExists = true;
            }
        }
        let ownership;
        try {
            ownership = await readOwnership(target);
        }
        catch (err) {
            items.push({ item: id, target, state: 'corrupt', detail: err.message });
            continue;
        }
        if (!targetExists) {
            if (ownership !== undefined) {
                await fs.rm(manifestFile, { force: true });
                cleaned.push(manifestFile);
            }
            if (entry !== undefined) {
                delete book.items[id];
                ledgerDirty = true;
            }
            items.push({ item: id, target, state: 'missing', detail: entry === undefined ? 'pending install never landed' : 'target gone; ledger entry dropped' });
        }
        else if (ownership === undefined) {
            items.push({ item: id, target, state: 'unmanaged', detail: 'target exists without an ownership manifest; nothing touched' });
            continue;
        }
        else {
            const problem = await checkTree(target, ownership);
            if (problem !== undefined) {
                items.push({ item: id, target, state: 'corrupt', detail: problem, version: ownership.version, sha256: ownership.sha256 });
                continue;
            }
            if (entry === undefined || entry.sha256 !== ownership.sha256 || entry.version !== ownership.version || entry.platform !== ownership.platform || entry.installTo !== ownership.installTo) {
                book.items[id] = {
                    version: ownership.version,
                    sha256: ownership.sha256,
                    platform: ownership.platform,
                    installedAt: entry?.installedAt ?? new Date().toISOString(),
                    target,
                    installTo: ownership.installTo,
                    source: ownership.source,
                };
                ledgerDirty = true;
                items.push({ item: id, target, state: 'repaired', detail: entry === undefined ? 'ledger entry written from ownership manifest' : 'ledger entry updated from ownership manifest', version: ownership.version, sha256: ownership.sha256 });
            }
            else {
                items.push({ item: id, target, state: 'ok', version: ownership.version, sha256: ownership.sha256 });
            }
        }
        for (const t of trashes) {
            await rmrf(t);
            cleaned.push(t);
        }
        if (pendings.has(id)) {
            await fs.rm(path.join(pdir, `${id}.json`), { force: true });
            cleaned.push(`pending:${id}`);
        }
    }
    if (ledgerDirty)
        await writeLedger(root, book);
    const ok = items.every((i) => i.state === 'ok' || i.state === 'repaired');
    return { root, items, ok, cleaned };
}
