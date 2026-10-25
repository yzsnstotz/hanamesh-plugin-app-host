import path from 'node:path';
import { ProvisionError } from './errors.js';
import { readJson, writeFileAtomic } from './fsutil.js';
import { externalPath } from './paths.js';
export const PROVISION_DIR = '.provision';
export function provisionDir(root) {
    return path.join(externalPath(root), PROVISION_DIR);
}
export function ledgerPath(root) {
    return path.join(provisionDir(root), 'ledger.json');
}
export function stagingDir(root, item, sha256) {
    return path.join(provisionDir(root), 'staging', `${item}-${sha256.slice(0, 12)}`);
}
export function trashRoot(root) {
    return path.join(provisionDir(root), 'trash');
}
export function pendingDir(root) {
    return path.join(provisionDir(root), 'pending');
}
export function targetPath(root, installTo) {
    return path.join(externalPath(root), ...installTo.split('/'));
}
export function ownershipPath(target) {
    return target + '.manifest.json';
}
/** Read `<root>/.provision/ledger.json`; an absent ledger is an empty one. */
export async function ledger(root) {
    const data = await readJson(ledgerPath(root));
    if (data === undefined)
        return { schema: 1, items: {} };
    if (typeof data !== 'object' || data === null || data.schema !== 1 || typeof data.items !== 'object') {
        throw new ProvisionError('E_LEDGER', `ledger corrupt: ${ledgerPath(root)}`);
    }
    return data;
}
/** Atomic (temp + fsync + rename) ledger write. Single writer by contract. */
export async function writeLedger(root, data) {
    await writeFileAtomic(ledgerPath(root), JSON.stringify(data, null, 2) + '\n');
}
export async function readOwnership(target) {
    const data = await readJson(ownershipPath(target));
    if (data === undefined)
        return undefined;
    const m = data;
    if (m.schema !== 1 || typeof m.item !== 'string' || !Array.isArray(m.files)) {
        throw new ProvisionError('E_LEDGER', `ownership manifest corrupt: ${ownershipPath(target)}`);
    }
    return m;
}
