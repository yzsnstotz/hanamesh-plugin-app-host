import test from 'node:test';
import assert from 'node:assert/strict';
import {createLibraryService} from '../src/library/service.js';
import {validateManifestUrl} from '../src/library/catalog.js';

const website='https://s9-rehearsal.localhost:29907';
test('DT2 a fresh rehearsal profile initializes before advertising its installation reader',async t=>{
 let state={schema:1,revision:0,sources:[]},reads=0;
 const library=createLibraryService({
  domain:{global:{get:async()=>structuredClone(state),set:async next=>{state=structuredClone(next)}},close:async()=>{}},
  host:{},client:'hanamesh',config:{sources:[{manifestUrl:website+'/catalog-source.json?view=hanamesh',enabled:true}],handoff:{allowedOrigins:[website]}},
  installationStatus:async()=>{reads++;return{schemaVersion:1,client:'hanamesh',observations:[]}}});
 t.after(()=>library.close());
 await library.init();
 assert.equal(library.sources().sources[0].manifestUrl,website+'/catalog-source.json?view=hanamesh');
 assert.deepEqual(library.handoffSettings().allowedOrigins,[website]);
 assert.equal(library.installTarget().installationStatus.contract,'hanamesh.installation-status');
 assert.equal(reads,0,'initialization and discovery never read another channel');
 await library.installationStatus();assert.equal(reads,1);
});
test('DT2 HTTPS rehearsal names do not admit suffix lookalikes or remote custom ports',()=>{
 assert.equal(validateManifestUrl(website+'/catalog-source.json').origin,website);
 for(const origin of ['https://s9-rehearsal.localhost.example:29907','https://notlocalhost:29907','https://market.example:29907','http://s9-rehearsal.localhost:29907'])
  assert.throws(()=>validateManifestUrl(origin+'/catalog-source.json'),{code:'INVALID_CATALOG_URL'});
});
