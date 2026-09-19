/**
 * Normalised platform key. Only `process.platform` and `process.arch` are consulted;
 * nothing installed on the host is ever probed.
 */
export function platformKey(platform = process.platform, arch = process.arch) {
    return `${platform}-${arch}`;
}
