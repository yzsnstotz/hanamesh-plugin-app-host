// Builds the `@hanamesh/app-contract-fixture` application bundle for the real-DSH lifecycle gate (P02-APPHOST-01).
// usage: node tests/fixtures/app-package/build.mjs <v1|v2> <outDir> <absolute node binary> [appHostPeerVersion]
// v1 = the APP_PACKAGE.md v1 minimal entry verbatim (top-level required `inject`), kept as the RED reproduction.
// v2 = the current contract entry (`entry-v2.js`, identical to docs/APP_PACKAGE.md). The owned deployment is a tiny
// inline HTTP server so open/close/stop can run without any runtime download.
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { execFileSync } from 'node:child_process';
const [contract, outDir, node, peer = '0.1.0-rc.42'] = process.argv.slice(2);
if (!['v1','v2'].includes(contract) || !outDir || !isAbsolute(node ?? '')) throw new Error('usage: build.mjs <v1|v2> <outDir> <absolute node> [peer]');
// FIXTURE_BROKEN=1: same v2 entry but app.json omits the {{dataDir}} binding, so validateDefinition rejects it (loud-error gate).
const broken = process.env.FIXTURE_BROKEN === '1';
const name = '@hanamesh/app-contract-fixture', version = contract === 'v1' ? '0.0.1' : broken ? '0.0.3' : '0.0.2';
const dir = join(outDir, `fixture-${contract}${broken ? '-broken' : ''}`); await rm(dir, { recursive:true, force:true }); await mkdir(dir, { recursive:true });
const here = new URL('.', import.meta.url);
const entry = (await readFile(new URL(`entry-${contract}.js`, here), 'utf8')).replaceAll('@hanamesh/app-example', name);
const server = "require('node:http').createServer((q,s)=>s.end('CONTRACT_FIXTURE_READY')).listen(Number(process.argv[1]),'127.0.0.1')";
const app = { id:'contract-fixture', name:'Contract fixture', singleInstanceOnly:true, deployments:[{ id:'local', dataId:'default', mode:'owned',
  embedding:'gateway', command:node, args:broken ? ['-e', server, '{{port}}'] : ['-e', server, '{{port}}', '{{dataDir}}'], readiness:{ path:'/', status:200, bodyIncludes:'CONTRACT_FIXTURE_READY' },
  startTimeoutMs:10_000, stopGraceMs:1_000 }] };
const pkg = { name, version, type:'module', license:'MIT', main:'./dsh.js', exports:{ '.':'./dsh.js', './dsh':'./dsh.js', './package.json':'./package.json' },
  files:['app.json','dsh.js','cordis.patch.yml','README.md','LICENSE'], peerDependencies:{ '@hanamesh/dsh-app-host':peer },
  dsh:{ bundle:{ patch:'./cordis.patch.yml' } }, hanamesh:{ app:'./app.json', contractVersion: contract === 'v1' ? 1 : 2 } };
await writeFile(join(dir,'package.json'), JSON.stringify(pkg,null,2)+'\n');
await writeFile(join(dir,'app.json'), JSON.stringify(app,null,2)+'\n');
await writeFile(join(dir,'dsh.js'), entry);
await writeFile(join(dir,'cordis.patch.yml'), `- insert:\n  - id: hanamesh-app-contract-fixture\n    name: '${name}/dsh'\n    config: {}\n`);
await writeFile(join(dir,'README.md'), `Contract ${contract} lifecycle fixture for @hanamesh/dsh-app-host. Test-only; never published.\n`);
await writeFile(join(dir,'LICENSE'), 'MIT\n');
const out = execFileSync('npm', ['pack','--json','--pack-destination',outDir], { cwd:dir, encoding:'utf8' });
console.log(JSON.stringify({ contract, tarball:join(outDir, JSON.parse(out)[0].filename), integrity:JSON.parse(out)[0].integrity }));
