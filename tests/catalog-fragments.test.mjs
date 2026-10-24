import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateProviderPage,validateManifestUrl,validateCatalogManifest} from '../src/library/catalog.js';
// Expected projection of G78 saved 28 public rows; fragments are display data, not request targets.
// Derived offline from raw snapshot SHA256 2287f97220c012202e69bcf672a6c67d9f2bb54bcd1bbbeacdbdace651c278d3.
const fixture=()=>JSON.parse(readFileSync(new URL('./fixtures/g78-catalog-page-28.json',import.meta.url),'utf8'));
const usage='00592d1a-651c-4e93-a685-036cb055f43f';
test('CAT-FRAGMENT all 28 real projected rows retain exact source links and identities',()=>{
 const page=fixture();assert.equal(page.items.length,28);assert.deepEqual(validateProviderPage(page),page);
 const links=page.items.flatMap(item=>item.source.sourceLinks).filter(link=>link.sourceUrl.endsWith('#readme'));
 assert.deepEqual(links.map(link=>link.sourceUrl).sort(),['https://github.com/yzsnstotz/hanamesh-recommender#readme','https://github.com/yzsnstotz/hanamesh-usage#readme']);
});
test('CAT-FRAGMENT homepage repository publisher retain exact display URLs',()=>{
 const page=fixture(),item=page.items.find(item=>item.id===usage);
 item.homepage='https://GITHUB.com/yzsnstotz/hanamesh-usage#readme';
 item.repository.url='https://github.com/yzsnstotz/hanamesh-usage#readme';
 item.publisher.url='https://github.com/yzsnstotz#readme';
 assert.deepEqual(validateProviderPage(page),page);
});
test('CAT-FRAGMENT non-HTTPS and credentialed source links remain invalid for the whole page',()=>{
 for(const url of ['http://github.com/yzsnstotz/hanamesh-usage#readme','https://user:secret@github.com/yzsnstotz/hanamesh-usage#readme','https://github.com:8443/yzsnstotz/hanamesh-usage#readme']){
  const page=fixture();page.items[0].source.sourceLinks[0].sourceUrl=url;
  assert.throws(()=>validateProviderPage(page),{code:'INVALID_CATALOG_PAGE'});
 }
});
test('CAT-FRAGMENT manifest and transport request URLs still reject fragment',()=>{
 for(const origin of ['https://market.example','http://127.0.0.1:49231']){
  assert.throws(()=>validateManifestUrl(origin+'/catalog-source.json?view=hanamesh#readme'),{code:'INVALID_CATALOG_URL'});
  assert.throws(()=>validateCatalogManifest({transport:{endpoint:origin+'/v1/plugins?view=hanamesh#readme'}}),{code:'INVALID_CATALOG_MANIFEST'});
 }
});
