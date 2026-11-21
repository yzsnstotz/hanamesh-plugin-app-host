import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runProviderSuite,validate,loadContract} from '../src/install-target/suite.js';

const failed=report=>report.results.filter(result=>result.outcome==='fail').map(result=>result.id);
const passed=(report,id)=>report.results.find(result=>result.id===id)?.outcome==='pass';

test('ITC01: provider suite passes on this package, including version match, mismatch, public, invalid, missing-catalog, auth and cancel semantics',async()=>{
  const report=await runProviderSuite();
  assert.deepEqual(failed(report),[]);
  for(const semantic of ['declaration','public','version-match','version-mismatch','invalid','missing-catalog','auth','cancel','confirm','loopback'])
    assert(report.results.some(result=>result.semantic===semantic&&result.outcome==='pass'),'covered: '+semantic);
  assert(passed(report,'PV05/http')&&passed(report,'PV05/client'),'unsupported declaration refused on every entry');
  for(const alias of ['127.0.0.1','localhost'])for(let i=1;i<=21;i++)assert(passed(report,'LB'+String(i).padStart(2,'0')+'/'+alias));
  assert(passed(report,'PC03'));
  assert(passed(report,'PV01/client'),'unversioned v1 input keeps working');
  for(const id of ['RD01','RS01','RS02','RU01','RU02',...Array.from({length:15},(_,i)=>'RB'+String(i+1).padStart(2,'0'))])assert(passed(report,id),'install recovery '+id);
});
test('ITC04: schema, package declaration and validator agree; the v1 field grammar is unchanged',async()=>{
  const {schema,contract,declaration}=await loadContract();
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.deepEqual(pkg.hanamesh.installTarget,declaration);assert.equal(contract.version,'1');assert.deepEqual(contract.supported,['1']);
  assert.deepEqual(validate(schema,{packageName:'@hanamesh/utility-plugin'}),[]);
  assert.deepEqual(validate(schema,{itemId:'x'.repeat(160)}),[]);
  for(const bad of [{},{itemId:'x'.repeat(161)},{packageName:'../escape'},{packageName:'a',version:'1'},{packageName:'a',contractVersion:'2'}])assert.notDeepEqual(validate(schema,bad),[],JSON.stringify(bad));
});
