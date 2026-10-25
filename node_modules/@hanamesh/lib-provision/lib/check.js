import { spawn } from 'node:child_process';
import path from 'node:path';
import { ProvisionError } from './errors.js';
import { isInside } from './paths.js';
/**
 * Run `verify.exec` from the freshly extracted tree with an isolated environment:
 * PATH is empty, so nothing on the host can be picked up by accident, and the
 * executable is addressed by absolute path inside the staging tree.
 */
export async function runCheck(tree, spec, item) {
    const exe = path.join(tree, ...spec.exec.split('/'));
    if (!isInside(tree, exe))
        throw new ProvisionError('E_VERIFY', `verify.exec escapes the tree: ${spec.exec}`, { item });
    const env = { PATH: '' };
    if (process.platform === 'win32') {
        // A Windows process cannot start without SystemRoot; nothing else is inherited.
        for (const k of ['SystemRoot', 'SYSTEMROOT', 'windir', 'TEMP', 'TMP']) {
            const v = process.env[k];
            if (v !== undefined)
                env[k] = v;
        }
    }
    const timeoutMs = spec.timeoutMs ?? 60_000;
    return new Promise((resolve, reject) => {
        const child = spawn(exe, spec.args ?? [], { env, cwd: tree, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
            reject(new ProvisionError('E_VERIFY', `verify.exec timed out after ${timeoutMs}ms: ${spec.exec}`, { item }));
        }, timeoutMs);
        child.stdout.on('data', (d) => (stdout += d.toString()));
        child.stderr.on('data', (d) => (stderr += d.toString()));
        child.on('error', (err) => {
            clearTimeout(timer);
            reject(new ProvisionError('E_VERIFY', `verify.exec could not start (${spec.exec}): ${err.message}`, { item, cause: err }));
        });
        child.on('close', (code, signal) => {
            clearTimeout(timer);
            if (code !== 0) {
                reject(new ProvisionError('E_VERIFY', `verify.exec exited ${code ?? signal}: ${spec.exec}; stderr: ${stderr.trim().slice(0, 500)}`, { item }));
                return;
            }
            if (spec.expect !== undefined && stdout.trim() !== spec.expect) {
                reject(new ProvisionError('E_VERIFY', `verify.exec output ${JSON.stringify(stdout.trim().slice(0, 200))} != expected ${JSON.stringify(spec.expect)}`, { item }));
                return;
            }
            resolve({ stdout, stderr });
        });
    });
}
