import test from 'node:test';
import assert from 'node:assert/strict';
import {createLibraryService} from '../src/library/service.js';
import {validateManifestUrl} from '../src/library/catalog.js';

const website='https://s9-rehearsal.localhost:29907';
test('DT2 a fresh rehearsal profile initializes its application catalog',async t=>{
 let state={schema:1,revision:0,sources:[]};
 const library=createLibraryService({
  domain:{global:{get:async()=>structuredClone(state),set:async next=>{state=structuredClone(next)}},close:async()=>{}},
  host:{},config:{sources:[{manifestUrl:website+'/catalog-source.json?view=hanamesh',enabled:true}]}});
 t.after(()=>library.close());
 await library.init();
 assert.equal(library.sources().sources[0].manifestUrl,website+'/catalog-source.json?view=hanamesh');
});
test('DT2 HTTPS rehearsal names do not admit suffix lookalikes or remote custom ports',()=>{
 assert.equal(validateManifestUrl(website+'/catalog-source.json').origin,website);
 for(const origin of ['https://s9-rehearsal.localhost.example:29907','https://notlocalhost:29907','https://market.example:29907','http://s9-rehearsal.localhost:29907'])
  assert.throws(()=>validateManifestUrl(origin+'/catalog-source.json'),{code:'INVALID_CATALOG_URL'});
});
