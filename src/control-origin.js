import {workspaceOrigin, loopbackOrigin} from './descriptor.js';
import {DESKTOP_ORIGIN} from './workspace-origin.js';
/** Desktop authenticates and forwards to HTTP after removing Origin; keep both identities. */
export function controlOrigins(parentOrigin, transportOrigin) {
  const parent = workspaceOrigin(parentOrigin);
  const transport = loopbackOrigin(transportOrigin ?? parent);
  return {parent, transport, forwarded: parent === DESKTOP_ORIGIN,
    acceptsOrigin: origin => origin === parent || (parent === DESKTOP_ORIGIN && origin === undefined)};
}
