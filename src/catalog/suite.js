/** SOURCE catalog version conformance: real validators and real catalog loader; transport responses are labelled fixtures. */
import {readFile} from 'node:fs/promises';
import {validateCatalogManifest,validateProviderPage,loadCatalog} from '../library/catalog.js';
const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const equal=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error('Catalog readback differs from fixture');};
const refuses=async(run,code)=>{try{await run();}catch(error){if(!code||error.code===code)return;throw error;}throw new Error('Expected catalog refusal');};
async function runner(suite,cases){
  const results=[];
  for(const [id,run] of cases)try{await run();results.push({id,outcome:'pass'});}catch(error){results.push({id,outcome:'fail',detail:error.message});}
  return{suite,evidence:'SOURCE',contract:'catalog-major-1',total:results.length,pass:results.filter(x=>x.outcome==='pass').length,fail:results.filter(x=>x.outcome==='fail').length,results};
}
export async function runCatalogProviderSuite(){
  const fixture=await read('./fixtures/provider.json');
  const manifestSchema=await read('../../schemas/catalog-source.schema.json'),pageSchema=await read('../../schemas/catalog-provider-page.schema.json');
  const cases=[];
  for(const version of fixture.accepted)cases.push(['accepted/'+version,()=>{
    const manifest={...fixture.manifest,manifestVersion:version},page={...fixture.page,schemaVersion:version};
    equal(validateCatalogManifest(manifest),manifest);equal(validateProviderPage(page),page);
    if(!new RegExp(manifestSchema.properties.manifestVersion.pattern,'u').test(version)||!new RegExp(pageSchema.properties.schemaVersion.pattern,'u').test(version))throw new Error('Shipped schema rejects compatible version');
  }]);
  for(const version of fixture.refused)cases.push(['refused/'+JSON.stringify(version),async()=>{
    await refuses(()=>validateCatalogManifest({...fixture.manifest,manifestVersion:version}),'INVALID_CATALOG_MANIFEST');
    await refuses(()=>validateProviderPage({...fixture.page,schemaVersion:version}),'INVALID_CATALOG_PAGE');
    for(const property of [manifestSchema.properties.manifestVersion,pageSchema.properties.schemaVersion])if(typeof version==='string'&&new RegExp(property.pattern,'u').test(version))throw new Error('Shipped schema accepts refused version');
  }]);
  cases.push(['shape-required-method',()=>refuses(()=>validateCatalogManifest({...fixture.manifest,manifestVersion:'1.1.0',transport:{...fixture.manifest.transport,method:'POST'}}),'INVALID_CATALOG_MANIFEST')]);
  cases.push(['shape-invalid-item',()=>refuses(()=>validateProviderPage({...fixture.page,schemaVersion:'1.1.0',items:[{...fixture.page.items[0],updatedAt:'yesterday'}]}),'INVALID_CATALOG_PAGE')]);
  cases.push(['shape-unknown-field',()=>refuses(()=>validateProviderPage({...fixture.page,schemaVersion:'1.1.0',unexpected:true}),'INVALID_CATALOG_PAGE')]);
  return runner('catalog-provider',cases);
}
export async function runCatalogConsumerSuite(consume=loadCatalog){
  const fixture=await read('./fixtures/provider.json'),consumer=await read('./fixtures/consumer.json');const cases=[];
  const input=(manifestVersion,schemaVersion)=>{
    const manifest={...fixture.manifest,manifestVersion,attribution:{...fixture.manifest.attribution,notice:consumer.additions.notice}};
    const page={...fixture.page,schemaVersion,items:fixture.page.items.map(item=>({...item,updatedAt:consumer.additions.updatedAt}))};
    const requests=[],responses=[manifest,page];
    return{page,requests,options:{sources:[{manifestUrl:new URL('/catalog-source.json',manifest.transport.endpoint).href}],fetchImpl:async(url,init)=>{requests.push({url:String(url),init});return new Response(JSON.stringify(responses.shift()),{headers:{'content-type':'application/json'}});}}};
  };
  for(const pair of consumer.accepted)cases.push(['accepted/'+pair.join('/'),async()=>{
    const probe=input(...pair),result=await consume(probe.options);equal(result.items,probe.page.items);equal(result.schemaVersion,probe.page.schemaVersion);
    if(probe.requests.length!==2||probe.requests.some(x=>x.init.redirect!=='manual'||x.init.headers['accept-encoding']!=='identity'))throw new Error('Catalog transport trust controls changed');
  }]);
  for(const pair of consumer.refused)cases.push(['refused/'+pair.join('/'),()=>refuses(()=>consume(input(...pair).options))]);
  cases.push(['trust-foreign-endpoint',async()=>{
    const manifest={...fixture.manifest,manifestVersion:'1.1.0',transport:{...fixture.manifest.transport,endpoint:'https://foreign.example/v1/plugins'}};let calls=0;
    await refuses(()=>consume({sources:[{manifestUrl:'https://catalog.hanamesh.com/catalog-source.json'}],fetchImpl:async()=>{calls++;return new Response(JSON.stringify(manifest),{headers:{'content-type':'application/json'}});}}),'INVALID_CATALOG_MANIFEST');
    equal(calls,1);
  }]);
  return runner('catalog-consumer',cases);
}
