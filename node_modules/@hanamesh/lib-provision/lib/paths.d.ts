/** `\\?\C:\x` → `C:\x`; `\\?\UNC\srv\share` → `\\srv\share`. No-op for other paths. */
export declare function stripVerbatimPrefix(p: string): string;
/** Inverse of {@link stripVerbatimPrefix} for absolute Windows paths (used only for opening long paths). */
export declare function toVerbatimPath(p: string): string;
/**
 * The form of a path this library exposes to callers: absolute, normalised,
 * and on Windows never carrying the `\\?\` prefix (which breaks PATH search and
 * string comparison in every consumer that gets it).
 */
export declare function externalPath(p: string, platform?: NodeJS.Platform): string;
/** True when `child` is `parent` or lies strictly inside it (lexically, after resolution). */
export declare function isInside(parent: string, child: string): boolean;
/**
 * Split an archive entry name into safe path segments, or return null when the
 * entry must be refused (absolute, drive-qualified, `..`, NUL, empty).
 * Both `/` and `\` are treated as separators because zip writers disagree.
 */
export declare function safeEntrySegments(name: string): string[] | null;
/**
 * Resolve a symlink target relative to the entry's directory and check that it
 * stays inside the tree. Returns the normalised relative POSIX target path of the
 * link destination, or null when the link would escape.
 */
export declare function safeLinkTarget(entrySegments: string[], target: string): string | null;
/** Redact the query/fragment of a URL for logs (tokens live there). */
export declare function redactUrl(u: string): string;
export declare const toPosix: (p: string) => string;
