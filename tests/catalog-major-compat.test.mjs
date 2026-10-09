import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateCatalogManifest,validateProviderPage,loadCatalog} from '../src/library/catalog.js';
const manifest={manifestVersion:'1.0.0',providerId:'com.hanamesh.market',name:'SOURCE catalog',attribution:{name:'SOURCE',url:'https://hanamesh.com'},transport:{kind:'https-json',endpoint:'https://catalog.hanamesh.com/v1/plugins',method:'GET'},query:{supported:['q','cursor','limit'],defaultLimit:50,maxLimit:50,sorts:[]}};
const page=JSON.parse(await readFile(new URL('./fixtures/catalog/provider-page.json',import.meta.url)));
test('CAT-V01: valid same-major catalog minor/patch/prerelease/build inputs preserve the original shape and optional additions',async()=>{
  for(const version of ['1.0.0','1.1.0','1.23.4','1.2.0-rc.1+build.001']){
    const m={...manifest,manifestVersion:version,attribution:{...manifest.attribution,notice:'SOURCE additive notice'}};
    const p={...page,schemaVersion:version,items:page.items.map(item=>({...item,updatedAt:'2026-10-09T00:00:00Z'}))};
    assert.doesNotThrow(()=>validateCatalogManifest(m),"compatible catalog manifest must be accepted");assert.doesNotThrow(()=>validateProviderPage(p),"compatible catalog page must be accepted");
    assert.deepEqual(validateCatalogManifest(m),m);assert.deepEqual(validateProviderPage(p),p);
    const responses=[m,p];
    const result=await loadCatalog({sources:[{manifestUrl:new URL('/catalog-source.json',m.transport.endpoint).href}],fetchImpl:async()=>new Response(JSON.stringify(responses.shift()),{headers:{'content-type':'application/json'}})});
    assert.deepEqual(result.items,p.items);assert.equal(result.schemaVersion,version);
  }
});
test('CAT-V02: different major or malformed version is refused, and same major never skips shape/trust checks',()=>{
  for(const version of ['0.9.0','2.0.0','1','01.0.0','1.01.0','1.0.01','1.0.0-01','1.0.0-','1.0.0+','v1.0.0','1.0.0\n',1,null]){
    assert.throws(()=>validateCatalogManifest({...manifest,manifestVersion:version}),{code:'INVALID_CATALOG_MANIFEST'});
    assert.throws(()=>validateProviderPage({...page,schemaVersion:version}),{code:'INVALID_CATALOG_PAGE'});
  }
  assert.throws(()=>validateCatalogManifest({...manifest,manifestVersion:'1.1.0',transport:{...manifest.transport,method:'POST'}}));
  assert.throws(()=>validateCatalogManifest({...manifest,manifestVersion:'1.1.0',transport:{...manifest.transport,endpoint:'http://evil.test/v1/plugins'}}));
  assert.throws(()=>validateProviderPage({...page,schemaVersion:'1.1.0',items:[{...page.items[0],updatedAt:'yesterday'}]}));
  assert.throws(()=>validateProviderPage({...page,schemaVersion:'1.1.0',unknown:true}));
});

import {runCatalogProviderSuite,runCatalogConsumerSuite} from '../src/catalog/suite.js';
test('CAT-V03: shipped provider/consumer fixtures exercise the actual implementation',async()=>{
  for(const report of [await runCatalogProviderSuite(),await runCatalogConsumerSuite()])assert.equal(report.fail,0,JSON.stringify(report.results));
});
