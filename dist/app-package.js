import { requireCondition } from './errors.js';

/** Current HanaMesh application npm package contract (docs/APP_PACKAGE.md). */
export const APP_PACKAGE_CONTRACT_VERSION = 2;

/**
 * rc.42: executable part of the app package contract v2 for an app's own tests — given the imported bundle entry
 * (`import * as entry from '<pkg>/dsh'`) and its package.json, refuse the shapes that make DSH depend on this host:
 * a top-level `inject` naming `hanameshApps` (array or map form) keeps the bundle pending once the host is gone, and
 * the pinned DSH boot treats any pending Loader entry as fatal. It does not execute the entry.
 */
export function checkAppPackageEntry(entry, packageJson) {
  requireCondition(entry && typeof entry.apply === 'function', 'INVALID_APP_PACKAGE', 'The bundle entry must export apply(ctx, config).');
  const inject = entry.inject;
  const names = inject === undefined ? [] : Array.isArray(inject) ? inject : inject && typeof inject === 'object' ? Object.keys(inject) : null;
  requireCondition(names !== null, 'INVALID_APP_PACKAGE', 'inject must be omitted, an array, or a name map.');
  requireCondition(!names.includes('hanameshApps'), 'APP_PACKAGE_HOST_REQUIRED',
    'Contract v2: do not declare hanameshApps as a top-level inject; subscribe with ctx.inject([\'hanameshApps\'], …) inside apply().');
  const declared = packageJson?.hanamesh?.contractVersion;
  requireCondition(declared === APP_PACKAGE_CONTRACT_VERSION, 'APP_PACKAGE_CONTRACT_VERSION',
    `package.json hanamesh.contractVersion must be ${APP_PACKAGE_CONTRACT_VERSION}.`, { declared: declared ?? null });
  return { contractVersion: APP_PACKAGE_CONTRACT_VERSION, hostLifecycle: 'host-optional' };
}
