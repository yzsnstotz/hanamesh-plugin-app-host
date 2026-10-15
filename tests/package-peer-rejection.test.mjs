import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as policy from '../devkit.config.mjs';

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const peers=Object.entries(pkg.peerDependencies).map(([name,version])=>`${name}@${version}`);
function rejection(list=peers){
  return Object.assign(new Error('Command failed: pnpm install --prefer-offline --strict-peer-dependencies --frozen-lockfile=false'),{
    status:1,signal:null,stdout:Buffer.from('ERR_PNPM_PEER_DEP_ISSUES Unmet peer dependencies\n'+
      list.map(peer=>`  ├── ✕ missing peer ${peer}`).join('\n')),stderr:Buffer.alloc(0),
  });
}

test('J1S2-AH-05: accepts only the exact nine declared host peers, including versions',()=>{
  assert.equal(typeof policy.assertHostPeerInstallRejected,'function','strict host-peer rejection policy is required');
  assert.equal(peers.length,9);
  assert.deepEqual(policy.assertHostPeerInstallRejected(rejection([...peers].reverse())),[...peers].sort());
});

test('strict peer diagnostics preserve pnpm quoted whitespace ranges',()=>{
  const quoted=Object.entries(pkg.peerDependencies).map(([name,range])=>`${name}@${range.includes(' ')?JSON.stringify(range):range}`);
  assert.deepEqual(policy.assertHostPeerInstallRejected(rejection(quoted)),[...peers].sort());
});

test('J1S2-AH-05: missing, extra, duplicate and wrong-version peer lists fail',()=>{
  for(const list of [peers.slice(1),[...peers,'unexpected-peer@1.0.0'],[...peers,peers[0]],
    peers.map(peer=>peer==='react@^18.3.1'?'react@19.0.0':peer)]){
    assert.throws(()=>policy.assertHostPeerInstallRejected(rejection(list)),{code:'ERR_ASSERTION'});
  }
});

test('J1S2-AH-05: unrelated install, process and probe failures are not accepted',()=>{
  for(const error of [Object.assign(rejection(),{status:0}),Object.assign(rejection(),{signal:'SIGKILL'}),
    Object.assign(rejection(),{stdout:Buffer.from('ERR_PNPM_FETCH_404')}),
    Object.assign(rejection(),{message:'Command failed: pnpm install --prefer-offline --strict-peer-dependencies --frozen-lockfile'}),
    Object.assign(rejection(),{message:'Command failed: node check.mjs'}),new Error('archive validation failed')]){
    assert.throws(()=>policy.assertHostPeerInstallRejected(error),{code:'ERR_ASSERTION'});
  }
});

test('J1S2-AH-05: additional incompatible peers and other pnpm errors fail',()=>{
  for(const extra of ['\n  ✕ unmet peer other@1.0.0: found 2.0.0','\nERR_PNPM_FETCH_404']){
    const error=rejection();error.stderr=Buffer.from(extra);
    assert.throws(()=>policy.assertHostPeerInstallRejected(error),{code:'ERR_ASSERTION'});
  }
});
