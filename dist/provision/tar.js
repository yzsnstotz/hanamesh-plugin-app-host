import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { ByteReader } from './archive.js';
import { ProvisionError } from './errors.js';
const BLOCK = 512;
function cstr(buf, off, len) {
    const slice = buf.subarray(off, off + len);
    const nul = slice.indexOf(0);
    return Buffer.from(nul === -1 ? slice : slice.subarray(0, nul)).toString('utf8');
}
function octal(buf, off, len) {
    const raw = buf.subarray(off, off + len);
    if ((raw[0] & 0x80) !== 0) {
        // GNU base-256 encoding for large numbers
        let v = 0;
        for (let i = 1; i < raw.length; i++)
            v = v * 256 + raw[i];
        return v;
    }
    const s = cstr(buf, off, len).trim();
    return s.length === 0 ? 0 : parseInt(s, 8);
}
function checksumOk(header) {
    let sum = 0;
    for (let i = 0; i < BLOCK; i++)
        sum += i >= 148 && i < 156 ? 0x20 : header[i];
    return sum === octal(header, 148, 8);
}
function parsePax(text) {
    const out = {};
    let pos = 0;
    while (pos < text.length) {
        const sp = text.indexOf(' ', pos);
        if (sp === -1)
            break;
        const len = Number(text.slice(pos, sp));
        if (!Number.isFinite(len) || len <= 0)
            break;
        const record = text.slice(sp + 1, pos + len - 1);
        const eq = record.indexOf('=');
        if (eq !== -1)
            out[record.slice(0, eq)] = record.slice(eq + 1);
        pos += len;
    }
    return out;
}
async function readAll(it) {
    const parts = [];
    for await (const c of it)
        parts.push(c);
    return Buffer.concat(parts);
}
/**
 * Minimal streaming ustar/GNU/pax reader over a gzip stream. Supports regular files,
 * directories, symlinks, hardlinks, GNU long names/links and pax path/linkpath/size.
 * Anything else is refused with `E_ARCHIVE`.
 */
export async function* readTarGz(file, item) {
    const gunzip = createGunzip();
    const source = createReadStream(file, { highWaterMark: 1 << 20 }).pipe(gunzip);
    const reader = new ByteReader(source);
    let longName;
    let longLink;
    let pax = {};
    let globalPax = {};
    let sawZero = false;
    for (;;) {
        const header = await reader.read(BLOCK);
        if (header.length === 0)
            break;
        if (header.length < BLOCK)
            throw new ProvisionError('E_ARCHIVE', 'truncated tar header', { item });
        if (header.every((b) => b === 0)) {
            if (sawZero)
                break;
            sawZero = true;
            continue;
        }
        sawZero = false;
        if (!checksumOk(header))
            throw new ProvisionError('E_ARCHIVE', 'tar header checksum mismatch', { item });
        let name = cstr(header, 0, 100);
        const mode = octal(header, 100, 8) & 0o7777;
        let size = octal(header, 124, 12);
        const typeflag = String.fromCharCode(header[156]);
        let linkTarget = cstr(header, 157, 100);
        const magic = cstr(header, 257, 6);
        if (magic === 'ustar') {
            const prefix = cstr(header, 345, 155);
            if (prefix.length > 0)
                name = prefix + '/' + name;
        }
        const padded = Math.ceil(size / BLOCK) * BLOCK;
        if (typeflag === 'L') {
            longName = (await readAll(reader.stream(size))).toString('utf8').replace(/\0+$/, '');
            await reader.skip(padded - size);
            continue;
        }
        if (typeflag === 'K') {
            longLink = (await readAll(reader.stream(size))).toString('utf8').replace(/\0+$/, '');
            await reader.skip(padded - size);
            continue;
        }
        if (typeflag === 'x') {
            pax = parsePax((await readAll(reader.stream(size))).toString('utf8'));
            await reader.skip(padded - size);
            continue;
        }
        if (typeflag === 'g') {
            globalPax = parsePax((await readAll(reader.stream(size))).toString('utf8'));
            await reader.skip(padded - size);
            continue;
        }
        const merged = { ...globalPax, ...pax };
        if (longName !== undefined)
            name = longName;
        if (merged['path'] !== undefined)
            name = merged['path'];
        if (longLink !== undefined)
            linkTarget = longLink;
        if (merged['linkpath'] !== undefined)
            linkTarget = merged['linkpath'];
        if (merged['size'] !== undefined)
            size = Number(merged['size']);
        longName = undefined;
        longLink = undefined;
        pax = {};
        const bodyPadded = Math.ceil(size / BLOCK) * BLOCK;
        let kind;
        switch (typeflag) {
            case '0':
            case '\0':
            case '7':
                kind = 'file';
                break;
            case '5':
                kind = 'dir';
                break;
            case '2':
                kind = 'symlink';
                break;
            case '1':
                kind = 'hardlink';
                break;
            default:
                throw new ProvisionError('E_ARCHIVE', `unsupported tar entry type "${typeflag}" for ${name}`, { item });
        }
        if (kind === 'dir' && name.endsWith('/'))
            name = name.slice(0, -1);
        let consumed = false;
        const body = (async function* () {
            consumed = true;
            if (kind === 'file')
                yield* reader.stream(size);
            else
                await reader.skip(size);
            await reader.skip(bodyPadded - size);
        })();
        const entry = { kind, name, mode, size: kind === 'file' ? size : 0, body };
        if (kind === 'symlink' || kind === 'hardlink')
            entry.linkTarget = linkTarget;
        yield entry;
        if (!consumed) {
            for await (const _ of body) {
                /* drain so the stream stays aligned */
            }
        }
    }
}
