import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=process.cwd();
const suite=await import('@hanamesh/devkit/contract');
const provider=JSON.parse(await readFile(new URL(import.meta.resolve('@hanamesh/devkit/contract/fixtures/provider.json'))));
const consumer=JSON.parse(await readFile(new URL(import.meta.resolve('@hanamesh/devkit/contract/fixtures/consumer.json'))));
const entry=new URL(import.meta.resolve('@hanamesh/devkit'));const packageRoot=dirname(dirname(fileURLToPath(entry)));
const pkg=JSON.parse(await readFile(join(packageRoot,'package.json')));
assert.equal(pkg.name,'@hanamesh/devkit');assert.equal(pkg.version,provider.package.version);
const verifiedProvider=suite.checkProvider({packageRoot,descriptor:provider});
// The provider's consumer suite owns the npm range, export, CLI and registry-lock checks.
const verifiedConsumer=suite.checkConsumer({consumerRoot:root,requirement:consumer});
const range=JSON.parse(await readFile(join(root,'package.json'))).devDependencies[pkg.name];
assert(suite.satisfiesCaret(pkg.version,range),`devkit ${pkg.version} outside ${range}`);
const cli=execFileSync(join(root,'node_modules/.bin',consumer.bin),['preflight',join(root,'devkit.config.mjs')],{encoding:'utf8'});
console.log(JSON.stringify({provider:verifiedProvider,consumer:{...verifiedConsumer,range,appHostPreflight:cli.trim()}}));
