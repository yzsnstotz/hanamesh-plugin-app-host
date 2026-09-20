// rc.15: the production HanaMesh source (market.hanamesh.com) emits the schema-allowed `updatedAt`; the validator must accept it
// and must still reject unknown keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateProviderPage} from '../src/library/catalog.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/catalog/provider-page.json', import.meta.url), 'utf8'));

test('AH-L09: catalog items may carry schema-allowed updatedAt', () => {
  const page = structuredClone(fixture);
  page.items = page.items.map(item => ({...item, updatedAt: '2026-09-19T23:00:32.000Z'}));
  assert.doesNotThrow(() => validateProviderPage(page));
  const bad = structuredClone(fixture); bad.items[0].updatedAt = 'yesterday';
  assert.throws(() => validateProviderPage(bad), error => error?.code === 'INVALID_CATALOG_PAGE');
  const unknown = structuredClone(fixture); unknown.items[0].extraField = 1;
  assert.throws(() => validateProviderPage(unknown), error => error?.code === 'INVALID_CATALOG_PAGE');
});
