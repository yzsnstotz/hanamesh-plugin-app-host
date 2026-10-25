import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateProviderPage,loadCatalog} from '../src/library/catalog.js';
const read=async name=>JSON.parse(await readFile(new URL(name,import.meta.url),'utf8'));
const captured=await read('./fixtures/r1-combo-catalog-page.json');
const manifest=await read('./fixtures/r1-combo-catalog-source.json');
const suiteRow=page=>page.items.find(item=>item.suite);
const page=()=>structuredClone(captured);
test('STD01 R1 actual 26-item response is accepted and preserved without editing upstream fields',async()=>{
 const bytes=await readFile(new URL('./fixtures/r1-combo-catalog-page.json',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'42e6adead8558fbc9191560bef58e7cf9208d1088af25b4c7a822a98368e0c81');
 assert.equal(captured.items.length,26);assert.deepEqual(validateProviderPage(captured),captured);
 const calls=[];const result=await loadCatalog({sources:[{manifestUrl:new URL('/catalog-source.json?view=hanamesh',manifest.transport.endpoint).href}],fetchImpl:async url=>{
  calls.push(String(url));return Response.json(calls.length===1?manifest:captured);
 }});
 assert.equal(calls.length,2);assert.deepEqual(result.items,captured.items);
 assert.equal(suiteRow(result).suite.installTargets[2].source.version,'0.6.13','captured provider fact is not this consumer version');
});
const changes={
 'unknown suite field':s=>{s.unknown=true;},
 'unknown agent field':s=>{s.agentPlugins[0].unknown=true;},
 'unknown target field':s=>{s.installTargets[0].unknown=true;},
 'unknown source field':s=>{s.installTargets[0].source.repo='extra';},
 'npm name mismatch':s=>{s.installTargets[0].source.name='@other/core';},
 'npm target identity mismatch':s=>{s.installTargets[0].npmPackageName='@other/core';s.installTargets[0].source.name='@other/core';},
 'npm repo mismatch':s=>{s.installTargets[0].githubRepo='other/core';},
 'npm version mismatch':s=>{s.installTargets[0].source.version='0.3.22';},
 'component version mismatch':s=>{s.components[0].version='0.3.22';},
 'component name mismatch':s=>{s.components[0].npmPackageName='hanamesh-core';},
 'missing target version':s=>{delete s.installTargets[0].version;},
 'missing component facts':s=>{delete s.components;},
 'duplicate target':s=>{s.installTargets[1]=s.installTargets[0];},
 'missing target':s=>{s.installTargets.pop();},
 'brand target':s=>{s.installTargets[2]={...s.components[3],source:{source:'npm',name:'@hanamesh/brand',version:'0.1.3'}};},
 'duplicate component':s=>{s.components[3]=s.components[0];},
 'bad source discriminator':s=>{s.installTargets[0].source.source='archive';},
 'noncanonical agent row':s=>{s.canonicalHanaId='another';},
 'agent wrong host':s=>{s.agentPlugins[0].host='dsh';},
 'agent duplicate host':s=>{s.agentPlugins[1].host='claude';},
 'agent wrong name':s=>{s.agentPlugins[0].pluginName='other';},
 'agent wrong id':s=>{s.agentPlugins[0].pluginId='other@hanamesh';},
 'agent wrong marketplace':s=>{s.agentPlugins[0].marketplaceUrl='https://other.example/market';},
 'agent distribution mismatch':s=>{s.agentPlugins[0].version='0.1.4';},
 'agent missing distribution':s=>{delete s.distributionVersion;},
 'agent empty':s=>{s.agentPlugins=[];},
};
for(const [name,change] of Object.entries(changes))test('STD02 rejects '+name,()=>{
 const p=page();change(suiteRow(p).suite);assert.throws(()=>validateProviderPage(p),{code:'INVALID_CATALOG_PAGE'});
});
test('STD03 exact versions reject tags ranges malformed and control-bearing values',()=>{
 for(const version of ['latest','^1.0.0','~1.0.0','v1.0.0','01.0.0','1.0','1.0.0\n','1.0.0-01','']){
  const p=page(),s=suiteRow(p).suite;s.components[0].version=s.installTargets[0].version=s.installTargets[0].source.version=version;
  assert.throws(()=>validateProviderPage(p),{code:'INVALID_CATALOG_PAGE'},version);
 }
 const p=page(),s=suiteRow(p).suite;s.components[0].version=s.installTargets[0].version=s.installTargets[0].source.version='1.2.3-rc.1+build.7';assert.deepEqual(validateProviderPage(p),p);
});
test('STD04 historical immutable Git DTO remains readable with optional version facts',()=>{
 const p=page(),s=suiteRow(p).suite;delete s.agentPlugins;delete s.distributionVersion;delete s.components;
 for(const t of s.installTargets){delete t.version;t.source={source:'github',repo:t.githubRepo,ref:'a'.repeat(40)};}
 assert.deepEqual(validateProviderPage(p),p);
 for(const source of [{source:'github',repo:'other/repo',ref:'a'.repeat(40)},{source:'github',repo:s.installTargets[0].githubRepo,ref:'main'},{...s.installTargets[0].source,name:'extra'}]){
  const bad=structuredClone(p);suiteRow(bad).suite.installTargets[0].source=source;assert.throws(()=>validateProviderPage(bad),{code:'INVALID_CATALOG_PAGE'});
 }
});
test('STD05 optional declarations retain component aliases and missing installation facts',()=>{
 for(const [component,role] of [['core','component'],['app-host','component'],['brand','client-only']]){
  const p=page();suiteRow(p).suite={schemaVersion:1,id:'hanamesh',role,component,canonicalHanaId:null,installable:false};assert.deepEqual(validateProviderPage(p),p);
 }
 const p=page();suiteRow(p).suite.agentPlugins.pop();assert.deepEqual(validateProviderPage(p),p);
});
test('STD06 shipped schema carries both strict source branches and agent declaration',async()=>{
 const s=await read('../schemas/catalog-provider-page.schema.json'),suite=s.$defs.hana_suite;
 assert.equal(suite.additionalProperties,false);assert.equal(suite.properties.agentPlugins.items.additionalProperties,false);
 assert.deepEqual(suite.properties.installTargets.items.properties.source.oneOf.map(s=>s.properties.source.const),['github','npm']);
 for(const v of ['0.3.0-rc.6','1.2.3+build.7'])assert.match(v,new RegExp(s.$defs.hana_semver.pattern,'u'));
 for(const v of ['latest','^1.0.0','1.0.0\n'])assert.doesNotMatch(v,new RegExp(s.$defs.hana_semver.pattern,'u'));
});
