import test from 'node:test';
import assert from 'node:assert/strict';
import {createHostDom} from './fixtures/host-dom.mjs';

test('component DOM commits refs, retains iframe Window, and detaches removed nodes',()=>{
  const dom=createHostDom(),ref={current:null},callbacks=[];
  const frame=(ref,src)=>({type:'iframe',props:{ref,src},children:[]});
  dom.commit(frame(ref,'https://fixture.invalid/a'));
  const first=dom.querySelectorAll('iframe')[0];assert.equal(ref.current,first);
  const source=first.contentWindow;
  source.postMessage({proof:'component-fixture'},'https://fixture.invalid');
  dom.commit(frame(ref,'https://fixture.invalid/b'));
  assert.equal(dom.querySelectorAll('iframe')[0],first);assert.equal(first.contentWindow,source);assert.equal(first.getAttribute('src'),'https://fixture.invalid/b');
  const callback=value=>callbacks.push(value);dom.commit(frame(callback,'https://fixture.invalid/c'));
  assert.equal(ref.current,null);assert.deepEqual(callbacks,[first]);
  dom.clear();assert.equal(first.isConnected,false);assert.deepEqual(callbacks,[first,null]);assert.equal(dom.querySelectorAll('iframe').length,0);
  dom.commit(frame(ref,'https://fixture.invalid/a'));assert.notEqual(ref.current.contentWindow,source,'new mount cannot reuse old Window');
  dom.clear();assert.equal(ref.current,null);
});
