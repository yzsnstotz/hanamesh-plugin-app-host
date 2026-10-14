// Normal upstream development preparation, without starting Electron.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {prepareDevelopmentProject} from '../upstream/apps/desktop/scripts/development-project.ts';
import {preparePrimaryRuntime} from '../upstream/apps/desktop/scripts/prepare-primary-runtime.ts';
import {prepareDevelopmentApp} from '../upstream/apps/desktop/scripts/development-app.ts';
import {resolveDesktopBuildTarget} from '../upstream/apps/desktop/scripts/desktop-build-paths.mjs';
import {DESKTOP_HOST_PROTOCOL_VERSION} from '../upstream/apps/desktop/src/host-protocol.ts';
const r=resolve(import.meta.dirname,'..'),u=join(r,'upstream'),app=join(u,'apps/desktop');
const mainPort=Number(process.env.DSH_DESKTOP_MAIN_INSPECT_PORT);
const rendererPort=Number(process.env.DSH_DESKTOP_RENDERER_DEBUG_PORT);
const hostPort=Number(process.env.DSH_DESKTOP_HOST_INSPECT_PORT);
const home=process.env.DSH_HOME,userData=process.env.DSH_DESKTOP_USER_DATA_DIR;
if(!home||!userData||![mainPort,rendererPort,hostPort].every(n=>Number.isInteger(n)&&n>1024&&n<65536&&n!==3080))throw new Error('Explicit isolated native directories and ports are required.');
for(const path of [home,userData])if(!resolve(path).startsWith(r+'/'))throw new Error('Native directory outside the isolated card round.');
execFileSync('/usr/bin/python3',[join(import.meta.dirname,'lifecycle.py'),'prepare-check','--root',r,'--ports',[mainPort,rendererPort,hostPort].join(',')],{env:process.env,stdio:'inherit'});
const require=createRequire(join(app,'scripts/dev.ts'));
const version=JSON.parse(readFileSync(join(app,'package.json'),'utf8')).version;
const pnpmVersion=JSON.parse(readFileSync(join(app,'node_modules/pnpm/package.json'),'utf8')).version;
const nodeVersion=execFileSync(require('electron'),['-p','process.versions.node'],{
  encoding:'utf8',env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},
}).trim();
prepareDevelopmentProject({projectDir:join(app,'.desktop-build/development/project'),
  cliDir:join(u,'apps/cli'),hostDir:join(u,'apps/desktop-host'),
  dependencyDir:join(u,'node_modules/.pnpm/node_modules'),
  release:{schemaVersion:1,version,hostProtocolVersion:DESKTOP_HOST_PROTOCOL_VERSION,nodeVersion,pnpmVersion},
  target:resolveDesktopBuildTarget()});
await preparePrimaryRuntime();
const launcher=prepareDevelopmentApp({electron:require('electron'),appRoot:app,
  directory:join(app,'.desktop-build/development'),home,userData,mainPort,rendererPort,hostPort,openDevtools:'0'});
console.log(JSON.stringify({event:'fresh-development-prepared',upstream:u,version,pnpmVersion,nodeVersion,launcher,
  publicEntries:['prepareDevelopmentProject','preparePrimaryRuntime','prepareDevelopmentApp']}));
