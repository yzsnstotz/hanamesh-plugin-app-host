import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// Observe the actual two consumer options without performing network installs in unit tests.
// Real strict-install omission checks are retained in the card's package evidence.
for(const name of ['@deepseek-ai/dsh-storage','@deepseek-ai/dsh-invariants','@deepseek-ai/dsh-scope']){
  test(`J1S2-AH-05: strict host consumer explicitly supplies ${name}`,()=>{
    const source=`
      import assert from 'node:assert/strict';
      import {mock} from 'node:test';
      import {readFile} from 'node:fs/promises';
      const pkg=JSON.parse(await readFile('./package.json','utf8'));
      let calls=0;
      mock.module('@hanamesh/devkit',{namedExports:{runMutations(){},async verifyPack(options){
        const deps=options.consumer.packageJson.dependencies;
        if(++calls===1){
          assert.deepEqual(Object.keys(deps),['@hanamesh/dsh-app-host']);
          throw Object.assign(new Error('Command failed: pnpm install --prefer-offline --strict-peer-dependencies --frozen-lockfile=false'),{
            status:1,signal:null,stdout:'ERR_PNPM_PEER_DEP_ISSUES\\n'+Object.entries(pkg.peerDependencies).map(([n,v])=>'missing peer '+n+'@'+v).join('\\n'),stderr:''});
        }
        assert.equal(deps[${JSON.stringify(name)}],'0.2.0-rc.2','consumer must explicitly supply transitive host peer: '+${JSON.stringify(name)});
        for(const [n,v] of Object.entries(pkg.peerDependencies))assert.equal(deps[n],v);
        assert.equal(Object.keys(deps).length,13,'nine direct peers, three transitive peers, AppHost');
      }}});
      const {verifyAppHostPack}=await import('./devkit.config.mjs');
      await verifyAppHostPack('unused-unit-test.tgz');
      assert.equal(calls,2);
    `;
    const result=spawnSync(process.execPath,['--experimental-test-module-mocks','--input-type=module','-e',source],{
      cwd:new URL('..',import.meta.url),encoding:'utf8',env:process.env});
    assert.equal(result.error,undefined);
    assert.equal(result.signal,null);
    assert.equal(result.status,0,result.stdout+result.stderr);
  });
}
