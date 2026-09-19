import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkpoint, downloadCheckpoint } from './checkpoints.js';
import { ProvisionError } from './errors.js';
import { exists, fsyncDir, readJson, sha256File, writeFileAtomic } from './fsutil.js';
import { redactUrl } from './paths.js';
const MAX_REDIRECTS = 10;
function abortError(item) {
    return new ProvisionError('E_ABORTED', 'aborted by caller', { item });
}
/**
 * Try each candidate in order until one yields a file whose sha256 equals `expectedSha256`.
 * A transport failure keeps the `.part` for a later resume; a digest mismatch deletes the file.
 * Returns the source id that succeeded.
 */
export async function downloadVerified(candidates, opts) {
    const { item, file, expectedSha256, onProgress } = opts;
    let lastError;
    if (await exists(file)) {
        // A fully downloaded archive from an earlier run; trust it only if the digest matches.
        if ((await sha256File(file)) === expectedSha256) {
            onProgress?.({ item, phase: 'verify', note: 'reused' });
            const meta = await readJson(file + '.json');
            return meta?.url !== undefined ? candidates.find((c) => redactUrl(c.url.toString()) === meta.url)?.source ?? 'cached' : 'cached';
        }
        await fs.rm(file, { force: true });
    }
    for (const candidate of candidates) {
        if (opts.signal?.aborted)
            throw abortError(item);
        try {
            await downloadOne(candidate, opts);
        }
        catch (err) {
            if (err instanceof ProvisionError && err.code === 'E_ABORTED')
                throw err;
            lastError = err instanceof ProvisionError ? err : new ProvisionError('E_DOWNLOAD', `download failed from ${candidate.source}: ${err.message}`, { item, cause: err });
            onProgress?.({ item, phase: 'download', source: candidate.source, note: `source-failed: ${lastError.message}` });
            continue;
        }
        onProgress?.({ item, phase: 'verify', source: candidate.source });
        const actual = await sha256File(file);
        /* MUTATION:sha256-compare */
        if (actual !== expectedSha256) {
            await fs.rm(file, { force: true });
            await fs.rm(file + '.json', { force: true });
            lastError = new ProvisionError('E_SHA256', `sha256 mismatch from source ${candidate.source}: expected ${expectedSha256}, got ${actual}`, { item });
            onProgress?.({ item, phase: 'verify', source: candidate.source, note: 'sha256-mismatch' });
            continue;
        }
        checkpoint('after-sha256');
        return candidate.source;
    }
    throw lastError ?? new ProvisionError('E_SOURCE', 'no download candidates', { item });
}
async function downloadOne(candidate, opts) {
    const { item, file, onProgress } = opts;
    const part = file + '.part';
    const metaFile = file + '.part.json';
    await fs.mkdir(path.dirname(file), { recursive: true });
    const cleanUrl = redactUrl(candidate.url.toString());
    if (candidate.kind === 'file') {
        await copyFromFileUrl(candidate, part, opts);
    }
    else {
        await fetchHttps(candidate, part, metaFile, opts);
    }
    // Durability point of the download: bytes on disk, then the atomic rename to the final name.
    const h = await fs.open(part, 'r+');
    try {
        await h.sync();
    }
    finally {
        await h.close();
    }
    await fs.rename(part, file);
    await writeFileAtomic(file + '.json', JSON.stringify({ url: cleanUrl, source: candidate.source }));
    await fs.rm(metaFile, { force: true });
    await fsyncDir(path.dirname(file));
    checkpoint('after-download');
    onProgress?.({ item, phase: 'download', source: candidate.source, note: 'complete' });
}
async function copyFromFileUrl(candidate, part, opts) {
    const { item, onProgress, signal } = opts;
    const src = fileURLToPath(candidate.url);
    let total;
    try {
        total = (await fs.stat(src)).size;
    }
    catch (err) {
        throw new ProvisionError('E_DOWNLOAD', `file source unreadable: ${redactUrl(candidate.url.toString())}`, { item, cause: err });
    }
    const out = await fs.open(part, 'w');
    let bytes = 0;
    try {
        for await (const chunk of createReadStream(src, { highWaterMark: 1 << 20 })) {
            if (signal?.aborted)
                throw abortError(item);
            await out.write(chunk);
            bytes += chunk.length;
            onProgress?.({ item, phase: 'download', source: candidate.source, bytes, total });
            downloadCheckpoint(bytes);
        }
    }
    finally {
        await out.close();
    }
}
async function fetchHttps(candidate, part, metaFile, opts) {
    const { item, onProgress, signal } = opts;
    const cleanUrl = redactUrl(candidate.url.toString());
    let offset = 0;
    let meta = await readJson(metaFile);
    if (meta !== undefined && meta.url === cleanUrl && (await exists(part))) {
        offset = (await fs.stat(part)).size;
    }
    else {
        meta = undefined;
        await fs.rm(part, { force: true });
        await fs.rm(metaFile, { force: true });
    }
    for (let attempt = 0; attempt < 2; attempt++) {
        const headers = { 'user-agent': 'hanamesh-provision/0.1', accept: '*/*' };
        if (offset > 0) {
            headers['range'] = `bytes=${offset}-`;
            if (meta?.etag !== undefined)
                headers['if-range'] = meta.etag;
        }
        const res = await followRedirects(candidate.url, headers, signal, item);
        if (res.status === 416) {
            // Server says our offset is past the end: our part is unusable.
            await res.body?.cancel();
            await fs.rm(part, { force: true });
            await fs.rm(metaFile, { force: true });
            offset = 0;
            meta = undefined;
            continue;
        }
        if (res.status !== 200 && res.status !== 206) {
            await res.body?.cancel();
            throw new ProvisionError('E_DOWNLOAD', `HTTP ${res.status} from ${cleanUrl}`, { item });
        }
        const etag = res.headers.get('etag') ?? undefined;
        let total;
        if (res.status === 206) {
            const cr = /^bytes (\d+)-(\d+)\/(\d+|\*)$/.exec(res.headers.get('content-range') ?? '');
            if (cr === null || Number(cr[1]) !== offset) {
                await res.body?.cancel();
                throw new ProvisionError('E_DOWNLOAD', `unexpected Content-Range for resume from ${cleanUrl}`, { item });
            }
            if (cr[3] !== '*')
                total = Number(cr[3]);
            onProgress?.({ item, phase: 'download', source: candidate.source, bytes: offset, total, note: `resume@${offset}` });
        }
        else {
            // Server ignored Range (or fresh start): begin from zero.
            if (offset > 0)
                onProgress?.({ item, phase: 'download', source: candidate.source, note: 'range-unsupported' });
            offset = 0;
            const len = res.headers.get('content-length');
            if (len !== null)
                total = Number(len);
        }
        if (total === undefined)
            total = opts.expectedSize;
        const newMeta = { url: cleanUrl };
        if (etag !== undefined)
            newMeta.etag = etag;
        if (total !== undefined)
            newMeta.total = total;
        await writeFileAtomic(metaFile, JSON.stringify(newMeta));
        meta = newMeta;
        if (res.body === null)
            throw new ProvisionError('E_DOWNLOAD', `empty body from ${cleanUrl}`, { item });
        const out = await fs.open(part, offset > 0 ? 'r+' : 'w');
        let bytes = offset;
        try {
            if (offset > 0)
                await out.truncate(offset);
            const reader = res.body.getReader();
            for (;;) {
                if (signal?.aborted) {
                    await reader.cancel().catch(() => undefined);
                    throw abortError(item);
                }
                let step;
                try {
                    step = await reader.read();
                }
                catch (err) {
                    if (signal?.aborted)
                        throw abortError(item);
                    throw new ProvisionError('E_DOWNLOAD', `connection lost at byte ${bytes} from ${cleanUrl}`, { item, cause: err });
                }
                if (step.done)
                    break;
                await out.write(step.value, 0, step.value.length, bytes);
                bytes += step.value.length;
                onProgress?.({ item, phase: 'download', source: candidate.source, bytes, total });
                downloadCheckpoint(bytes);
            }
        }
        finally {
            await out.close();
        }
        if (total !== undefined && bytes !== total) {
            throw new ProvisionError('E_DOWNLOAD', `short read: got ${bytes} of ${total} bytes from ${cleanUrl}`, { item });
        }
        return;
    }
    throw new ProvisionError('E_DOWNLOAD', `could not establish a download from ${cleanUrl}`, { item });
}
async function followRedirects(start, headers, signal, item) {
    let url = start;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        if (url.protocol !== 'https:') {
            /* MUTATION:https-only */
            throw new ProvisionError('E_SOURCE', `refusing non-https URL ${redactUrl(url.toString())}`, { item });
        }
        let res;
        try {
            res = await fetch(url, { headers, redirect: 'manual', signal: signal ?? null });
        }
        catch (err) {
            if (signal?.aborted)
                throw abortError(item);
            throw new ProvisionError('E_DOWNLOAD', `network error for ${redactUrl(url.toString())}: ${err.message}`, { item, cause: err });
        }
        if ([301, 302, 303, 307, 308].includes(res.status)) {
            const loc = res.headers.get('location');
            await res.body?.cancel();
            if (loc === null)
                throw new ProvisionError('E_DOWNLOAD', `redirect without Location from ${redactUrl(url.toString())}`, { item });
            url = new URL(loc, url);
            continue;
        }
        return res;
    }
    throw new ProvisionError('E_DOWNLOAD', `too many redirects from ${redactUrl(start.toString())}`, { item });
}
