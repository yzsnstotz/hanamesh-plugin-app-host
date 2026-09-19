import type { PlatformKey } from './types.js';
/**
 * Normalised platform key. Only `process.platform` and `process.arch` are consulted;
 * nothing installed on the host is ever probed.
 */
export declare function platformKey(platform?: NodeJS.Platform, arch?: string): PlatformKey;
