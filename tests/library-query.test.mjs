// rc.16: the library browses applications by default (category=hanamesh-app), passes q/cursor through, and rejects unknown params.
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCatalog} from '../src/library/catalog.js';

const manifest={manifestVersion:'1.0.0',providerId:'com.hanamesh.market',name:'HanaMesh',description:'d',homepage:'https://market.example',attribution:{name:'HanaMesh',url:'https://market.example',notice:'n'},transport:{kind:'https-json',endpoint:'https://market.example/v1/plugins',method:'GET'},query:{supported:['q','category','cursor','limit'],defaultLimit:50,maxLimit:200,sorts:[]}};
const page={schemaVersion:'1.0.0',generatedAt:'2026-09-20T00:00:00.000Z',revision:'r1',items:[],page:{nextCursor:null,total:0}};
function fetcher(requests){return async(url)=>{requests.push(String(url));const body=String(url).endsWith('/catalog-source.json')?manifest:page;return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});};}

test('AH-L10: category, q and cursor reach the provider endpoint', async () => {
  const requests=[];
  await loadCatalog({sources:[{manifestUrl:'https://market.example/catalog-source.json',enabled:true}],fetchImpl:fetcher(requests),query:'vibe',category:'hanamesh-app',cursor:'c1'});
  const u=new URL(requests[1]);
  assert.equal(u.searchParams.get('q'),'vibe');assert.equal(u.searchParams.get('category'),'hanamesh-app');assert.equal(u.searchParams.get('cursor'),'c1');assert.equal(u.searchParams.get('limit'),'50');
  const none=[];
  await loadCatalog({sources:[{manifestUrl:'https://market.example/catalog-source.json',enabled:true}],fetchImpl:fetcher(none),category:''});
  assert.equal(new URL(none[1]).searchParams.has('category'),false);
});
