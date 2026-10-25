export declare function sha256File(file: string): Promise<string>;
/** temp + fsync + rename. The data is durable and the path is never observed half-written. */
export declare function writeFileAtomic(file: string, data: string | Uint8Array, mode?: number): Promise<void>;
/** Best-effort directory fsync (no-op where the platform refuses to open directories). */
export declare function fsyncDir(dir: string): Promise<void>;
export declare function exists(p: string): Promise<boolean>;
export declare function readJson<T>(file: string): Promise<T | undefined>;
export declare function rmrf(p: string): Promise<void>;
