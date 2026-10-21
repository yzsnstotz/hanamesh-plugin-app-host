import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createLibraryInstaller} from '../src/library/install.js';
test('I27 F03 an Electron host without independent Node gives actionable plugin configuration, not client reinstall',()=>{
 const prior=Object.getOwnPropertyDescriptor(process.versions,'electron');Object.defineProperty(process.versions,'electron',{configurable:true,value:'i27-test'});
 try{const installer=createLibraryInstaller({profileDir:'/tmp/i27-guidance-profile',profileName:'desktop',dataRoot:'/tmp/i27-guidance-data'});
 assert.equal(installer.ready,false);assert.match(installer.unavailable[0].how,/nodeBinary/);assert.match(installer.unavailable[0].how,/24/);assert.match(installer.unavailable[0].how,/插件配置/);assert.doesNotMatch(installer.unavailable[0].how,/恢复客户端|重新安装客户端/);
 }finally{if(prior)Object.defineProperty(process.versions,'electron',prior);else delete process.versions.electron;}
});
test('I27 F03 the public plugin settings explain standalone Node and a full reopen without shell restart bridge',async()=>{
 const source=await readFile(new URL('../src/client-ui.js',import.meta.url),'utf8');let loaded;
 const window={__ModuleLoader__:{load:m=>{loaded=m;}}};new Function('window',source)(window);
 const React={createElement:(type,props,...children)=>({type,props,children}),useState:v=>[v,()=>{}],useCallback:f=>f,useEffect:()=>{}};
 const module=loaded.factory(()=>React),tree=JSON.stringify(module.HandoffSettingsSection());
 assert.match(tree,/nodeBinary/);assert.match(tree,/独立 Node.js 24/);assert.match(tree,/完全退出后重开/);assert.doesNotMatch(tree,/hanamesh:\/\/restart/);
});
