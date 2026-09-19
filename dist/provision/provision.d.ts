import type { PlanEntry, PlanOptions, ProvisionOptions, ProvisionResult, RemoveResult, VerifyResult } from './types.js';
/** Pure planning against the ledger: what would `provision` do for each item. */
export declare function plan(manifestInput: unknown, options: PlanOptions): Promise<PlanEntry[]>;
/** Download → sha256 → extract → check → atomic promote → ledger, item by item. */
export declare function provision(manifestInput: unknown, options: ProvisionOptions): Promise<ProvisionResult[]>;
/** Delete exactly what the ownership manifest lists; anything else in the target is left alone. */
export declare function remove(itemId: string, options: {
    root: string;
}): Promise<RemoveResult>;
/**
 * Recompute every installed item's digests against its ownership manifest and reconcile the
 * ledger with what is really on disk. Repairs the state left by a kill between
 * `rename(tree → target)` and the ledger write, and restores an old tree left in trash.
 */
export declare function verify(options: {
    root: string;
}): Promise<VerifyResult>;
