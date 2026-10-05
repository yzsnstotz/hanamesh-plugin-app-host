from pathlib import Path
import os,json,subprocess,sys,time
RUN=Path('/Users/yzliu/.cache/hanamesh-runs/METADATA-DEVKIT-VENDOR-APPHOST-01');EV=RUN/'_evidence'
name=sys.argv[1];args=sys.argv[2:];cwd=os.environ.get('APPHOST_COMMAND_CWD',str(RUN/'hanamesh-plugin-app-host'))
env=os.environ.copy();env.update(json.loads((EV/'environment.json').read_text()));start=time.time()
assert not (EV/(name+'.log')).exists(), 'Do not overwrite original evidence'
with (EV/(name+'.log')).open('w') as log:p=subprocess.run(args,cwd=cwd,env=env,stdout=log,stderr=subprocess.STDOUT)
receipt={'name':name,'args':args,'cwd':cwd,'exitCode':p.returncode,'seconds':round(time.time()-start,3)}
with (EV/'commands.jsonl').open('a') as f:f.write(json.dumps(receipt)+'\n')
print(json.dumps(receipt),flush=True)
print((EV/(name+'.log')).read_text()[-2500:],flush=True)
sys.exit(p.returncode)
