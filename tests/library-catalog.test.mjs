import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { loadCatalog, isApplication, validateManifestUrl } from '../src/library/catalog.js';

const fixture=resolve('tests/fixtures/catalog/provider-page.json');

test('AH-L01: fixture catalog validates all entries and exposes only installable HanaMesh applications',async()=>{
  const page=await loadCatalog({fixture});
  assert.equal(page.items.length,3);
  assert.deepEqual(page.items.filter(isApplication).map(item=>item.package.name),['@hanamesh/app-vibe-trading']);
});

test('AH-L02: catalog URLs are standard-port HTTPS and redirects remain same-origin',async()=>{
  assert.equal(validateManifestUrl('https://catalog.hanamesh.com/catalog-source.json').origin,'https://catalog.hanamesh.com');
  for(const value of ['http://catalog.hanamesh.com/catalog-source.json','https://u:p@catalog.hanamesh.com/catalog-source.json','https://catalog.hanamesh.com:8443/catalog-source.json','https://catalog.hanamesh.com/catalog-source.json?q=x'])
    assert.throws(()=>validateManifestUrl(value),{code:'INVALID_CATALOG_URL'});
  const responses=[
    new Response(null,{status:302,headers:{location:'https://catalog.hanamesh.com/manifest.json'}}),
    new Response(JSON.stringify({manifestVersion:'1.0.0',providerId:'com.hanamesh.market',name:'HanaMesh',attribution:{name:'HanaMesh',url:'https://hanamesh.com'},transport:{kind:'https-json',endpoint:'https://catalog.hanamesh.com/v1/plugins',method:'GET'},query:{supported:['q','cursor','limit'],defaultLimit:50,maxLimit:50,sorts:[]}}),{headers:{'content-type':'application/json'}}),
    new Response(JSON.stringify({schemaVersion:'1.0.0',items:[],page:{}}),{headers:{'content-type':'application/json'}}),
  ];
  const requests=[];
  const fetchImpl=async(url,init)=>{requests.push([String(url),init]);return responses.shift();};
  const page=await loadCatalog({sources:[{manifestUrl:'https://catalog.hanamesh.com/catalog-source.json',enabled:true}],fetchImpl,query:'vibe'});
  assert.equal(page.items.length,0);
  assert.match(requests[2][0],/q=vibe/);
  assert.equal(requests[2][1].headers['accept-encoding'],'identity');
});
