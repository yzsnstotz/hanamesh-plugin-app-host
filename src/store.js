import { constants } from 'node:fs';
import { mkdir, readFile, open, rename, unlink, lstat, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppHostError, SerialQueue, copy, requireCondition } from './errors.js';
import { processIdentity } from './runtime.js';

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

// File mutex with dead-owner reclamation. The record carries the owner pid + process start
// token (a reused pid fails closed) and, for runtime locks, the children the guardian created
// (pid + start token + executable). A malformed lock is never auto-deleted. A live owner, or a
// surviving child that is not provably ours, keeps DATA_ROOT_BUSY and names the live pid.
// Only provably-ours orphans (same pid, same start token, same executable when known) are
// terminated before the lock is taken; a stale record whose processes are gone is reclaimed.
const sameExecutable = async (recorded, live) => {
  if (typeof recorded !== 'string' || typeof live !== 'string') return recorded == null || live == null;
  if (recorded === live) return true;
  const [a, b] = await Promise.all([realpath(recorded).catch(() => recorded), realpath(live).catch(() => live)]);
  return a === b;
};
const busy = (message, details) => new AppHostError('DATA_ROOT_BUSY', message, details);
export class FileLock {
  #queue = new SerialQueue();
  constructor(path, { reclaimDead = false, orphanGraceMs = 2_000, identity = processIdentity } = {}) {
    this.path = path; this.reclaimDead = reclaimDead; this.orphanGraceMs = orphanGraceMs; this.identity = identity;
    this.id = randomUUID(); this.held = false;
  }
  async #identity(pid) {
    // A failed probe is "alive, unknown": it can never prove a process dead or ours.
    try { return await this.identity(pid); } catch { return { pid, start: null, command: null }; }
  }
  async #liveOwner(record) {
    if (!Number.isSafeInteger(record.pid) || record.pid <= 1) return { pid: record.pid ?? null, start: null };
    const live = await this.#identity(record.pid);
    if (!live) return null;
    if (typeof record.start === 'string' && typeof live.start === 'string' && live.start !== record.start) return null; // pid reused
    return live;
  }
  async #classifyChildren(record) {
    const ours = [], unknown = [];
    for (const child of Array.isArray(record.children) ? record.children : []) {
      if (!Number.isSafeInteger(child?.pid) || child.pid <= 1) continue;
      const live = await this.#identity(child.pid);
      if (!live) continue; // gone
      if (typeof child.start === 'string' && typeof live.start === 'string') {
        if (live.start !== child.start) continue; // pid reused by an unrelated process
        if (await sameExecutable(child.command, live.command)) { ours.push({ ...child, live }); continue; }
      }
      unknown.push({ pid: child.pid, role: child.role ?? null, command: live.command ?? null });
    }
    return { ours, unknown };
  }
  async #terminateOwned(children, ownerPid) {
    const signal = (child, name) => {
      for (const target of child.group ? [-child.pid, child.pid] : [child.pid]) {
        try { process.kill(target, name); } catch (error) {
          if (error.code !== 'ESRCH') throw busy('An orphaned owned process refused the signal; the data root stays locked.',
            { pid: child.pid, ownerPid, reason: 'signal-refused', cause: error.code ?? null });
        }
      }
    };
    // Unknown start (a failed probe) counts as alive: never take the lock over a process we cannot see.
    const alive = async child => { const live = await this.#identity(child.pid); return live !== null && (live.start === null || live.start === child.start); };
    const settle = async deadline => {
      let pending = children;
      while (pending.length && Date.now() < deadline) {
        const still = [];
        for (const child of pending) if (await alive(child)) still.push(child);
        pending = still;
        if (pending.length) await new Promise(resolve => setTimeout(resolve, 25));
      }
      return pending;
    };
    for (const child of children) signal(child, 'SIGTERM');
    let pending = await settle(Date.now() + this.orphanGraceMs);
    for (const child of pending) signal(child, 'SIGKILL');
    pending = await settle(Date.now() + 2_000);
    if (pending.length) throw busy('An orphaned owned process survived termination; the data root stays locked.',
      { pid: pending[0].pid, pids: pending.map(c => c.pid), ownerPid, reason: 'orphan-survived' });
  }
  async acquire() {
    const self = await this.#identity(process.pid);
    for (let attempt = 0; attempt < 2; attempt++) {
      let fd;
      try {
        fd = await open(this.path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        await fd.writeFile(JSON.stringify({ pid: process.pid, start: self?.start ?? null, id: this.id, children: [] })); await fd.sync();
        this.held = true; return;
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
        let previous;
        try { previous = JSON.parse(await readFile(this.path, 'utf8')); } catch {
          throw new AppHostError('LOCK_RECOVERY_REQUIRED', 'Malformed lock; refusing automatic recovery.');
        }
        const owner = await this.#liveOwner(previous);
        if (owner) throw busy('The data root is locked by a live owner; no process was signalled.',
          { pid: owner.pid, start: owner.start ?? null, reason: 'owner-alive', port: previous.port ?? null });
        if (!this.reclaimDead) throw busy('The data root is locked by another owner; no process was signalled.',
          { pid: previous.pid ?? null, reason: 'owner-dead-no-reclaim' });
        const { ours, unknown } = await this.#classifyChildren(previous);
        if (unknown.length) throw busy('The lock owner is gone but a recorded child is still running and cannot be proven ours; no process was signalled.',
          { pid: unknown[0].pid, pids: unknown.map(c => c.pid), ownerPid: previous.pid ?? null, reason: 'orphan-unproven', children: unknown });
        if (ours.length) await this.#terminateOwned(ours, previous.pid ?? null);
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
    throw busy('Could not acquire the data root.', { reason: 'retry-exhausted' });
  }
  /** Record the processes this owner created (guardian children, port) so a later reclaimer can judge them. */
  annotate(patch) {
    return this.#queue.run(async () => {
      requireCondition(this.held, 'LOCK_NOT_HELD', 'Cannot annotate a lock that is not held.');
      const current = JSON.parse(await readFile(this.path, 'utf8'));
      requireCondition(current.id === this.id, 'LOCK_OWNERSHIP_LOST', 'Lock changed owner; refusing to rewrite it.');
      const next = { ...current, ...patch, pid: current.pid, start: current.start, id: current.id };
      if (patch.child) { next.children = [...(Array.isArray(current.children) ? current.children : []), patch.child]; delete next.child; }
      const temp = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
      const fd = await open(temp, 'wx', 0o600);
      try { await fd.writeFile(JSON.stringify(next)); await fd.sync(); } finally { await fd.close(); }
      try { await rename(temp, this.path); } catch (error) { await unlink(temp).catch(() => {}); throw error; }
      return next;
    });
  }
  async release() {
    await this.#queue.drained();
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
