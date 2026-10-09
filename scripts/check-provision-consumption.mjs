import assert from 'node:assert/strict';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describeInstalled,checkSupply,providerFixture,consumerFixture} from '@hanamesh/lib-provision/contract/conformance.mjs';

const packageRoot=dirname(fileURLToPath(import.meta.resolve('@hanamesh/lib-provision/package.json')));
const actual=await describeInstalled(packageRoot);
const requirement={...consumerFixture,api:[...new Set([...consumerFixture.api,'ledger'])]};
assert.deepEqual(actual,providerFixture,'installed provider must match its own published fixture');
assert.deepEqual(checkSupply(actual,requirement),[],'AppHost provision/remove/ledger requirements');
assert.ok(checkSupply({...actual,version:'1.0.0',source:{...actual.source,tag:'v1.0.0'}},requirement).some(error=>error.includes('major')));
console.log(JSON.stringify({result:'PASS',packageRoot,provider:actual,requirement,suite:'@hanamesh/lib-provision/contract/conformance.mjs'}));
