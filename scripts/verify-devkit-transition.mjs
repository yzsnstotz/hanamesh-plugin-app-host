/** Reuse the mature pack engine/policy; only recheck the changed development dependency and package boundary. */
import {realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {readFile} from 'node:fs/promises';
import {verifyPack} from '@hanamesh/devkit';
import {packOptions} from '../devkit.config.mjs';
import {typescript} from './package-probes.mjs';
const options=packOptions(process.argv[2]);options.temporaryRoot=await realpath(tmpdir());
const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url)));
await verifyPack({...options,consumer:{packageJson:{private:true,type:'module',dependencies:{'@hanamesh/dsh-app-host':`file:${options.tarball}`}},javascript:`
import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {AppHost,AtomicFileStore} from '@hanamesh/dsh-app-host';
import {WorkspaceAppClient} from '@hanamesh/dsh-app-host/client';
import {runCatalogProviderSuite,runCatalogConsumerSuite} from '@hanamesh/dsh-app-host/catalog/suite';
import {runProviderSuite,runConsumerSuite,runChainSuite} from '@hanamesh/dsh-app-host/install-target/suite';
import pkg from '@hanamesh/dsh-app-host/package.json' with {type:'json'};
for(const api of [AppHost,AtomicFileStore,WorkspaceAppClient,runCatalogProviderSuite,runCatalogConsumerSuite,runProviderSuite,runConsumerSuite,runChainSuite])assert.equal(typeof api,'function');
assert.equal(pkg.version,'0.4.0');assert.equal(pkg.dependencies['@hanamesh/devkit'],undefined);
assert.equal(pkg.peerDependencies['@hanamesh/devkit'],'^0.2.0');
assert.throws(()=>createRequire(import.meta.url).resolve('@hanamesh/devkit'),{code:'MODULE_NOT_FOUND'});
console.log(JSON.stringify({result:'PASS',packageVersion:pkg.version,runtimeDevkit:false,normalPackageExports:true,oldBusinessSuites:'NOT_RERUN; unchanged bytes'}));
`}});
const peers=Object.fromEntries(Object.entries(pkg.peerDependencies).filter(([name])=>name!=='@hanamesh/devkit'));
await verifyPack({...options,consumer:{packageJson:{private:true,type:'module',dependencies:{...peers,'@hanamesh/dsh-app-host':`file:${options.tarball}`}},javascript:"import assert from 'node:assert/strict';import {apply} from '@hanamesh/dsh-app-host/dsh';assert.equal(typeof apply,'function');",typescript}});
