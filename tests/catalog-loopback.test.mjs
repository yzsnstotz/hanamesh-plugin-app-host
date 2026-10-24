import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateManifestUrl, validateCatalogManifest, loadCatalog} from '../src/library/catalog.js';
import {createLibraryService} from '../src/library/service.js';
const fixture=JSON.parse(await readFile(new URL('./fixtures/catalog/hanamesh-view-v1.json',import.meta.url),'utf8'));
const origins=['http://127.0.0.1','http://127.0.0.1:1','http://127.0.0.1:65535','http://[::1]','http://[::1]:49231','http://localhost','http://LOCALHOST:49232'];
test('CAT-LOOP shipped source schema accepts canonical local attribution homepage and endpoint',async()=>{
 const schema=JSON.parse(await readFile(new URL('../schemas/catalog-source.schema.json',import.meta.url),'utf8'));
 for(const origin of origins.map(value=>new URL(value).origin)){
  for(const [property,url] of [[schema.properties.homepage,origin],[schema.properties.attribution.properties.url,origin],[schema.properties.transport.properties.endpoint,origin+'/v1/plugins']])assert.match(url,new RegExp(property.pattern,'u'));
 }
});
function manifest(origin,hana=true){
 const result=structuredClone(fixture.manifest);result.homepage=origin;result.attribution.url=origin;
 result.transport.endpoint=origin+'/v1/plugins'+(hana?'?view=hanamesh':'');
 if(!hana)delete result.limits;
 return result;
}
for(const origin of origins)test('CAT-LOOP accepts exact loopback HTTP catalog '+origin,async()=>{
 const url=origin+'/catalog-source.json?view=hanamesh';assert.equal(validateManifestUrl(url).origin,new URL(origin).origin);
 for(const hana of [false,true])assert.deepEqual(validateCatalogManifest(manifest(origin,hana)),manifest(origin,hana));
 const calls=[];const result=await loadCatalog({sources:[{manifestUrl:url}],fetchImpl:async(url,options)=>{
  calls.push({url:new URL(url),options});assert.equal(new URL(url).origin,new URL(origin).origin);
  return Response.json(calls.length===1?manifest(origin):fixture.page);
 }});
 assert.equal(calls.length,2);assert.deepEqual(result.items,fixture.page.items);assert.equal(result.source.manifestUrl,new URL(url).href);
});
test('CAT-LOOP nonloopback HTTP and nonstandard HTTPS stay refused before network',async()=>{
 for(const origin of ['http://catalog.example','http://192.168.1.2:8080','http://0.0.0.0:8080','http://[::]:8080','http://[::ffff:127.0.0.1]:8080','http://localhost.example:8080','http://127.0.0.1.example:8080','http://example.localhost:8080','https://catalog.example:8443','https://localhost:8443','ftp://localhost:8080']){
  let calls=0;await assert.rejects(loadCatalog({sources:[{manifestUrl:origin+'/catalog-source.json'}],fetchImpl:async()=>{calls++;}}),{code:'INVALID_CATALOG_URL'});assert.equal(calls,0);
 }
 assert.equal(validateManifestUrl('https://catalog.example:443/catalog-source.json').origin,'https://catalog.example');
});
test('CAT-LOOP credentials query and fragment remain refused on local sources',()=>{
 for(const url of ['http://u:p@localhost:49231/catalog-source.json','http://localhost:49231/catalog-source.json#fragment','http://localhost:49231/catalog-source.json?view=other','http://localhost:49231/catalog-source.json?view=hanamesh&extra=1'])assert.throws(()=>validateManifestUrl(url),{code:'INVALID_CATALOG_URL'});
});
test('CAT-LOOP local source exception does not accept HTTP item display links',()=>{
 // A public source link is display metadata, independent of the selected local transport.
 const page=structuredClone(fixture.page);page.items[0].source.sourceLinks[0].sourceUrl='http://localhost:49231/private';
 return assert.rejects(loadCatalog({sources:[{manifestUrl:'http://localhost:49231/catalog-source.json?view=hanamesh'}],fetchImpl:async url=>Response.json(new URL(url).pathname==='/catalog-source.json'?manifest('http://localhost:49231'):page)}),{code:'INVALID_CATALOG_PAGE'});
});
test('CAT-LOOP origin includes exact host scheme and port; no endpoint or redirect aliases',async()=>{
 const origin='http://127.0.0.1:49231',sources=[{manifestUrl:origin+'/catalog-source.json?view=hanamesh'}];
 for(const foreign of ['http://127.0.0.1:49232','http://localhost:49231','http://[::1]:49231','https://127.0.0.1']){
  let calls=0;await assert.rejects(loadCatalog({sources,fetchImpl:async()=>{calls++;return Response.json({...manifest(origin),transport:{...manifest(origin).transport,endpoint:foreign+'/v1/plugins?view=hanamesh'}});}}),{code:'INVALID_CATALOG_MANIFEST'});assert.equal(calls,1);
  calls=0;await assert.rejects(loadCatalog({sources,fetchImpl:async()=>{calls++;return new Response(null,{status:302,headers:{location:foreign+'/catalog-source.json?view=hanamesh'}});}}),{code:'CATALOG_REDIRECT_DENIED'});assert.equal(calls,1);
 }
});
test('CAT-LOOP local exact target retains directory ID and never installs or maps by package',async t=>{
 const origin='http://127.0.0.1:49231',intended=fixture.page.items[0],service=createLibraryService({domain:{global:{get:async()=>({revision:0,sources:[{manifestUrl:origin+'/catalog-source.json?view=hanamesh'}]}),set:async()=>{}},close:async()=>{}},host:{instanceList:()=>[]},config:{fetchImpl:async url=>Response.json(new URL(url).pathname==='/catalog-source.json'?manifest(origin):fixture.page)}});
 await service.init();t.after(()=>service.close());
 const result=await service.resolveTarget({itemId:intended.itemId,packageName:intended.packageName});assert.equal(result.item.id,intended.itemId);assert.equal(result.source.manifestUrl,origin+'/catalog-source.json?view=hanamesh');assert.deepEqual(service.events().events,[]);
 await assert.rejects(service.resolveTarget({itemId:'same-package-different-directory',packageName:intended.packageName}),{code:'CATALOG_ITEM_MISSING'});
});
