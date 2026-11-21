import {checkTarball} from './verify-pack-closure.mjs';
import { verifyAppHostPack, packOptions } from '../devkit.config.mjs';
import { checkRelease } from '@hanamesh/release-platform-gate';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
// Preserve the existing optional tarball argument and check that exact verified artifact.
const closure = await checkTarball(packOptions(process.argv[2]).tarball);
console.log(JSON.stringify({gate:'PACK_RELATIVE_CLOSURE',...closure}));
if (closure.failures.length) throw new Error('PACK_RELATIVE_CLOSURE_FAILED');
await verifyAppHostPack(process.argv[2]);
const receipt = await checkRelease({
  tarball: packOptions(process.argv[2]).tarball,
  lockfile: fileURLToPath(new URL('../pnpm-lock.yaml', import.meta.url)),
  installationTargets: JSON.parse(await readFile(new URL('../release/installation-targets.json', import.meta.url), 'utf8')),
  sourceRoot: fileURLToPath(new URL('../', import.meta.url)),
});
console.log(JSON.stringify(receipt));
