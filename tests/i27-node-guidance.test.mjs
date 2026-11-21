import { resolve } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {clientHarness} from './fixtures/client-ui-harness.mjs';
import {createLibraryInstaller} from '../src/library/install.js';
test('I27 F03 an Electron host without independent Node gives actionable plugin configuration, not client reinstall',()=>{
 const prior=Object.getOwnPropertyDescriptor(process.versions,'electron');Object.defineProperty(process.versions,'electron',{configurable:true,value:'i27-test'});
 try{const installer=createLibraryInstaller({profileDir:resolve('fixture/i27-guidance-profile'),profileName:'desktop',dataRoot:resolve('fixture/i27-guidance-data')});
 assert.equal(installer.ready,false);assert.match(installer.unavailable[0].how,/nodeBinary/);assert.match(installer.unavailable[0].how,/24/);assert.match(installer.unavailable[0].how,/插件配置/);assert.doesNotMatch(installer.unavailable[0].how,/恢复客户端|重新安装客户端/);
 }finally{if(prior)Object.defineProperty(process.versions,'electron',prior);else delete process.versions.electron;}
});
test('I27 F03 the installation environment offers preparation without restarting',async t=>{
 const ui=await clientHarness({component:'NodeRuntimeSection',fetch:async()=>({ok:true,json:async()=>({
  ready:false,supported:true,settings:{mode:'managed',version:'24.22.0'},versions:['24.22.0'],
  names:{mode:'运行方式',version:'Node 版本',sourceBase:'下载来源',storageRoot:'存放位置',externalBinary:'已有独立 Node 路径'},
 })})});
 t.after(()=>ui.unmount());
 const tree=JSON.stringify(ui.tree);
 assert.match(tree,/准备安装环境/);
 assert.match(tree,/24\.22\.0/);
 assert.match(tree,/无需重启/);
 assert.doesNotMatch(tree,/hanamesh:\/\/restart/);
});
