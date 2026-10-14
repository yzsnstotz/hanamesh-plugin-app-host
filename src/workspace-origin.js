/** Browser-safe validation. Privileged origins do not have a WHATWG URL.origin in Node. */
export const DESKTOP_ORIGIN = 'dsh-app://app';
export function isWorkspaceOrigin(value) {
  if (value === DESKTOP_ORIGIN) return true;
  try {
    const url = new URL(value);
    return url.origin === value && url.protocol === 'http:' && url.hostname === '127.0.0.1' && Boolean(url.port);
  } catch { return false; }
}
/** A document URL's origin; never turn an arbitrary opaque scheme into a trusted origin. */
export function documentOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'dsh-app:' && url.host === 'app' && !url.username && !url.password) return DESKTOP_ORIGIN;
    return url.origin;
  } catch { return undefined; }
}
