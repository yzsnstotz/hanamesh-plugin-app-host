import os,json,subprocess,pathlib,sys,time
root=pathlib.Path(sys.argv.pop(1)).resolve()
source=pathlib.Path(__file__).resolve().parents[3]
evidence=root/'_evidence/request-contract'
evidence.mkdir(parents=True,exist_ok=True)
for d in ['home','dsh-home','tmp']: (root/d).mkdir(exist_ok=True)
import shutil
node=pathlib.Path(shutil.which('node')).resolve()
paths=[str(node.parent),'/Users/yzliu/.local/bin','/opt/homebrew/bin','/usr/bin','/bin','/usr/sbin','/sbin']
env={'PATH':':'.join(paths),'HOME':str(root/'home'),'DSH_HOME':str(root/'dsh-home'),'TMPDIR':str(root/'tmp'),'TMP':str(root/'tmp'),'LANG':'C.UTF-8','LC_ALL':'C.UTF-8','npm_config_userconfig':str(root/'user.npmrc'),'npm_config_globalconfig':str(root/'global.npmrc'),'HANAMESH_APPHOST_RUN_DIR':str(root)}
for f in ['user.npmrc','global.npmrc']: (root/f).touch(exist_ok=True)
name=sys.argv[1];cmd=sys.argv[2:]
log=evidence/(name+'.log')
started=time.time()
with log.open('w') as out:
 r=subprocess.run(cmd,cwd=source,env=env,stdout=out,stderr=subprocess.STDOUT)
record={'name':name,'argv':cmd,'cwd':str(source),'environment_keys':sorted(env),'exit_code':r.returncode,'duration_seconds':round(time.time()-started,3),'log':str(log)}
with (evidence/'commands.jsonl').open('a') as f:f.write(json.dumps(record)+'\n')
print(json.dumps(record))
print(''.join(log.read_text().splitlines(keepends=True)[-18:]))
sys.exit(r.returncode)
