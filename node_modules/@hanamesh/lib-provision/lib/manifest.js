import { ProvisionError } from './errors.js';
import { redactUrl } from './paths.js';
const SHA256_RE = /^[0-9a-f]{64}$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
function fail(msg, item) {
    throw new ProvisionError('E_MANIFEST', msg, item === undefined ? undefined : { item });
}
function isRecord(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
/** Only `https:` and `file:` are ever accepted, anywhere a URL appears. */
export function assertAllowedUrl(u, what) {
    let url;
    try {
        url = new URL(u);
    }
    catch {
        fail(`${what}: not a valid URL: ${redactUrl(u)}`);
    }
    if (url.protocol !== 'https:' && url.protocol !== 'file:') {
        fail(`${what}: only https: and file: are accepted, got ${url.protocol} (${redactUrl(u)})`);
    }
    return url;
}
function validateSource(raw, index) {
    if (!isRecord(raw))
        fail(`sources[${index}] must be an object`);
    const { id, kind, base } = raw;
    if (typeof id !== 'string' || !ID_RE.test(id))
        fail(`sources[${index}].id invalid`);
    if (kind !== 'https' && kind !== 'file')
        fail(`sources[${index}].kind must be "https" or "file"`);
    if (typeof base !== 'string')
        fail(`sources[${index}].base must be a string`);
    const url = assertAllowedUrl(base, `sources[${index}].base`);
    if ((kind === 'https' && url.protocol !== 'https:') || (kind === 'file' && url.protocol !== 'file:')) {
        fail(`sources[${index}]: kind "${kind}" does not match base protocol ${url.protocol}`);
    }
    return { id, kind, base };
}
function validatePlatformAsset(raw, itemId, key) {
    if (!isRecord(raw))
        fail(`items[${itemId}].platforms[${key}] must be an object`, itemId);
    const { asset, sha256, size, strip, url } = raw;
    if (typeof asset !== 'string' || asset.length === 0)
        fail(`items[${itemId}].platforms[${key}].asset required`, itemId);
    if (asset.startsWith('/') || asset.includes('..'))
        fail(`items[${itemId}].platforms[${key}].asset must be a relative name`, itemId);
    /* MUTATION:manifest-sha256-required */
    if (typeof sha256 !== 'string' || !SHA256_RE.test(sha256)) {
        fail(`items[${itemId}].platforms[${key}].sha256 missing or not 64 lower-case hex chars — refusing to guess`, itemId);
    }
    const out = { asset, sha256 };
    if (size !== undefined) {
        if (typeof size !== 'number' || !Number.isInteger(size) || size < 0)
            fail(`items[${itemId}].platforms[${key}].size invalid`, itemId);
        out.size = size;
    }
    if (strip !== undefined) {
        if (typeof strip !== 'number' || !Number.isInteger(strip) || strip < 0)
            fail(`items[${itemId}].platforms[${key}].strip invalid`, itemId);
        out.strip = strip;
    }
    if (url !== undefined) {
        if (typeof url !== 'string')
            fail(`items[${itemId}].platforms[${key}].url must be a string`, itemId);
        assertAllowedUrl(url, `items[${itemId}].platforms[${key}].url`);
        out.url = url;
    }
    return out;
}
function validateItem(raw, index, seen) {
    if (!isRecord(raw))
        fail(`items[${index}] must be an object`);
    const { id, version, kind, installTo, platforms, verify } = raw;
    if (typeof id !== 'string' || !ID_RE.test(id))
        fail(`items[${index}].id invalid`);
    if (seen.has(id))
        fail(`duplicate item id "${id}"`, id);
    seen.add(id);
    if (typeof version !== 'string' || version.length === 0)
        fail(`items[${id}].version required`, id);
    if (kind !== 'tar.gz' && kind !== 'zip')
        fail(`items[${id}].kind must be "tar.gz" or "zip" (.tar.xz is not supported)`, id);
    if (typeof installTo !== 'string' || installTo.length === 0)
        fail(`items[${id}].installTo required`, id);
    const segs = installTo.split('/').filter((s) => s.length > 0);
    if (segs.length === 0 || installTo.startsWith('/') || /^[A-Za-z]:/.test(installTo) || installTo.includes('\\') || segs.some((s) => s === '..' || s === '.')) {
        fail(`items[${id}].installTo must be a relative POSIX path inside root`, id);
    }
    if (segs[0] === '.provision')
        fail(`items[${id}].installTo may not live under .provision`, id);
    if (!isRecord(platforms))
        fail(`items[${id}].platforms must be an object`, id);
    const outPlatforms = {};
    for (const [key, val] of Object.entries(platforms))
        outPlatforms[key] = validatePlatformAsset(val, id, key);
    const item = { id, version, kind, installTo: segs.join('/'), platforms: outPlatforms };
    if (verify !== undefined) {
        if (!isRecord(verify))
            fail(`items[${id}].verify must be an object`, id);
        const { exec, args, expect, timeoutMs } = verify;
        if (typeof exec !== 'string' || exec.length === 0 || exec.startsWith('/') || exec.includes('..'))
            fail(`items[${id}].verify.exec must be a relative path inside the tree`, id);
        const v = { exec };
        if (args !== undefined) {
            if (!Array.isArray(args) || !args.every((a) => typeof a === 'string'))
                fail(`items[${id}].verify.args must be string[]`, id);
            v.args = args;
        }
        if (expect !== undefined) {
            if (typeof expect !== 'string')
                fail(`items[${id}].verify.expect must be a string`, id);
            v.expect = expect;
        }
        if (timeoutMs !== undefined) {
            if (typeof timeoutMs !== 'number' || timeoutMs <= 0)
                fail(`items[${id}].verify.timeoutMs invalid`, id);
            v.timeoutMs = timeoutMs;
        }
        item.verify = v;
    }
    return item;
}
/** Validate an untrusted manifest object. Throws `ProvisionError('E_MANIFEST')`. */
export function validateManifest(raw) {
    if (!isRecord(raw))
        fail('manifest must be an object');
    if (raw['schema'] !== 1)
        fail('manifest.schema must be 1');
    if (!Array.isArray(raw['sources']))
        fail('manifest.sources must be an array');
    if (!Array.isArray(raw['items']))
        fail('manifest.items must be an array');
    const sourceIds = new Set();
    const sources = raw['sources'].map((s, i) => {
        const src = validateSource(s, i);
        if (sourceIds.has(src.id))
            fail(`duplicate source id "${src.id}"`);
        sourceIds.add(src.id);
        return src;
    });
    const seen = new Set();
    const items = raw['items'].map((it, i) => validateItem(it, i, seen));
    return { schema: 1, sources, items };
}
/** Candidate download URLs for one asset, in the order they must be tried. */
export function resolveCandidates(manifest, asset, sourceOrder) {
    if (asset.url !== undefined) {
        const url = assertAllowedUrl(asset.url, 'asset.url');
        return [{ source: 'url', kind: url.protocol === 'file:' ? 'file' : 'https', url }];
    }
    let sources = manifest.sources;
    if (sourceOrder !== undefined) {
        const byId = new Map(sources.map((s) => [s.id, s]));
        sources = sourceOrder.map((id) => {
            const s = byId.get(id);
            if (s === undefined)
                throw new ProvisionError('E_SOURCE', `unknown source id "${id}"`);
            return s;
        });
    }
    if (sources.length === 0)
        throw new ProvisionError('E_SOURCE', 'no sources available for asset');
    return sources.map((s) => {
        const base = s.base.endsWith('/') ? s.base : s.base + '/';
        const url = new URL(asset.asset, base);
        assertAllowedUrl(url.toString(), `source ${s.id}`);
        return { source: s.id, kind: s.kind, url };
    });
}
