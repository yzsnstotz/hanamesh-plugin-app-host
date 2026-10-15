"""Task-owned isolated Desktop lifecycle gate; never signals by name or auto-restarts."""
from pathlib import Path
import os,json,socket,subprocess,time,sys,datetime,re,threading,ctypes,struct
from exit_observer import ExitObserver
FIXED='d743267388641bc76f17c45ce8b4c231aed1d32c'
class GateError(RuntimeError):pass
KEYCHAIN_FLAGS=['--use-mock-keychain','--password-store=basic']

def process_argv(pid):
 # Read the kernel's argument vector, never split `ps command` or inspect env.
 if sys.platform=='darwin':
  libc=ctypes.CDLL(None,use_errno=True);mib=(ctypes.c_int*3)(1,49,int(pid)) # CTL_KERN/KERN_PROCARGS2
  size=ctypes.c_size_t()
  if libc.sysctl(mib,3,None,ctypes.byref(size),None,0)!=0:raise GateError('ARGV_UNOBSERVABLE')
  data=ctypes.create_string_buffer(size.value)
  if libc.sysctl(mib,3,data,ctypes.byref(size),None,0)!=0:raise GateError('ARGV_UNOBSERVABLE')
  raw=data.raw[:size.value];argc=struct.unpack_from('i',raw)[0]
  offset=raw.index(b'\0',4)+1
  while offset<len(raw) and raw[offset]==0:offset+=1
  result=[]
  for _ in range(argc):
   end=raw.index(b'\0',offset);result.append(os.fsdecode(raw[offset:end]));offset=end+1
  return result
 if sys.platform.startswith('linux'):
  return [os.fsdecode(x) for x in Path('/proc',str(pid),'cmdline').read_bytes().split(b'\0') if x]
 raise GateError('NATIVE_ARGV_PLATFORM_UNSUPPORTED')

def observe_electron(c,identity):
 current=processes().get(identity['pid'])
 if not current or any(current[k]!=identity[k] for k in ['start','ppid','pgid']):raise GateError('PROCESS_IDENTITY_CHANGED')
 args=process_argv(identity['pid']);command=c['command'];root=Path(c['root']).resolve()
 for flag in KEYCHAIN_FLAGS:
  if flag not in command or flag not in args:raise GateError('NATIVE_KEYCHAIN_FLAG_MISSING')
 if c.get('verifyCommit',True):
  registry=json.loads(Path(c['registry']).read_text())
  if not any(x['pid']==identity['pid'] and x['start']==identity['start'] for x in registry['processes']):raise GateError('PROCESS_NOT_REGISTERED')
  if args!=c['expectedArgv']:raise GateError('NATIVE_ACTUAL_ARGV_MISMATCH')
  executable=inside(root,c['electron'])
  version_args=[str(executable),'-p','JSON.stringify(process.versions)']
  env=dict(c['environment'],ELECTRON_RUN_AS_NODE='1')
 else:
  # Explicit no-runtime fixture mode: shebang interpreters may prefix actual argv.
  if args[-len(command):]!=command:raise GateError('NATIVE_ACTUAL_ARGV_MISMATCH')
  executable=inside(root,command[0]);version_args=[str(executable),'--version']
  env=c['environment']
 version=subprocess.check_output(version_args,env=env,cwd=root,text=True,stdin=subprocess.DEVNULL).strip()
 if c.get('verifyCommit',True):
  versions=json.loads(version)
  if versions.get('electron')!=c['electronVersion']:raise GateError('ELECTRON_VERSION_MISMATCH')
  version=versions['electron']
 current=processes().get(identity['pid'])
 if not current or any(current[k]!=identity[k] for k in ['start','ppid','pgid']):raise GateError('PROCESS_IDENTITY_CHANGED')
 return {k:identity[k] for k in ['pid','start','ppid','pgid']}|{'argv':args,'version':version}

def processes():
 p=subprocess.run(['ps','-axo','pid,ppid,pgid,lstart,command'],text=True,capture_output=True,check=True)
 result={}
 for line in p.stdout.splitlines()[1:]:
  c=line.strip().split(None,8)
  if len(c)==9:result[int(c[0])]={'pid':int(c[0]),'ppid':int(c[1]),'pgid':int(c[2]),'start':' '.join(c[3:8]),'command':c[8]}
 return result

def inside(root,path):
 p=Path(path).resolve()
 if not p.is_relative_to(root):raise GateError('OUTSIDE_ROOT: '+str(path)+' -> '+str(p))
 return p

def registered_alive(path):
 if not Path(path).exists():return []
 registry=json.loads(Path(path).read_text());current=processes();alive=[]
 for item in registry.get('processes',[]):
  now=current.get(item['pid'])
  if now and now['start']==item['start']:alive.append(now)
 return alive

def ports_free(ports):
 for port in ports:
  if not isinstance(port,int) or port<1024 or port>65535 or port==3080:raise GateError('INVALID_PORT')
  with socket.socket() as s:
   s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
   try:s.bind(('127.0.0.1',port));s.listen()
   except OSError as e:raise GateError('PORT_BUSY: '+str(port)) from e

def preflight(c):
 root=Path(c['root']).resolve()
 if c.get('verifyCommit',True) and root!=Path(__file__).resolve().parent.parent:raise GateError('DRIVER_ROOT_MISMATCH')
 deviation=root/'isolation-deviation.json'
 if (root/'native/launch-reservation.json').exists():raise GateError('NATIVE_LAUNCH_RESERVED')
 if (root/'chain-anomaly.json').exists():raise GateError('PRIOR_CHAIN_ANOMALY_REQUIRES_PM')
 if deviation.exists() and json.loads(deviation.read_text()).get('status')=='STOP_NO_FURTHER_NATIVE_START':
  raise GateError('KNOWN_EXTERNAL_WRITE_REQUIRES_PM: '+str(deviation))
 upstream=inside(root,c['upstream']);cwd=inside(root,c['cwd'])
 if not cwd.is_dir():raise GateError('MISSING_CWD')
 for x in c['dependencies']:
  if not inside(root,x).exists():raise GateError('MISSING_DEPENDENCY: '+x)
 for x in c['writable']:inside(root,x)
 for base,dirs,files in os.walk(upstream,followlinks=False):
  for name in dirs+files:
   p=Path(base)/name
   if p.is_symlink():inside(root,p)
 if c.get('verifyCommit',True):
  sha=subprocess.check_output(['git','-C',str(upstream),'rev-parse','HEAD'],text=True).strip()
  if sha!=FIXED:raise GateError('UPSTREAM_COMMIT_MISMATCH: '+sha)
  changed=subprocess.check_output(['git','-C',str(upstream),'diff','HEAD','--name-only'],text=True).strip()
  if changed:raise GateError('UPSTREAM_SOURCE_CHANGED: '+changed)
 if registered_alive(c['registry']):raise GateError('REGISTERED_PROCESS_ALIVE')
 if Path(c['registry']).exists():ports_free(json.loads(Path(c['registry']).read_text()).get('observedPorts',[]))
 ports_free(c['ports'])
 for flag in KEYCHAIN_FLAGS:
  if flag not in c.get('command',[]):raise GateError('NATIVE_KEYCHAIN_FLAG_MISSING: '+flag)
 return True

def put(path,data):
 path=Path(path);temp=path.with_suffix('.tmp');temp.write_text(json.dumps(data,indent=2)+'\n');temp.replace(path)

def sync_directory(path):
 fd=os.open(path,os.O_RDONLY)
 try:os.fsync(fd)
 finally:os.close(fd)

def reserve_launch(root,evidence,c):
 # O_EXCL closes the gap between concurrent successful preflights. Keep this
 # durable hold on every uncertain exit, including death before PID capture.
 path=root/'native/launch-reservation.json'
 owner=processes().get(os.getpid())
 if not owner:raise GateError('DRIVER_IDENTITY_UNOBSERVABLE')
 data={'evidenceRoot':str(evidence),'owner':owner,'command':c['command'],'created':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 except FileExistsError as e:raise GateError('NATIVE_LAUNCH_RESERVED') from e
 with os.fdopen(fd,'w') as output:
  json.dump(data,output,indent=2);output.write('\n');output.flush();os.fsync(output.fileno())
 sync_directory(path.parent)
 return data

def release_launch(root,reservation):
 path=root/'native/launch-reservation.json'
 if not path.exists() or json.loads(path.read_text())!=reservation:raise GateError('LAUNCH_RESERVATION_IDENTITY_CHANGED')
 path.unlink();sync_directory(path.parent)

def isolated_environment(root,ports):
 r=Path(root);u=r/'upstream';arm=r/'native'
 env={k:v for k,v in os.environ.items() if k in ['USER','LOGNAME','LANG','LC_ALL','SHELL','DISPLAY','TERM','XPC_FLAGS','XPC_SERVICE_NAME']}
 dirs={'HOME':arm/'home','DSH_HOME':arm/'dsh-home','DSH_DESKTOP_USER_DATA_DIR':arm/'electron-user-data','TMPDIR':arm/'tmp','XDG_CACHE_HOME':arm/'cache','npm_config_cache':arm/'cache/npm','npm_config_store_dir':arm/'cache/pnpm-store','XDG_CONFIG_HOME':arm/'config','XDG_DATA_HOME':arm/'data','ZDOTDIR':arm/'login-shell'}
 for key,path in dirs.items():env[key]=str(path)
 node=u/'apps/desktop/.desktop-build/targets/mac-arm64/runtime/primary-runtime/dependencies/node/bin/node'
 env['PATH']=str(node.parent)+':/usr/bin:/bin:/usr/sbin:/sbin'
 # Native Desktop may invoke its public package manager later. Keep the outer
 # AppHost Git monitor across this deliberately minimal environment boundary.
 git_policy={'GIT_CONFIG_NOSYSTEM':'1','GIT_TERMINAL_PROMPT':'0','GIT_CONFIG_COUNT':'2','GIT_CONFIG_KEY_0':'credential.helper','GIT_CONFIG_VALUE_0':'','GIT_CONFIG_KEY_1':'credential.helper','GIT_CONFIG_VALUE_1':'!gh auth git-credential'}
 if any(os.environ.get(k)!=v for k,v in git_policy.items()) or os.environ.get('GIT_CONFIG_PARAMETERS') or not os.environ.get('GIT_TRACE2_EVENT'):raise GateError('GIT_GUARD_REQUIRED')
 env.update(git_policy)
 env['GIT_TRACE2_EVENT']=os.environ['GIT_TRACE2_EVENT']
 env['npm_config_manage_package_manager_versions']='false'
 env['pnpm_config_manage_package_manager_versions']='false'
 env['PATH']+=':/opt/homebrew/bin:/usr/local/bin'
 env['npm_execpath']=str(u/'apps/desktop/node_modules/pnpm/bin/pnpm.cjs')
 # The public dev.ts normally supplies this required unpackaged-launch path.
 # We launch its public generated HarnessDev directly, preserving the same value.
 env['DSH_DESKTOP_PRIMARY_RUNTIME_DIR']=str(u/'apps/desktop/.desktop-build/targets/mac-arm64/runtime/primary-runtime')
 env.update(DSH_DESKTOP_MAIN_INSPECT_PORT=str(ports[0]),DSH_DESKTOP_RENDERER_DEBUG_PORT=str(ports[1]),DSH_DESKTOP_HOST_INSPECT_PORT=str(ports[2]),DSH_DESKTOP_OPEN_DEVTOOLS='0')
 return env,dirs,node

def configuration(root,ports):
 if len(ports)!=3 or len(set(ports))!=3:raise GateError('INVALID_NATIVE_PORTS')
 r=Path(root).resolve();u=r/'upstream';env,dirs,node=isolated_environment(r,ports)
 app=u/'apps/desktop';bundle=app/'.desktop-build/development/Harness Dev.app';launcher=bundle/'Contents/MacOS/HarnessDev';electron=bundle/'Contents/MacOS/Electron'
 deps=[node,launcher,electron,Path(env['DSH_DESKTOP_PRIMARY_RUNTIME_DIR'])/'runtime.json',app/'node_modules/pnpm/bin/pnpm.cjs',app/'lib/main.js',u/'apps/desktop-host/lib/index.js',u/'node_modules/.pnpm/node_modules']
 expected=[str(electron),'--inspect=127.0.0.1:'+str(ports[0]),'--remote-debugging-port='+str(ports[1]),'--user-data-dir='+env['DSH_DESKTOP_USER_DATA_DIR'],str(app),*KEYCHAIN_FLAGS]
 return {'root':str(r),'upstream':str(u),'cwd':str(app),'dependencies':[str(x) for x in deps],'writable':[str(x) for x in list(dirs.values())+[app/'.desktop-build']],'ports':ports,'registry':str(r/'native/registry.json'),'command':[str(launcher),*KEYCHAIN_FLAGS],'electron':str(electron),'electronVersion':'44.7.0','expectedArgv':expected,'environment':env,'verifyCommit':True}

def listeners(pids):
 if not pids:return []
 p=subprocess.run(['lsof','-nP','-a','-p',','.join(map(str,pids)),'-iTCP','-sTCP:LISTEN'],text=True,capture_output=True)
 if p.returncode not in [0,1]:raise GateError('LSOF_FAILED')
 return p.stdout.splitlines()[1:]

def run(c):
 preflight(c)
 root=Path(c['root']);arm=root/'native';arm.mkdir(exist_ok=True)
 evidence=root/'launches'/str(time.time_ns());evidence.mkdir(parents=True)
 c['evidenceRoot']=str(evidence)
 reservation=reserve_launch(root,evidence,c)
 def record(name,data):
  put(evidence/name,data);put(root/name,data)
 put(root/'active-run.json',{'evidenceRoot':str(evidence)})
 for key in ['HOME','DSH_HOME','DSH_DESKTOP_USER_DATA_DIR','TMPDIR','XDG_CACHE_HOME','npm_config_cache','npm_config_store_dir','XDG_CONFIG_HOME','XDG_DATA_HOME','ZDOTDIR']:
  inside(root,c['environment'][key]).mkdir(parents=True,exist_ok=True)
 stamp={'command':c['command'],'cwd':c['cwd'],'resolvedCwd':str(Path(c['cwd']).resolve()),'resolvedDependencies':[str(Path(x).resolve()) for x in c['dependencies']],'writable':c['writable'],'environment':c['environment'],'fixedUpstream':FIXED,'skipBuildStillPrepares':['prepareDevelopmentProject','preparePrimaryRuntime','prepareDevelopmentApp']}
 record('launch-config.json',stamp)
 # No automatic retry or second launch. Stop remains a public app Quit action.
 with (evidence/'desktop.log').open('w') as log:
  p=subprocess.Popen(c['command'],cwd=c['cwd'],env=c['environment'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,start_new_session=True)
  c['launchedPid']=p.pid
  def record_output():
   for line in p.stdout:
    log.write(re.sub(r'(token=)[^\s]+',r'\1[redacted]',line));log.flush()
  reader=threading.Thread(target=record_output,daemon=True);reader.start()
  observer=ExitObserver();exitEvents=[];
  known={};groups=set();seen=set();launched=time.monotonic();lastListener=time.monotonic();portRows=[];observedPorts=set(c['ports']);electronProof={}
  while True:
   current=processes();belongs={p.pid}
   changed=True
   while changed:
    changed=False
    for item in current.values():
     if item['ppid'] in belongs and item['pid'] not in belongs:belongs.add(item['pid']);changed=True
   for item in current.values():
    if item['pid'] in belongs:
     known.setdefault((item['pid'],item['start']),item);groups.add(item['pgid']);seen.add(item['pid'])
   # Capture orphaned children only in an already registered exclusive group.
   for item in current.values():
    if item['pgid'] in groups and (item['pid'],item['start']) not in known:
     if str(root) not in item['command']:raise GateError('UNKNOWN_PROCESS_IN_OWN_GROUP: '+str(item['pid']))
     known[(item['pid'],item['start'])]=item
   for item in known.values():observer.register(item['pid'],item['start'])
   exitEvents.extend(observer.poll())
   record('exit-events.json',{'events':exitEvents,'registrationErrors':observer.registrationErrors})
   alive=[x for k,x in known.items() if k[0] in current and current[k[0]]['start']==k[1]]
   if time.monotonic()-lastListener>=1:
    portRows=listeners([x['pid'] for x in alive]);lastListener=time.monotonic()
    for row in portRows:
     m=re.search(r':(\d+) \(LISTEN\)',row)
     if m:observedPorts.add(int(m.group(1)))
   registry={'evidenceRoot':str(evidence),'launcherPid':p.pid,'launcherExit':p.poll(),'processes':list(known.values()),'alive':alive,'listeners':portRows,'registeredPorts':c['ports'],'observedPorts':sorted(observedPorts),'normalExitRequested':(evidence/'normal-quit-requested.json').exists(),'phase':'RUNNING' if p.poll() is None else 'PARENT_EXITED_CHILD_CHECK'}
   put(c['registry'],registry)
   put(evidence/'registry.json',registry)
   for item in alive:
    now=current.get(item['pid'],{})
    if (now.get('command','').startswith(c['electron']+' ') or now.get('command')==c['electron']) and item['pid'] not in electronProof:
     electronProof[item['pid']]=observe_electron(c,item)
     record('actual-electron.json',{'processes':list(electronProof.values()),'source':'OS argv, registered PID/start/PPID/PGID and executable version'})
   if p.poll() is not None:
    current=processes()
    alive=[x for k,x in known.items() if k[0] in current and current[k[0]]['start']==k[1]]
    portRows=listeners([x['pid'] for x in alive])
    if alive or portRows:
     record('chain-anomaly.json',registry);raise GateError('PARENT_EXITED_WITH_REGISTERED_CHILDREN')
    ports_free(sorted(observedPorts));reader.join(timeout=2)
    if not electronProof:raise GateError('NO_ACTUAL_ELECTRON_OBSERVATION')
    exitEvents.extend(observer.poll());record('exit-events.json',{'events':exitEvents,'registrationErrors':observer.registrationErrors});observer.close()
    result={'evidenceRoot':str(evidence),'launcherExit':p.returncode,'allRegisteredProcessesExited':True,'allRegisteredPortsFree':True,'allObservedPorts':sorted(observedPorts),'allObservedPortsFree':True,'listeners':[],'normalExitRequested':registry['normalExitRequested'],'processes':list(known.values())}
    record('exit-checkpoint.json',result)
    if p.returncode==0 and registry['normalExitRequested']:record('normal-exit.json',result)
    release_launch(root,reservation)
    record('reservation-released.json',{'evidenceRoot':str(evidence),'allRegisteredProcessesExited':True,'allObservedPortsFree':True})
    return p.returncode
   time.sleep(.3)

def main():
 import argparse
 p=argparse.ArgumentParser();p.add_argument('action',choices=['prepare-check','preflight','start','check-stopped']);p.add_argument('--root',required=True);p.add_argument('--ports',required=True);args=p.parse_args()
 actualRoot=Path(__file__).resolve().parent.parent
 if Path(args.root).resolve()!=actualRoot:
  print('DRIVER_ROOT_MISMATCH',file=sys.stderr)
  rejection=actualRoot/'rejected-roots';rejection.mkdir(exist_ok=True)
  put(rejection/(str(time.time_ns())+'.json'),{'requestedRoot':args.root,'action':args.action,'error':'DRIVER_ROOT_MISMATCH'})
  return 2
 c=configuration(args.root,[int(x) for x in args.ports.split(',')])
 try:
  if args.action=='prepare-check':
   u=Path(c['upstream']);c['dependencies']=[str(u/x) for x in ['node_modules/tsx/dist/cli.mjs','apps/desktop/node_modules/pnpm/bin/pnpm.cjs','apps/desktop/node_modules/electron','apps/desktop/lib/main.js','apps/desktop-host/lib/index.js']]
   preflight(c);print('ISOLATED_PUBLIC_PREPARATION_PREFLIGHT_PASS');return 0
  if args.action=='start':return run(c)
  if args.action=='check-stopped':
   alive=registered_alive(c['registry'])
   if alive:raise GateError('REGISTERED_PROCESS_ALIVE')
   ports_free(c['ports']);ports_free(json.loads(Path(c['registry']).read_text()).get('observedPorts',[]));print('ALL_REGISTERED_PROCESSES_AND_PORTS_STOPPED');return 0
  preflight(c);print('ISOLATED_PREFLIGHT_PASS');return 0
 except GateError as e:
  data={'action':args.action,'error':str(e),'time':datetime.datetime.now(datetime.timezone.utc).isoformat()}
  print(str(e),file=sys.stderr);put(Path(args.root)/'gate-error.json',data)
  if c.get('evidenceRoot'):
   put(Path(c['evidenceRoot'])/'gate-error.json',data)
   if c.get('launchedPid'):put(Path(args.root)/'chain-anomaly.json',data)
  return 2
if __name__=='__main__':sys.exit(main())
