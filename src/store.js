import { constants } from 'node:fs';
import { mkdir, readFile, open, rename, unlink, lstat, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppHostError, SerialQueue, copy, requireCondition } from './errors.js';

export function emptySnapshot() {
  return { schema: 1, revision: 0, sequence: 0, instances: [], leases: [], events: [] };
}
export function validateSnapshot(s) {
  requireCondition(s && s.schema === 1 && Number.isSafeInteger(s.revision) && s.revision >= 0 &&
    Number.isSafeInteger(s.sequence) && s.sequence >= 0 && Array.isArray(s.instances) &&
    Array.isArray(s.leases) && Array.isArray(s.events), 'CORRUPT_STATE', 'Unsupported or damaged app-host snapshot.');
  const ids = new Set(), views = new Set();
  for (const i of s.instances) {
    requireCondition(i && typeof i.id === 'string' && !ids.has(i.id) &&
      typeof i.appId === 'string' && typeof i.deploymentId === 'string' && typeof i.dataId === 'string' &&
      typeof i.principalId === 'string' && typeof i.dataDir === 'string' &&
      ['reserved','starting','ready','stopping','stopped','failed','interrupted'].includes(i.status) &&
      ['owned','attach'].includes(i.mode), 'CORRUPT_STATE', 'Invalid instance record.');
    ids.add(i.id);
  }
  for (const l of s.leases) {
    const key = JSON.stringify([l?.principalId, l?.viewId]);
    requireCondition(l && ids.has(l.instanceId) && s.instances.some(i => i.id === l.instanceId && i.principalId === l.principalId) && !views.has(key) &&
      typeof l.viewId === 'string' && typeof l.principalId === 'string' &&
      typeof l.tokenHash === 'string' && /^[a-f0-9]{64}$/.test(l.tokenHash) &&
      Number.isSafeInteger(l.generation) && l.generation > 0 && Number.isFinite(l.expiresAt) &&
      ['active','closed','expired','stopped','failed'].includes(l.status), 'CORRUPT_STATE', 'Invalid or ownerless lease.');
    views.add(key);
  }
  let last = 0;
  for (const e of s.events) {
    requireCondition(Number.isSafeInteger(e.sequence) && e.sequence > last && e.sequence <= s.sequence &&
      typeof e.principalId === 'string', 'CORRUPT_STATE', 'Invalid event journal.');
    last = e.sequence;
  }
  return s;
}

// Only use under an explicitly selected local profile root. Reject symlink components.
export async function secureDirectory(path) {
  requireCondition(isAbsolute(path), 'INVALID_ROOT', 'An absolute data directory is required.');
  const parts = resolve(path).split('/').filter(Boolean);
  let current = '/';
  for (const part of parts) {
    current = join(current, part);
    await mkdir(current, { mode: 0o700 }).catch(e => { if (e.code !== 'EEXIST') throw e; });
    const stat = await lstat(current);
    requireCondition(stat.isDirectory() && !stat.isSymbolicLink(), 'UNSAFE_DATA_PATH', 'Symlinked/non-directory data path is not allowed.');
  }
  return await realpath(path);
}

// File mutex: a reused PID fails closed. A malformed lock is never auto-deleted.
// Runtime locks use reclaimDead=false: a killed guardian may have surviving children.
export class FileLock {
  constructor(path, { reclaimDead = false } = {}) {
    this.path = path; this.reclaimDead = reclaimDead; this.id = randomUUID(); this.held = false;
  }
  async acquire() {
    for (let attempt = 0; attempt < 2; attempt++) {
      let fd;
      try {
        fd = await open(this.path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        await fd.writeFile(JSON.stringify({ pid: process.pid, id: this.id })); await fd.sync();
        this.held = true; return;
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
        let previous;
        try { previous = JSON.parse(await readFile(this.path, 'utf8')); } catch {
          throw new AppHostError('LOCK_RECOVERY_REQUIRED', 'Malformed lock; refusing automatic recovery.');
        }
        let alive = true;
        if (Number.isSafeInteger(previous.pid) && previous.pid > 1) {
          try { process.kill(previous.pid, 0); } catch (err) { if (err.code === 'ESRCH') alive = false; }
        }
        if (!this.reclaimDead || alive) throw new AppHostError('DATA_ROOT_BUSY', 'The data root is locked by another owner; no process was signalled.');
        // No live owner may legitimately replace a dead owner's lock without taking it.
        // Serialize stale recovery by a second exclusive marker; never delete that of a contender.
        let recovery;
        try {
          recovery = await open(`${this.path}.recovery`, 'wx', 0o600);
          const current = JSON.parse(await readFile(this.path, 'utf8'));
          if (current.id === previous.id) await unlink(this.path);
        } catch (err) {
          throw new AppHostError('LOCK_RECOVERY_REQUIRED', 'Concurrent or interrupted lock recovery; retry after inspection.');
        } finally {
          if (recovery) { await recovery.close(); await unlink(`${this.path}.recovery`).catch(() => {}); }
        }
      } finally { if (fd) await fd.close(); }
    }
    throw new AppHostError('DATA_ROOT_BUSY', 'Could not acquire the data root.');
  }
  async release() {
    if (!this.held) return;
    const current = JSON.parse(await readFile(this.path, 'utf8'));
    requireCondition(current.id === this.id, 'LOCK_OWNERSHIP_LOST', 'Lock changed owner; refusing to remove it.');
    await unlink(this.path); this.held = false;
  }
}

/** Reference/local backend. This is NOT an implementation of a guessed DSH API. */
export class AtomicFileStore {
  #queue = new SerialQueue();
  constructor(root, { checkpoint = async () => {} } = {}) {
    this.root = root; this.path = join(root, 'app-host.json'); this.checkpoint = checkpoint;
  }
  async init() {
    await secureDirectory(this.root);
    this.lock = new FileLock(join(this.root, '.app-host.lock'), { reclaimDead: true });
    await this.lock.acquire(); this.opened = true;
  }
  async load() {
    requireCondition(this.opened, 'STORE_NOT_OPEN', 'Storage must be initialized.');
    try {
      const fd = await open(this.path, constants.O_RDONLY | constants.O_NOFOLLOW);
      try { return copy(validateSnapshot(JSON.parse(await fd.readFile('utf8')))); } finally { await fd.close(); }
    } catch (e) { if (e.code === 'ENOENT') return emptySnapshot(); throw e; }
  }
  save(snapshot) {
    const image = copy(validateSnapshot(snapshot));
    return this.#queue.run(async () => {
      requireCondition(this.opened, 'STORE_NOT_OPEN', 'Storage is closed.');
      const temp = join(this.root, `.app-host.${process.pid}.${randomUUID()}.tmp`);
      let fd, renamed = false;
      try {
        fd = await open(temp, 'wx', 0o600);
        await fd.writeFile(JSON.stringify(image)); await fd.sync();
        await this.checkpoint('snapshot-temp-fsynced', copy(image));
        await fd.close(); fd = undefined;
        await rename(temp, this.path); renamed = true;
        const directory = await open(dirname(this.path), constants.O_RDONLY);
        try { await directory.sync(); } finally { await directory.close(); }
        await this.checkpoint('snapshot-published', copy(image));
      } catch (e) {
        // Post-rename failure is an ambiguous commit, not a guaranteed rollback.
        if (renamed) throw new AppHostError('COMMIT_UNCERTAIN', 'Snapshot rename completed but durability/acknowledgement failed; restart before further writes.');
        throw e;
      } finally {
        if (fd) await fd.close().catch(() => {});
        await unlink(temp).catch(e => { if (e.code !== 'ENOENT') throw e; });
      }
    });
  }
  async close() { await this.#queue.drained(); if (this.opened) { await this.lock.release(); this.opened = false; } }
}

/** Explicit bridge port; a verified profile must supply the actual DSH public-API binding. */
export class DshDomainSnapshotStore {
  constructor(binding) {
    requireCondition(binding?.layout === 'single' && binding?.domain === 'hanamesh_app_host' &&
      typeof binding.readSnapshot === 'function' && typeof binding.publishSnapshot === 'function' &&
      typeof binding.acquireExclusive === 'function' && typeof binding.releaseExclusive === 'function',
      'DSH_BINDING_REQUIRED', 'A verified single-image DSH storage-domain binding is required.');
    this.binding = binding;
  }
  async init() { await this.binding.acquireExclusive(); }
  async load() { const s = await this.binding.readSnapshot(); return s == null ? emptySnapshot() : copy(validateSnapshot(s)); }
  async save(s) { await this.binding.publishSnapshot(copy(validateSnapshot(s))); }
  async close() { await this.binding.releaseExclusive(); }
}
