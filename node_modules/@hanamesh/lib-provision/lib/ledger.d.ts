import type { Ledger, OwnershipManifest } from './types.js';
export declare const PROVISION_DIR = ".provision";
export declare function provisionDir(root: string): string;
export declare function ledgerPath(root: string): string;
export declare function stagingDir(root: string, item: string, sha256: string): string;
export declare function trashRoot(root: string): string;
export declare function pendingDir(root: string): string;
export declare function targetPath(root: string, installTo: string): string;
export declare function ownershipPath(target: string): string;
/** Read `<root>/.provision/ledger.json`; an absent ledger is an empty one. */
export declare function ledger(root: string): Promise<Ledger>;
/** Atomic (temp + fsync + rename) ledger write. Single writer by contract. */
export declare function writeLedger(root: string, data: Ledger): Promise<void>;
export declare function readOwnership(target: string): Promise<OwnershipManifest | undefined>;
