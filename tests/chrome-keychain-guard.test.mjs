// Static fail-closed gate: this test never starts Chrome or contacts a keychain.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('Q329 every active browser-test Chrome launch includes both required keychain isolation flags',async()=>{const source=await readFile(new URL('./browser.test.mjs',import.meta.url),'utf8');const launches=[...source.matchAll(/spawn\(binary,\[([\s\S]*?)\],\{/g)];assert.ok(launches.length>0,'active launch must be inspected');assert.match(source,/env:browserEnv/,'Chrome must use explicit isolated environment');assert.doesNotMatch(source,/env:\s*\{\s*\.\.\.process\.env/,'do not inherit personal credentials');for(const [,args] of launches){assert.match(args,/'--use-mock-keychain'/,'CHROME_KEYCHAIN_GUARD_MISSING: --use-mock-keychain');assert.match(args,/'--password-store=basic'/,'CHROME_KEYCHAIN_GUARD_MISSING: --password-store=basic');}});
