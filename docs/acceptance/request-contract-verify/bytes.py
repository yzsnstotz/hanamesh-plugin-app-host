import hashlib,json,pathlib,subprocess,tarfile,sys
src=pathlib.Path(__file__).resolve().parents[3]
out=pathlib.Path(sys.argv[1]);sha=lambda b:hashlib.sha256(b).hexdigest()
base='2788ecfc29e2d63d96094ec114d63119b3e207f4';frozen='1697ac87f56afdd9302ba380c9785eff8247dff6'
git=lambda *args:subprocess.check_output(['git','-C',str(src),*args])
subprocess.run(['git','-C',str(src),'merge-base','--is-ancestor',frozen,'HEAD'],check=True)
remote=git('ls-remote','origin','refs/heads/codex/p02-apphost-request-01').decode().split()[0];assert remote==frozen
changed=git('diff','--name-only',base,frozen).decode().splitlines();assert len(changed)==29;assert all(p.startswith('docs/acceptance/request-contract/') for p in changed)
assert git('diff','--name-only').decode().strip()==''
paths=[pathlib.Path('/Users/yzliu/work/projects/hanamesh/hanamesh-app-vibe-trading/vendor/hanamesh-dsh-app-host-0.2.0-rc.2.tgz'),pathlib.Path('/Users/yzliu/.cache/hanamesh-runs/METADATA-DEVKIT-VENDOR-APPHOST-01/artifacts/hanamesh-dsh-app-host-0.2.0-rc.6.tgz')]
hashes=['1a40359723795efd5d86530db593e818801ef4245efbed5a77ccec5fd3265f40','2294541a19575b246774b1d0566c48bf75d64499312edd0f4576730296bb826a']
packages=[];tars=[]
for path,expect in zip(paths,hashes):
 actual=sha(path.read_bytes());assert actual==expect;t=tarfile.open(path);tars.append(t);pkg=json.load(t.extractfile('package/package.json'));packages.append({'path':str(path),'version':pkg['version'],'sha256':actual})
comparisons=[]
for p in ['client-ui.js','dsh.js','library/routes.js','library/service.js','library/install.js','routes.js','router/routes.js']:
 content=[t.extractfile('package/dist/'+p).read() for t in tars]+[(src/'src'/p).read_bytes(),(src/'dist'/p).read_bytes(),git('show',frozen+':dist/'+p)]
 assert all(b==content[0] for b in content);comparisons.append({'path':'dist/'+p,'allFiveEqual':True,'sha256':sha(content[0])})
public=pathlib.Path('/Users/yzliu/work/projects/hanamesh/hanamesh-desktop/apps/cli/package.json');cli=json.loads(public.read_text());assert cli['name']=='@deepseek-ai/dsh';assert cli['version']=='0.2.0-rc.2';assert cli['exports']['./lib/*']=='./lib/*'
kept={p:sha((src/p).read_bytes()) for p in ['package.json','package-lock.json','src/dsh.d.ts','src/runtime.js','src/library/locate.js','vendor/hanamesh-devkit-0.1.0-rc.2.tgz','vendor/hanamesh-lib-provision-0.1.0-rc.3.tgz','node_modules/@deepseek-ai/dsh-client-connection/lib/index.js','node_modules/@deepseek-ai/dsh-client-connection/lib/types/rpc.d.ts']}
receipt={'frozenSource':frozen,'remoteImplementationRef':remote,'base':base,'changedFiles':changed,'changedFileCount':29,'productionChanges':0,'builtTrackedBytesUnchanged':True,'packages':packages,'comparisons':comparisons,'publicCLI':{'path':str(public),'sha256':sha(public.read_bytes()),'version':cli['version'],'exports':cli['exports']},'inputs':kept,'newPackages':0,'formalEffectiveParameters':'NOT_CAPTURED'}
out.write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({'passed':True,'changedDocs':len(changed),'equalBoundaries':len(comparisons),'packages':packages}))
