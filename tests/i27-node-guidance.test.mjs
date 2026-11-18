import { resolve } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('I27 F03 the public plugin settings point to preparation without a restart without shell restart bridge',async()=>{
 const source=await readFile(new URL('../src/client-ui.js',import.meta.url),'utf8');let loaded;
 const window={__ModuleLoader__:{load:m=>{loaded=m;}}};new Function('window',source)(window);
 const React={createElement:(type,props,...children)=>({type,props,children}),useState:v=>[typeof v==='function'?v():v,()=>{}],useCallback:f=>f,useEffect:()=>{}};
 const module=loaded.factory(()=>React),tree=JSON.stringify(module.NodeRuntimeSection());
 assert.match(tree,/准备安装环境/);assert.match(tree,/独立 Node.js 24/);assert.match(tree,/无需重启/);assert.doesNotMatch(tree,/hanamesh:\/\/restart/);
});
