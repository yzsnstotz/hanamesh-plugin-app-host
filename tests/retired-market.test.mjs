import assert from 'node:assert/strict';
import test from 'node:test';
import {LIBRARY_ROUTES} from '../src/library/routes.js';

test('AppHost retains application installation and environment routes without the website bridge',()=>{
 for(const path of ['install','provision','uninstall','events','node-runtime']){
  assert.ok(LIBRARY_ROUTES.includes('/hanamesh/library/'+path),path);
 }
 assert.deepEqual(LIBRARY_ROUTES.filter(path=>/\/(install-target|installation-status|handoff[^/]*)($|\/)/.test(path)),[]);
});
