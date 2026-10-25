import type { Manifest, PlatformAsset } from './types.js';
/** Only `https:` and `file:` are ever accepted, anywhere a URL appears. */
export declare function assertAllowedUrl(u: string, what: string): URL;
/** Validate an untrusted manifest object. Throws `ProvisionError('E_MANIFEST')`. */
export declare function validateManifest(raw: unknown): Manifest;
/** Candidate download URLs for one asset, in the order they must be tried. */
export declare function resolveCandidates(manifest: Manifest, asset: PlatformAsset, sourceOrder?: string[]): Array<{
    source: string;
    kind: 'https' | 'file';
    url: URL;
}>;
