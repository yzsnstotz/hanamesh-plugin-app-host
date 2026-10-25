import fs from 'node:fs/promises';
import path from 'node:path';
import { isProvisionError } from './errors.js';
import { platformKey } from './platform.js';
import { plan, provision, remove, verify } from './provision.js';
const USAGE = `hanamesh-provision — put a large file on this machine safely (no guessing, no PATH)

  hanamesh-provision plan    <manifest.json> --root <dir> [--platform <key>] [--only <item>]...
  hanamesh-provision install <manifest.json> --root <dir> [--source <id>]... [--only <item>]... [--force] [--platform <key>]
  hanamesh-provision remove  <item> --root <dir>
  hanamesh-provision verify  --root <dir>
  hanamesh-provision platform

Progress goes to stderr, the JSON result to stdout. Exit code 0 only when everything was done.
`;
class UsageError extends Error {
}
function parseArgs(argv) {
    const out = { command: argv[0], positional: [], flags: new Map(), bools: new Set() };
    for (let i = 1; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--force' || a === '--help' || a === '-h' || a === '--quiet') {
            out.bools.add(a.replace(/^-+/, ''));
            continue;
        }
        if (a.startsWith('--')) {
            const eq = a.indexOf('=');
            const key = eq === -1 ? a.slice(2) : a.slice(2, eq);
            const val = eq === -1 ? argv[++i] : a.slice(eq + 1);
            if (val === undefined)
                throw new UsageError(`missing value for --${key}`);
            const list = out.flags.get(key) ?? [];
            list.push(val);
            out.flags.set(key, list);
            continue;
        }
        out.positional.push(a);
    }
    return out;
}
function need(p, key) {
    const v = p.flags.get(key)?.at(-1);
    if (v === undefined)
        throw new UsageError(`--${key} is required`);
    return v;
}
function progressPrinter(quiet) {
    let lastLine = '';
    let lastTick = 0;
    let lastPct = -1;
    return (e) => {
        if (quiet)
            return;
        let line = `[${e.item}] ${e.phase}`;
        if (e.source !== undefined)
            line += ` via ${e.source}`;
        const isByteTick = e.phase === 'download' && e.bytes !== undefined && e.note === undefined;
        if (isByteTick) {
            // Throttle byte progress: at most every 500 ms or on a whole-percent change.
            const pct = e.total !== undefined && e.total > 0 ? Math.floor((e.bytes / e.total) * 100) : -1;
            const now = Date.now();
            if (now - lastTick < 500 && pct === lastPct)
                return;
            lastTick = now;
            lastPct = pct;
            line += e.total !== undefined ? ` ${e.bytes}/${e.total} (${pct}%)` : ` ${e.bytes} bytes`;
        }
        else if (e.phase === 'extract' && e.bytes !== undefined) {
            return; // per-entry ticks are noise on a terminal
        }
        if (e.note !== undefined)
            line += ` — ${e.note}`;
        if (line === lastLine)
            return;
        lastLine = line;
        process.stderr.write(line + '\n');
    };
}
export async function main(argv) {
    let p;
    try {
        p = parseArgs(argv);
    }
    catch (err) {
        process.stderr.write(`${err.message}\n${USAGE}`);
        return 2;
    }
    if (p.command === undefined || p.bools.has('help') || p.command === 'help') {
        process.stdout.write(USAGE);
        return p.command === undefined ? 2 : 0;
    }
    const quiet = p.bools.has('quiet');
    try {
        switch (p.command) {
            case 'platform': {
                process.stdout.write(JSON.stringify({ platform: platformKey() }) + '\n');
                return 0;
            }
            case 'plan': {
                const manifest = await readManifest(p.positional[0]);
                const root = need(p, 'root');
                const opts = { root };
                const platform = p.flags.get('platform')?.at(-1);
                if (platform !== undefined)
                    opts.platform = platform;
                const only = p.flags.get('only');
                if (only !== undefined)
                    opts.only = only;
                const result = await plan(manifest, opts);
                process.stdout.write(JSON.stringify({ root: path.resolve(root), platform: platform ?? platformKey(), plan: result }, null, 2) + '\n');
                return 0;
            }
            case 'install': {
                const manifest = await readManifest(p.positional[0]);
                const root = need(p, 'root');
                const opts = { root, onProgress: progressPrinter(quiet) };
                const platform = p.flags.get('platform')?.at(-1);
                if (platform !== undefined)
                    opts.platform = platform;
                const only = p.flags.get('only');
                if (only !== undefined)
                    opts.only = only;
                const sources = p.flags.get('source');
                if (sources !== undefined)
                    opts.sourceOrder = sources;
                if (p.bools.has('force'))
                    opts.force = true;
                const result = await provision(manifest, opts);
                process.stdout.write(JSON.stringify({ root: path.resolve(root), platform: platform ?? platformKey(), results: result }, null, 2) + '\n');
                return 0;
            }
            case 'remove': {
                const item = p.positional[0];
                if (item === undefined)
                    throw new UsageError('remove needs an <item>');
                const result = await remove(item, { root: need(p, 'root') });
                process.stdout.write(JSON.stringify(result, null, 2) + '\n');
                return 0;
            }
            case 'verify': {
                const result = await verify({ root: need(p, 'root') });
                process.stdout.write(JSON.stringify(result, null, 2) + '\n');
                return result.ok ? 0 : 1;
            }
            default:
                process.stderr.write(`unknown command "${p.command}"\n${USAGE}`);
                return 2;
        }
    }
    catch (err) {
        if (err instanceof UsageError) {
            process.stderr.write(`${err.message}\n${USAGE}`);
            return 2;
        }
        if (isProvisionError(err)) {
            process.stderr.write(`error ${err.code}${err.item !== undefined ? ` [${err.item}]` : ''}: ${err.message}\n`);
            process.stdout.write(JSON.stringify({ error: { code: err.code, item: err.item ?? null, message: err.message } }) + '\n');
            return 1;
        }
        process.stderr.write(`error: ${err.message}\n`);
        process.stdout.write(JSON.stringify({ error: { code: 'E_INTERNAL', message: err.message } }) + '\n');
        return 1;
    }
}
async function readManifest(file) {
    if (file === undefined)
        throw new UsageError('a <manifest.json> path is required');
    return JSON.parse(await fs.readFile(file, 'utf8'));
}
