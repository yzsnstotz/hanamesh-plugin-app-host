import type { VerifySpec } from './types.js';
/**
 * Run `verify.exec` from the freshly extracted tree with an isolated environment:
 * PATH is empty, so nothing on the host can be picked up by accident, and the
 * executable is addressed by absolute path inside the staging tree.
 */
export declare function runCheck(tree: string, spec: VerifySpec, item: string): Promise<{
    stdout: string;
    stderr: string;
}>;
