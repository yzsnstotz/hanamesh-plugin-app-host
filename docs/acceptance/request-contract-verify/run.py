import json,os,pathlib,shutil,subprocess,sys,time
source=pathlib.Path(__file__).resolve().parents[3]
root=pathlib.Path(sys.argv[1]).resolve(); name=sys.argv[2]; cmd=sys.argv[3:]
evidence=root.parent/'_evidence/request-contract-verify'; evidence.mkdir(parents=True,exist_ok=True)
for part in ['home','dsh-home','tmp']: (root/part).mkdir(parents=True,exist_ok=True)
node=pathlib.Path('/Users/yzliu/.local/share/fnm/node-versions/v24.13.1/installation/bin/node').resolve()
env={'PATH':f'{node.parent}:/Users/yzliu/.local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin','HOME':str(root/'home'),'DSH_HOME':str(root/'dsh-home'),'TMPDIR':str(root/'tmp'),'TMP':str(root/'tmp'),'LANG':'C.UTF-8','LC_ALL':'C.UTF-8','npm_config_userconfig':str(root/'user.npmrc'),'npm_config_globalconfig':str(root/'global.npmrc')}
for part in ['user.npmrc','global.npmrc']: (root/part).touch(exist_ok=True)
started=time.time(); log=evidence/(name+'.log')
with log.open('w') as f:r=subprocess.run(cmd,cwd=source,env=env,stdout=f,stderr=subprocess.STDOUT)
record={'name':name,'argv':cmd,'cwd':str(source),'environment_keys':sorted(env),'exit_code':r.returncode,'seconds':round(time.time()-started,2),'log':str(log)}
with (evidence/'commands.jsonl').open('a') as f:f.write(json.dumps(record)+'\n')
print(json.dumps(record));print(''.join(log.read_text().splitlines(keepends=True)[-15:]));sys.exit(r.returncode)
