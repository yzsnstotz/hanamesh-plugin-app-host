import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
export async function sha256File(file) {
    const hash = createHash('sha256');
    await pipeline(createReadStream(file), hash);
    return hash.digest('hex');
}
/** temp + fsync + rename. The data is durable and the path is never observed half-written. */
export async function writeFileAtomic(file, data, mode) {
    const dir = path.dirname(file);
    await fs.mkdir(dir, { recursive: true });
    const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now().toString(36)}.tmp`);
    const handle = await fs.open(tmp, 'w', mode ?? 0o644);
    try {
        await handle.writeFile(data);
        await handle.sync();
    }
    finally {
        await handle.close();
    }
    await fs.rename(tmp, file);
    await fsyncDir(dir);
}
/** Best-effort directory fsync (no-op where the platform refuses to open directories). */
export async function fsyncDir(dir) {
    if (process.platform === 'win32')
        return;
    let handle;
    try {
        handle = await fs.open(dir, 'r');
    }
    catch {
        return;
    }
    try {
        await handle.sync();
    }
    catch {
        /* some filesystems reject fsync on directories; the rename itself is still atomic */
    }
    finally {
        await handle.close();
    }
}
export async function exists(p) {
    try {
        await fs.lstat(p);
        return true;
    }
    catch {
        return false;
    }
}
export async function readJson(file) {
    let text;
    try {
        text = await fs.readFile(file, 'utf8');
    }
    catch (err) {
        if (err.code === 'ENOENT')
            return undefined;
        throw err;
    }
    return JSON.parse(text);
}
export async function rmrf(p) {
    await fs.rm(p, { recursive: true, force: true, maxRetries: 3 });
}
