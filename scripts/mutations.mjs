import { cp,mkdtemp,readFile,writeFile,mkdir,rm,symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),out=join(root,'docs/acceptance/mutations');await mkdir(out,{recursive:true});
const cases=[
  {id:'M01-single-instance',file:'src/manager.js',from:'const reuse = app.singleInstanceOnly;',to:'const reuse = false;',test:'tests/manager.test.mjs',pattern:'^H02:',reason:/DATA_ROOT_BUSY|SPAWN_FAILED|Expected values to be strictly equal/},
  {id:'M02-reserve-launch',file:'src/consistency.js',from:"await publish(); // ORDER:RESERVE\n  await checkpoint('reservation-durable');\n  return await launch(); // ORDER:LAUNCH",to:"await launch(); // MUTATION: unsafe launch before ownership\n  await checkpoint('reservation-durable');\n  return await publish();",test:'tests/crash.test.mjs',pattern:'^X03 reserve-launch:',reason:/RESERVE_BOUNDARY_UNSAFE/},
  {id:'M03-stop-publish',file:'src/consistency.js',from:"await stop(); // ORDER:STOP\n  await checkpoint('runtime-stopped');\n  return await publish(); // ORDER:STOPPED-PUBLISH",to:"await publish(); // MUTATION: unsafe acknowledgement before termination\n  await checkpoint('runtime-stopped');\n  return await stop();",test:'tests/crash.test.mjs',pattern:'^X03 stop-publish:',reason:/STOP_BOUNDARY_UNSAFE/},
  {id:'M05-credential-declared-only',file:'src/manager.js',from:"if (envNames.has(key) && typeof value === 'string' && !value.includes('\\0')) env[key] = value; else rejected.push(key);",to:"env[key] = value; /* MUTATION: undeclared credential names leak into the child */",test:'tests/credentials.test.mjs',pattern:'^AH-C2',reason:/Expected values to be strictly equal|UNDECLARED_KEY/},
  {id:'M04-socket-ownership',file:'src/runtime.js',from:"runtime?.mode !== 'owned' || await ownsLoopbackPort(runtime.groupId, Number(new URL(origin).port))",to:'true /* MUTATION: accepts unrelated same-marker HTTP endpoint */',test:'tests/storage.test.mjs',pattern:'^AH readiness:',reason:/Missing expected rejection/},
  {id:'M06-router-sets-declared',file:'src/router/broker.js',from:"if(byId.has('env:'+name)){const expanded=template(value,vars);if(expanded)env[name]=expanded;}",to:"if(true){const expanded=template(value,vars);if(expanded)env[name]=expanded;} /* MUTATION: undeclared sets target */",test:'tests/router-broker.test.mjs',pattern:'^AH-R11/AK11',reason:/NOT_DECLARED|Expected values to be strictly deep-equal|actual/},
  {id:'M07-runtime-exec-traversal',file:'src/descriptor.js',from:"typeof exec === 'string' && safeRelativePosix(exec)",to:"typeof exec === 'string' && exec.length > 0 /* MUTATION: runtime exec traversal accepted */",test:'tests/descriptor-runtime.test.mjs',pattern:'^AH-P02:',reason:/Missing expected exception|INVALID_RUNTIME/},
  {id:'M09-runtime-lock-unproven-orphan',file:'src/store.js',from:"unknown.push({ pid: child.pid, role: child.role ?? null, command: live.command ?? null });",to:"continue; /* MUTATION: a live child that cannot be proven ours is treated as gone and the lock is taken over it */",test:'tests/runtime-lock.test.mjs',pattern:'^AH-L04:',reason:/Missing expected rejection|DATA_ROOT_BUSY/},
  {id:'M10-library-node-electron',file:'src/library/locate.js',from:"if(versions.electron!==undefined)return undefined;",to:"if(false)return undefined; /* MUTATION: an Electron host silently runs library installs with its own executable */",test:'tests/library-locate.test.mjs',pattern:'^AH-L09:',reason:/Expected values to be strictly equal|NODE_RUNTIME_REQUIRED/},
  {id:'M08-node-runtime-electron',file:'src/runtime.js',from:"if (process.versions.electron !== undefined) {\n      throw new AppHostError('NODE_RUNTIME_REQUIRED', 'Electron hosts must configure an external Node.js executable.');\n    }",to:"if (process.versions.electron !== undefined) {\n      selected = process.execPath; /* MUTATION: Electron silently self-hosts instead of failing closed */\n    }",test:'tests/node-runtime.test.mjs',pattern:'^AH-K5-2: Electron self-hosting',reason:/Missing expected rejection|NODE_RUNTIME_REQUIRED/},
];
const run=(cwd,c)=>{
  const result=spawnSync(process.execPath,['--test','--test-reporter=tap',`--test-name-pattern=${c.pattern}`,c.test],{cwd,encoding:'utf8',timeout:15_000,maxBuffer:2*1024*1024});
  if(result.error)throw result.error;return{code:result.status,log:result.stdout+result.stderr};
};
const results=[];
for(const c of cases){
  const baseline=run(root,c);await writeFile(join(out,c.id+'-baseline.tap'),baseline.log);
  if(baseline.code!==0)throw new Error(`${c.id}: baseline must pass before applying a mutation.`);
  const temp=await mkdtemp(join(tmpdir(),'hm-app-host-mutation-'));
  try{
    for(const path of ['src','tests','scripts','consistency.json','package.json'])await cp(join(root,path),join(temp,path),{recursive:true});
    // Installed dependencies only (the DSH plugin entry imports schemastery/zod/storage-domain); never another repo's source.
    await symlink(join(root,'node_modules'),join(temp,'node_modules'),'dir');
    const target=join(temp,c.file),source=await readFile(target,'utf8');
    if(source.split(c.from).length!==2)throw new Error(`${c.id}: expected exactly one mutation anchor.`);
    const changed=source.replace(c.from,c.to);await writeFile(target,changed);
    const result=run(temp,c);await writeFile(join(out,c.id+'-mutant.tap'),result.log);
    const killed=result.code!==0&&c.reason.test(result.log);
    results.push({id:c.id,test:c.test,pattern:c.pattern,baselineExit:baseline.code,mutantExit:result.code,killed,
      originalSourceSha256:createHash('sha256').update(source).digest('hex'),mutatedSourceSha256:createHash('sha256').update(changed).digest('hex')});
    console.log(`${c.id}: baseline PASS; mutation ${killed?'DETECTED':'NOT DETECTED'}`);
    if(!killed)throw new Error(`${c.id}: mutation did not produce the expected product-invariant failure.`);
  }finally{await rm(temp,{recursive:true,force:true});}
}
await writeFile(join(out,'results.json'),JSON.stringify({generatedAt:new Date().toISOString(),results},null,2)+'\n');
console.log(`Mutation guard PASS: ${results.length}/${results.length} genuine source mutations detected.`);
