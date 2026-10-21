import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('market-owned surfaces and controls consume the host public palette instead of fixed white/black',async()=>{
 const source=await readFile(new URL('../src/client-ui.js',import.meta.url),'utf8');let loaded,css;
 const window={__ModuleLoader__:{load:module=>{loaded=module;}}};const document={createElement:()=>({textContent:'',remove(){}}),head:{append:element=>{css=element.textContent;}}};
 new Function('window','document',source)(window,document);
 const module=loaded.factory(()=>({createElement(){}}));module.apply({effect(run,label){if(label==='hanamesh-app-host:style')run();}});
 assert.equal(typeof css,'string');
 for(const selector of ['.hm-library-overlay','.hm-market-embedded>.hm-app-frame']){
  const rule=css.slice(css.indexOf(selector+'{')).split('}')[0];assert.match(rule,/background:var\(--dsw-alias-bg-layer-2\)/);assert.match(rule,/color:var\(--dsw-alias-label-primary\)/);
 }
 assert.doesNotMatch(css,/(?:background|color):#(?:fff(?:fff)?|18181b)\b/i,'no fixed light palette on the market or its controls');
 assert.match(css,/--dsw-alias-state-error-primary/);assert.match(css,/--dsw-alias-state-success-primary/);assert.match(css,/--dsw-alias-state-warn-tertiary/);
});
