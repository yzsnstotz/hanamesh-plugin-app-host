export { AppHost } from './manager.js';
export { AppHostError } from './errors.js';
export { AtomicFileStore, DshDomainSnapshotStore } from './store.js';
export { createHttpHandler } from './routes.js';
export { FixedGateway, rewriteCsp, embeddingHeaders } from './gateway.js';
export { validateDefinition } from './descriptor.js';
export { createUsageEvidence, hourBucket, SOURCE_PLUGIN } from './usage-evidence.js';
/** Bundle root: core API plus a lazy Cordis plugin face, so client-modules can discover this package. */
export const name = 'hanamesh-app-host';
export const inject = ['webServer', 'storageDomain', 'connection'];
export async function apply(ctx, config = {}) {
  const plugin = await import('./dsh.js');
  return await plugin.apply(ctx, config);
}
