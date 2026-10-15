import semver from 'semver';

/** Public host compatibility; exact dependency versions in devDependencies remain reproducible test inputs. */
export const DSH_RANGE='>=0.2.0-rc.2 <0.3.0-0 || >=0.2.1-0 <0.3.0-0';
/** saveExact entered the public PluginManager contract in 0.2.1-alpha.2. Unknown versions fail closed. */
export function managerSupportsExactSave(version){return typeof version==='string'&&semver.satisfies(version,'>=0.2.1-alpha.2 <0.3.0-0',{includePrerelease:true});}
