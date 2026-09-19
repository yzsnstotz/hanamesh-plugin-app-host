import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { createInflateRaw } from 'node:zlib';
import { ProvisionError } from './errors.js';
const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++)
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();
export function crc32Update(crc, buf) {
    let c = ~crc >>> 0;
    for (let i = 0; i < buf.length; i++)
        c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return ~c >>> 0;
}
const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;
const Z64_EOCD_SIG = 0x06064b50;
const Z64_LOC_SIG = 0x07064b50;
async function readRange(handle, offset, length) {
    const buf = Buffer.alloc(length);
    let done = 0;
    while (done < length) {
        const { bytesRead } = await handle.read(buf, done, length - done, offset + done);
        if (bytesRead === 0)
            break;
        done += bytesRead;
    }
    return done === length ? buf : buf.subarray(0, done);
}
function parseZip64Extra(extra, need) {
    let pos = 0;
    while (pos + 4 <= extra.length) {
        const id = extra.readUInt16LE(pos);
        const len = extra.readUInt16LE(pos + 2);
        if (id === 0x0001) {
            const out = {};
            let p = pos + 4;
            if (need.size) {
                out.size = Number(extra.readBigUInt64LE(p));
                p += 8;
            }
            if (need.csize) {
                out.compressedSize = Number(extra.readBigUInt64LE(p));
                p += 8;
            }
            if (need.offset) {
                out.localHeaderOffset = Number(extra.readBigUInt64LE(p));
                p += 8;
            }
            return out;
        }
        pos += 4 + len;
    }
    return {};
}
async function readCentralDirectory(handle, fileSize, item) {
    const tailLen = Math.min(fileSize, 65557);
    const tail = await readRange(handle, fileSize - tailLen, tailLen);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
        if (tail.readUInt32LE(i) === EOCD_SIG) {
            eocd = i;
            break;
        }
    }
    if (eocd === -1)
        throw new ProvisionError('E_ARCHIVE', 'zip: end of central directory not found', { item });
    let count = tail.readUInt16LE(eocd + 10);
    let cdSize = tail.readUInt32LE(eocd + 12);
    let cdOffset = tail.readUInt32LE(eocd + 16);
    if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
        // ZIP64: locator sits right before the EOCD.
        const locPos = eocd - 20;
        if (locPos < 0 || tail.readUInt32LE(locPos) !== Z64_LOC_SIG)
            throw new ProvisionError('E_ARCHIVE', 'zip64: locator missing', { item });
        const z64Offset = Number(tail.readBigUInt64LE(locPos + 8));
        const z64 = await readRange(handle, z64Offset, 56);
        if (z64.readUInt32LE(0) !== Z64_EOCD_SIG)
            throw new ProvisionError('E_ARCHIVE', 'zip64: EOCD record missing', { item });
        count = Number(z64.readBigUInt64LE(32));
        cdSize = Number(z64.readBigUInt64LE(40));
        cdOffset = Number(z64.readBigUInt64LE(48));
    }
    const cd = await readRange(handle, cdOffset, cdSize);
    const entries = [];
    let pos = 0;
    for (let i = 0; i < count; i++) {
        if (pos + 46 > cd.length || cd.readUInt32LE(pos) !== CEN_SIG)
            throw new ProvisionError('E_ARCHIVE', 'zip: central directory corrupt', { item });
        const madeByHost = cd.readUInt16LE(pos + 4) >> 8;
        const flags = cd.readUInt16LE(pos + 8);
        const method = cd.readUInt16LE(pos + 10);
        const crc32 = cd.readUInt32LE(pos + 16);
        let compressedSize = cd.readUInt32LE(pos + 20);
        let size = cd.readUInt32LE(pos + 24);
        const nameLen = cd.readUInt16LE(pos + 28);
        const extraLen = cd.readUInt16LE(pos + 30);
        const commentLen = cd.readUInt16LE(pos + 32);
        const externalAttrs = cd.readUInt32LE(pos + 38);
        let localHeaderOffset = cd.readUInt32LE(pos + 42);
        const nameBytes = cd.subarray(pos + 46, pos + 46 + nameLen);
        const name = (flags & 0x800) !== 0 ? nameBytes.toString('utf8') : nameBytes.toString('latin1');
        const extra = cd.subarray(pos + 46 + nameLen, pos + 46 + nameLen + extraLen);
        const need = { size: size === 0xffffffff, csize: compressedSize === 0xffffffff, offset: localHeaderOffset === 0xffffffff };
        if (need.size || need.csize || need.offset) {
            const z = parseZip64Extra(extra, need);
            if (z.size !== undefined)
                size = z.size;
            if (z.compressedSize !== undefined)
                compressedSize = z.compressedSize;
            if (z.localHeaderOffset !== undefined)
                localHeaderOffset = z.localHeaderOffset;
        }
        entries.push({ name, method, crc32, compressedSize, size, localHeaderOffset, externalAttrs, madeByHost, flags });
        pos += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
}
const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;
const S_IFDIR = 0o040000;
/** Read a zip via its central directory (the only trustworthy index). Store and deflate only. */
export async function* readZip(file, item) {
    const handle = await fs.open(file, 'r');
    try {
        const { size: fileSize } = await handle.stat();
        const entries = await readCentralDirectory(handle, fileSize, item);
        for (const e of entries) {
            if ((e.flags & 0x1) !== 0)
                throw new ProvisionError('E_ARCHIVE', `zip: encrypted entry ${e.name}`, { item });
            if (e.method !== 0 && e.method !== 8)
                throw new ProvisionError('E_ARCHIVE', `zip: unsupported compression method ${e.method} for ${e.name}`, { item });
            const local = await readRange(handle, e.localHeaderOffset, 30);
            if (local.length < 30 || local.readUInt32LE(0) !== LOC_SIG)
                throw new ProvisionError('E_ARCHIVE', `zip: local header corrupt for ${e.name}`, { item });
            const dataOffset = e.localHeaderOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
            if (dataOffset + e.compressedSize > fileSize)
                throw new ProvisionError('E_ARCHIVE', `zip: entry ${e.name} extends past end of file`, { item });
            const unixMode = e.madeByHost === 3 ? (e.externalAttrs >>> 16) & 0o177777 : 0;
            let kind;
            if (e.name.endsWith('/') || (unixMode & S_IFMT) === S_IFDIR || (e.externalAttrs & 0x10) !== 0)
                kind = 'dir';
            else if ((unixMode & S_IFMT) === S_IFLNK)
                kind = 'symlink';
            else
                kind = 'file';
            const expectedCrc = e.crc32;
            const expectedSize = e.size;
            const makeBody = () => (async function* () {
                if (kind === 'dir' || e.compressedSize === 0 && expectedSize === 0)
                    return;
                const raw = createReadStream(file, { start: dataOffset, end: dataOffset + e.compressedSize - 1, highWaterMark: 1 << 20 });
                const stream = e.method === 8 ? raw.pipe(createInflateRaw()) : raw;
                let crc = 0;
                let n = 0;
                for await (const chunk of stream) {
                    const c = chunk;
                    crc = crc32Update(crc, c);
                    n += c.length;
                    yield c;
                }
                if (n !== expectedSize)
                    throw new ProvisionError('E_ARCHIVE', `zip: size mismatch for ${e.name}`, { item });
                if (crc !== expectedCrc)
                    throw new ProvisionError('E_ARCHIVE', `zip: crc32 mismatch for ${e.name}`, { item });
            })();
            const entry = {
                kind,
                name: kind === 'dir' && e.name.endsWith('/') ? e.name.slice(0, -1) : e.name,
                mode: unixMode & 0o7777,
                size: kind === 'file' ? expectedSize : 0,
                body: makeBody(),
            };
            if (kind === 'symlink') {
                const parts = [];
                for await (const c of entry.body)
                    parts.push(c);
                entry.linkTarget = Buffer.concat(parts).toString('utf8');
                entry.body = (async function* () { })();
            }
            yield entry;
        }
    }
    finally {
        await handle.close();
    }
}
