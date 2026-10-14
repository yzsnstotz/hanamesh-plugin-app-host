import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {validateCatalogManifest,validateProviderPage,loadCatalog} from '../src/library/catalog.js';
import {createLibraryService} from '../src/library/service.js';
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

// Q-321: exact examples from the formally appended C-WEB-CATALOG v0, version 1.
// The anonymous HTTP provider is a counterpart, not web-market implementation.
const hana = JSON.parse(await readFile(new URL('./fixtures/catalog/hanamesh-view-v1.json', import.meta.url)));

function hanaSource({pages = [hana.page], fault, faultOnCursor = false} = {}) {
  const requests = [], cursors = pages.slice(1).map(() => randomUUID());
  const fetchImpl = async (url, init = {}) => {
    url = new URL(url); requests.push({url, init});
    if (url.pathname === '/catalog-source.json') return new Response(JSON.stringify(hana.manifest), {headers: {'content-type': 'application/json; charset=utf-8'}});
    assert.equal(url.pathname, '/v1/plugins', 'only the declared catalog endpoint is contacted');
    if (fault && (!faultOnCursor || url.searchParams.has('cursor'))) return new Response(JSON.stringify(fault.body), {status: fault.status, headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}});
    const cursor = url.searchParams.get('cursor'), index = cursor === null ? 0 : cursors.indexOf(cursor) + 1;
    assert.ok(cursor === null || index > 0, 'provider-issued opaque cursor is passed back without invention');
    const value = structuredClone(pages[index]);
    assert.ok(value, 'no request after the terminal page');
    value.page = index < pages.length - 1 ? {nextCursor: cursors[index], total: pages.reduce((n, p) => n + p.items.length, 0)} : {};
    return new Response(JSON.stringify(value), {headers: {'content-type': 'application/json; charset=utf-8'}});
  };
  return {requests, cursors, fetchImpl, sources: [{manifestUrl: hana.manifestUrl, enabled: true}]};
}
async function hanaLibrary(t, source) {
  let state = {schema: 1, revision: 0, sources: structuredClone(source.sources)};
  const library = await createLibraryService({
    domain: {global: {get: async () => structuredClone(state), set: async next => {state = structuredClone(next);}}, close: async () => {}},
    host: {list: () => ({apps: []}), instanceList: () => []}, config: {fetchImpl: source.fetchImpl},
  }).init();
  t.after(() => library.close()); return library;
}

test('CAT-H01: the published explicit HanaMesh manifest preserves its view, anonymous endpoint and declared limits', () => {
  assert.doesNotThrow(() => validateCatalogManifest(hana.manifest), 'C-WEB-CATALOG version 1 manifest is a supported explicit view');
  assert.deepEqual(validateCatalogManifest(hana.manifest), hana.manifest);
});
test('CAT-H02: the published Page/Item keeps directory identity, nullable npm identity and exact public sourceLinks', () => {
  assert.doesNotThrow(() => validateProviderPage(hana.page), 'the published hanamesh.catalog.v1 Page must be recognized');
  const result = validateProviderPage(hana.page);
  assert.deepEqual(result, hana.page);
  for (const item of result.items) assert.equal(item.id, item.itemId);
  assert.equal(result.items[0].packageName, result.items[0].package.name);
  assert.deepEqual(result.items[0].source.sourceLinks, hana.page.items[0].source.sourceLinks);
  assert.equal(result.items[1].packageName, null);
  assert.equal(result.items[1].package, undefined);
  assert.deepEqual(validateProviderPage(hana.empty), hana.empty, 'a valid empty page is availability, not failure');
});
test('CAT-H03: the old default catalog remains strict and no unrecognized view or version silently falls back', () => {
  assert.deepEqual(validateProviderPage(page), page);
  assert.throws(() => validateProviderPage({...hana.page, schemaVersion: '1.0.0'}), {code: 'INVALID_CATALOG_PAGE'}, 'new Item fields never bleed into the old strict schema');
  assert.throws(() => validateProviderPage({...hana.page, schemaVersion: 'hanamesh.catalog.v2'}), {code: 'INVALID_CATALOG_PAGE'});
  for (const query of ['view=unknown', 'view=hanamesh&view=hanamesh', 'view=hanamesh&token=untrusted']) {
    assert.throws(() => validateCatalogManifest({...hana.manifest, transport: {...hana.manifest.transport, endpoint: 'https://market.example/v1/plugins?' + query}}), {code: 'INVALID_CATALOG_MANIFEST'});
  }
});
test('CAT-H04: anonymous fetch keeps view=hanamesh and documented query fields, with no authentication or source URL as download command', async () => {
  const source = hanaSource(); let result;
  await assert.doesNotReject(async () => {result = await loadCatalog({...source, query: '@example/ordinary-app', category: 'hanamesh-app'});}, 'the formally documented manifest URL must load without a query-stripping fallback');
  assert.deepEqual(source.requests.map(r => [r.url.pathname, r.url.searchParams.get('view')]), [['/catalog-source.json', 'hanamesh'], ['/v1/plugins', 'hanamesh']]);
  const request = source.requests[1];
  assert.equal(request.url.searchParams.get('q'), '@example/ordinary-app');
  assert.equal(request.url.searchParams.get('category'), 'hanamesh-app');
  assert.equal(request.url.searchParams.get('limit'), '50');
  for (const {init} of source.requests) {
    assert.equal(init.headers.authorization, undefined); assert.equal(init.headers.cookie, undefined);
    assert.equal(init.redirect, 'manual');
  }
  assert.deepEqual(result.items, hana.page.items);
  assert.equal(result.source.manifestUrl, hana.manifestUrl);
});
test('CAT-H05: exact target crosses substring matches, duplicate npm identities and empty nonterminal pages without losing provenance', async t => {
  const intended = hana.page.items[0];
  const substring = {...structuredClone(intended), id: '00000000-0000-4000-8000-000000000003', itemId: '00000000-0000-4000-8000-000000000003', packageName: intended.packageName + '-extra', package: {...intended.package, name: intended.packageName + '-extra'}};
  const samePackage = {...structuredClone(intended), id: '00000000-0000-4000-8000-000000000004', itemId: '00000000-0000-4000-8000-000000000004'};
  const source = hanaSource({pages: [{...hana.page, items: [substring, samePackage]}, hana.empty, {...hana.page, items: [intended]}]});
  const library = await hanaLibrary(t, source); let resolved;
  await assert.doesNotReject(async () => {resolved = await library.resolveTarget({itemId: intended.itemId, packageName: intended.packageName});}, 'q is substring search; exact identity requires walking past every nonmatching/empty page');
  assert.deepEqual([resolved.item.id, resolved.item.package.name, resolved.item.kind], [intended.itemId, intended.packageName, 'application']);
  assert.deepEqual(resolved.item.source, intended.source);
  assert.equal(source.requests.filter(r => r.url.pathname === '/v1/plugins').length, 3);
  assert.deepEqual(source.requests.filter(r => r.url.pathname === '/v1/plugins').map(r => r.url.searchParams.get('cursor')), [null, ...source.cursors]);
  assert.deepEqual(library.events().events, [], 'target resolution does not install');
});
test('CAT-H06: package-only target with multiple catalog identities is refused explicitly instead of selecting the first hit', async t => {
  const intended = hana.page.items[0], second = {...structuredClone(intended), id: '00000000-0000-4000-8000-000000000005', itemId: '00000000-0000-4000-8000-000000000005'};
  const source = hanaSource({pages: [{...hana.page, items: [intended]}, {...hana.page, items: [second]}]});
  const library = await hanaLibrary(t, source);
  await assert.rejects(library.resolveTarget({packageName: intended.packageName}), {code: 'CATALOG_TARGET_AMBIGUOUS', status: 409}, 'C-MARKET candidate requires the caller to choose a directory identity');
  assert.deepEqual(library.events().events, []);
});
test('CAT-H07: catalogKind is display metadata; an application or entry without an npm identity remains browse-only', async t => {
  for (const catalogKind of ['application', 'entry']) {
    const browseOnly = {...structuredClone(hana.page.items[1]), catalogKind, ...(catalogKind === 'application' ? {categories: ['hanamesh-app']} : {})};
    const source = hanaSource({pages: [{...hana.page, items: [browseOnly]}]});
    const library = await hanaLibrary(t, source); let listing;
    await assert.doesNotReject(async () => {listing = await library.list({category: ''});}, 'a no-package item stays in the complete public directory');
    assert.equal(listing.items[0].kind, 'listing');
    await assert.rejects(library.resolveTarget({itemId: browseOnly.itemId}), {code: 'NOT_INSTALLABLE'});
    assert.deepEqual(library.events().events, []);
  }
});
for (const fault of [
  {status: 503, body: {error: {code: 'UPSTREAM_UNAVAILABLE', missing: ['CATALOG_DB']}}},
  {status: 409, body: {error: {code: 'CATALOG_CHANGED'}}},
  {status: 400, body: {error: {code: 'INVALID_REQUEST'}}},
]) test(`CAT-H08/${fault.body.error.code}: provider refusal preserves its documented code and never reports a partial catalog or fixture fallback`, async t => {
  const source = hanaSource({fault}), library = await hanaLibrary(t, source);
  await assert.rejects(library.list({category: ''}), {code: fault.body.error.code}, 'the documented error is not a generic catalog HTTP failure');
  assert.deepEqual(library.events().events, []);
});
test('CAT-H09: a catalog generation change during exact-target traversal refuses the whole attempt without mixing pages or automatically retrying', async t => {
  const intended = hana.page.items[0], first = {...structuredClone(intended), id: '00000000-0000-4000-8000-000000000006', itemId: '00000000-0000-4000-8000-000000000006'};
  const source = hanaSource({pages: [{...hana.page, items: [first]}, hana.page], faultOnCursor: true, fault: {status: 409, body: {error: {code: 'CATALOG_CHANGED'}}}});
  const library = await hanaLibrary(t, source);
  await assert.rejects(library.resolveTarget({itemId: intended.itemId, packageName: intended.packageName}), {code: 'CATALOG_CHANGED'});
  const requests = source.requests.filter(r => r.url.pathname === '/v1/plugins');
  assert.deepEqual(requests.map(r => r.url.searchParams.get('cursor')), [null, source.cursors[0]]);
  assert.deepEqual(library.events().events, []);
});
test('CAT-H10: accepting the new view still rejects inconsistent public identities, untrusted provenance and private extra fields', () => {
  for (const change of [
    item => {item.itemId = 'different-identity';},
    item => {item.packageName = '@example/different-package';},
    item => {item.source.sourceLinks[0].sourceUrl = 'https://user:password@awesome.example/app';},
    item => {item.source.sourceLinks[0].lastSeenAt = 'not-a-date';},
    item => {item.ownerPrincipalId = 'private';},
    item => {item.contentHash = 'private';},
  ]) {
    const value = structuredClone(hana.page); change(value.items[0]);
    assert.throws(() => validateProviderPage(value), {code: 'INVALID_CATALOG_PAGE'});
  }
});
