import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,realpath} from 'node:fs/promises';
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
suite.validateDescriptor(consumer);assert(suite.satisfiesCaret(pkg.version,consumer.range));
// The provider's checkConsumer only supports Git lock resolutions. File transport
// is validated here as AppHost installation policy, never reported as that check.
const manifest=JSON.parse(await readFile(join(root,'package.json')));
const {packages}=JSON.parse(await readFile(join(root,'vendor/supply.json')));
const supply=packages.find(item=>item.name===pkg.name);assert(supply);
assert.equal(manifest.devDependencies[pkg.name],`file:${supply.path}`);
assert.equal(supply.version,pkg.version);
const archive=await readFile(join(root,supply.path));
assert.equal(createHash('sha256').update(archive).digest('hex'),supply.sha256);
const integrity='sha512-'+createHash('sha512').update(archive).digest('base64');
assert((await readFile(join(root,'pnpm-lock.yaml'),'utf8')).includes(`integrity: ${integrity}, tarball: file:${supply.path}`));
const files=execFileSync('tar',['-tzf',join(root,supply.path)],{encoding:'utf8'}).trim().split('\n').filter(path=>!path.endsWith('/'));
for(const file of files){
 assert(file.startsWith('package/')&&!file.includes('..'));
 const installed=join(packageRoot,file.slice('package/'.length));
 assert((await realpath(installed)).startsWith(await realpath(packageRoot)+'/'));
 assert.deepEqual(await readFile(installed),execFileSync('tar',['-xzOf',join(root,supply.path),file]));
}
const cli=execFileSync(join(root,'node_modules/.bin',consumer.bin),['preflight',join(root,'devkit.config.mjs')],{encoding:'utf8'});
console.log(JSON.stringify({provider:verifiedProvider,consumer:{transport:'fixed-archive',name:pkg.name,version:pkg.version,sourceCommit:supply.sourceCommit,sha256:supply.sha256,integrity,installedFilesMatched:files.length,cli:cli.trim(),gitOnlyCheckConsumer:'not applicable'}}));
