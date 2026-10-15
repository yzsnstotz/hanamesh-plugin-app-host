// Child test file for tests/temp-cleanup.test.mjs: makes scratch directories, then fails and throws.
import test from 'node:test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { scratch, temporary } from '../helpers.mjs';

test('fails after making scratch directories', async () => {
  await writeFile(join(await scratch('probe-'), 'file'), 'x');
  await temporary();
  throw new Error('intentional failure');
});
