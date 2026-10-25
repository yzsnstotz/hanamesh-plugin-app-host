import path from 'node:path';
/** `\\?\C:\x` → `C:\x`; `\\?\UNC\srv\share` → `\\srv\share`. No-op for other paths. */
export function stripVerbatimPrefix(p) {
    if (p.startsWith('\\\\?\\UNC\\'))
        return '\\\\' + p.slice('\\\\?\\UNC\\'.length);
    if (p.startsWith('\\\\?\\'))
        return p.slice('\\\\?\\'.length);
    return p;
}
/** Inverse of {@link stripVerbatimPrefix} for absolute Windows paths (used only for opening long paths). */
export function toVerbatimPath(p) {
    if (p.startsWith('\\\\?\\'))
        return p;
    if (/^[A-Za-z]:\\/.test(p))
        return '\\\\?\\' + p;
    if (p.startsWith('\\\\'))
        return '\\\\?\\UNC\\' + p.slice(2);
    return p;
}
/**
 * The form of a path this library exposes to callers: absolute, normalised,
 * and on Windows never carrying the `\\?\` prefix (which breaks PATH search and
 * string comparison in every consumer that gets it).
 */
export function externalPath(p, platform = process.platform) {
    const stripped = platform === 'win32' ? stripVerbatimPrefix(p) : p;
    return path.resolve(stripped);
}
/** True when `child` is `parent` or lies strictly inside it (lexically, after resolution). */
export function isInside(parent, child) {
    const rel = path.relative(path.resolve(parent), path.resolve(child));
    if (rel === '')
        return true;
    return !rel.startsWith('..') && !path.isAbsolute(rel);
}
const WINDOWS_ABS = /^[A-Za-z]:([\\/]|$)/;
/**
 * Split an archive entry name into safe path segments, or return null when the
 * entry must be refused (absolute, drive-qualified, `..`, NUL, empty).
 * Both `/` and `\` are treated as separators because zip writers disagree.
 */
export function safeEntrySegments(name) {
    if (name.length === 0 || name.includes('\0'))
        return null;
    if (name.startsWith('/') || name.startsWith('\\'))
        return null;
    if (WINDOWS_ABS.test(name))
        return null;
    const segments = name.split(/[\\/]+/).filter((s) => s.length > 0 && s !== '.');
    /* MUTATION:path-traversal */
    if (segments.some((s) => s === '..'))
        return null;
    return segments;
}
/**
 * Resolve a symlink target relative to the entry's directory and check that it
 * stays inside the tree. Returns the normalised relative POSIX target path of the
 * link destination, or null when the link would escape.
 */
export function safeLinkTarget(entrySegments, target) {
    if (target.length === 0 || target.includes('\0'))
        return null;
    if (target.startsWith('/') || target.startsWith('\\') || WINDOWS_ABS.test(target))
        return null;
    const dir = entrySegments.slice(0, -1);
    const parts = target.split(/[\\/]+/).filter((s) => s.length > 0 && s !== '.');
    const stack = [...dir];
    for (const part of parts) {
        if (part === '..') {
            if (stack.length === 0)
                return null;
            stack.pop();
        }
        else {
            stack.push(part);
        }
    }
    return stack.join('/');
}
/** Redact the query/fragment of a URL for logs (tokens live there). */
export function redactUrl(u) {
    try {
        const url = new URL(u);
        url.search = '';
        url.hash = '';
        url.username = '';
        url.password = '';
        return url.toString();
    }
    catch {
        const q = u.search(/[?#]/);
        return q === -1 ? u : u.slice(0, q);
    }
}
export const toPosix = (p) => p.split(path.sep).join('/');
