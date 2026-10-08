import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runProviderSuite,runConsumerSuite,runChainSuite,validate,loadContract} from '../src/install-target/suite.js';
import {createReferenceConsumer} from '../src/install-target/fixtures/reference-consumer.js';

const failed=report=>report.results.filter(result=>result.outcome==='fail').map(result=>result.id);
const passed=(report,id)=>report.results.find(result=>result.id===id)?.outcome==='pass';

test('ITC01: provider suite passes on this package, including version match, mismatch, public, invalid, missing-catalog, auth and cancel semantics',async()=>{
  const report=await runProviderSuite();
  assert.deepEqual(failed(report),[]);
  for(const semantic of ['declaration','public','version-match','version-mismatch','invalid','missing-catalog','auth','cancel','confirm','loopback'])
    assert(report.results.some(result=>result.semantic===semantic&&result.outcome==='pass'),'covered: '+semantic);
  assert(passed(report,'PV05/http')&&passed(report,'PV05/client')&&passed(report,'PF03/fragment'),'unsupported declaration refused on every entry');
  for(const alias of ['127.0.0.1','localhost'])for(let i=1;i<=21;i++)assert(passed(report,'LB'+String(i).padStart(2,'0')+'/'+alias));
  assert(passed(report,'PC03'));
  assert(passed(report,'PF01/fragment')&&passed(report,'PV01/client'),'unversioned v1 input keeps working');
});
test('ITC02: versioned and unversioned reference consumers pass the consumer and chain suites',async()=>{
  for(const consumer of [createReferenceConsumer(),createReferenceConsumer({contractVersion:undefined})]){
    const own=await runConsumerSuite(consumer),chain=await runChainSuite(consumer);
    assert.deepEqual([failed(own),failed(chain)],[[],[]],consumer.name);
    assert(passed(chain,'CX-MISMATCH'));
  }
  assert.throws(()=>createReferenceConsumer({contractVersion:'2'}),/Unsupported install-target contract version/);
});
test('ITC03: the consumer suite catches a caller that forwards untrusted fields, loses workspace authentication, or accepts any provider',async()=>{
  const honest=createReferenceConsumer();
  const careless={name:'careless',contractVersion:'1',handshake:()=>({ok:true}),navigate(workspace,target){const url=new URL(workspace);url.search='';url.hash='hanamesh-install?'+new URLSearchParams({...target,contractVersion:'1'});return{ok:true,url:url.href};}};
  const report=await runConsumerSuite(careless);
  for(const id of ['CN01','CR01','CR02','CR03','CH02','CH03','CH04'])assert(failed(report).includes(id),'detected '+id);
  assert.deepEqual(failed(await runConsumerSuite(honest)),[]);
  const future={...honest,name:'future',contractVersion:'2'};
  assert(failed(await runConsumerSuite(future)).includes('CD01'),'unsupported consumer declaration is reported');
});
test('ITC04: schema, package declaration and validator agree; the v1 field grammar is unchanged',async()=>{
  const {schema,contract,declaration}=await loadContract();
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.deepEqual(pkg.hanamesh.installTarget,declaration);assert.equal(contract.version,'1');assert.deepEqual(contract.supported,['1']);
  assert.deepEqual(validate(schema,{packageName:'@hanamesh/utility-plugin'}),[]);
  assert.deepEqual(validate(schema,{itemId:'x'.repeat(160)}),[]);
  for(const bad of [{},{itemId:'x'.repeat(161)},{packageName:'../escape'},{packageName:'a',version:'1'},{packageName:'a',contractVersion:'2'}])assert.notDeepEqual(validate(schema,bad),[],JSON.stringify(bad));
});

test('ITC05: a consumer that silently rewrites localhost to 127 is refused by the consumer suite',async()=>{
  const honest=createReferenceConsumer();
  const redirected={...honest,navigate(workspace,target){const result=honest.navigate(workspace,target);if(result.ok){const url=new URL(result.url);url.hostname='127.0.0.1';return{ok:true,url:url.href};}return result;}};
  assert(failed(await runConsumerSuite(redirected)).includes('CN01/localhost'));
});
