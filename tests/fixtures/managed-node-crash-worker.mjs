// REAL_PROCESS crash boundary with a provision verification double; native official SHA is a separate gate.
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createNodeRuntime} from '../../src/node-runtime/service.js';
const root=process.argv[2],file=join(root,'image.json');let sha;
const runtime=createNodeRuntime({dataRoot:root,platform:'darwin-arm64',kernelRelease:'25.0.0',domain:{global:{get:async()=>JSON.parse(await readFile(file,'utf8')),set:async value=>writeFile(file,JSON.stringify(value))}},probe:async()=>{},freeBytes:async()=>1e12,
 provisionApi:{provision:async manifest=>{sha=manifest.items[0].platforms['darwin-arm64'].sha256;},verify:async()=>({ok:true,items:[{item:'node',state:'ok'}]}),ledger:async()=>({items:{node:{version:'24.22.0',platform:'darwin-arm64',sha256:sha,installTo:'runtime'}}})},
 checkpoint:async point=>{process.send({point});await new Promise(()=>{});}});
await runtime.init();const plan=await runtime.plan({});runtime.prepare({planId:plan.planId,confirm:true});await runtime.settled();
