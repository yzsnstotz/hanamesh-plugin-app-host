import fs from 'node:fs';
const OUT='/Users/yzliu/work/projects/hanamesh/_deliveries/p06-public-consumer-20261003/worker-real-host-rc45/t16-registration-probe.json';
const root='/Users/yzliu/work/projects/hanamesh/_deliveries/p06-public-consumer-20261003/worker-real-host-rc45';
const node=root+'/home/Library/Application Support/com.hanamesh.desktop/runtime/bin/node';
const alive=pid=>{if(!Number.isInteger(pid))return false;try{process.kill(pid,0);return true}catch{return false}};
const slim=i=>i?{id:i.id,appId:i.appId,status:i.status,pid:i.pid,pidAlive:alive(i.pid)}:null;
const def=(id,label)=>({id,name:label,singleInstanceOnly:true,deployments:[{id:'local',dataId:'default',mode:'owned',embedding:'gateway',command:node,args:['-e',"require('node:http').createServer((q,s)=>s.end('P06_PROBE_READY')).listen(Number(process.argv[1]),'127.0.0.1')",'{{port}}','{{dataDir}}'],readiness:{path:'/',status:200,bodyIncludes:'P06_PROBE_READY'},startTimeoutMs:10000,stopGraceMs:500}]});
export const name='@hanamesh/app-lifecycle-probe';
export function apply(ctx){
 ctx.inject(['hanameshApps'],scoped=>{
  const apps=scoped.get('hanameshApps');
  void (async()=>{
   const out={gate:'T16 REAL_HOST test-only Cordis consumer using rc45 host service',source:'isolated DSH 34984; no AppHost source changes',at:new Date().toISOString()};
   let a1,b,a2,oa,ob,oa2;
   try{
    a1=apps.register(def('p06-probe-a','P06 probe A'));b=apps.register(def('p06-probe-b','P06 probe B'));
    out.registrationFirst={a:a1,b};
    oa=await apps.open({appId:a1.appId,deploymentId:'local',viewId:'p06-probe-a-old'});
    ob=await apps.open({appId:b.appId,deploymentId:'local',viewId:'p06-probe-b'});
    out.before={a:slim(oa.instance),b:slim(ob.instance)};
    out.firstUnregister=await apps.unregister(a1.appId,a1.registrationId);
    out.afterFirst={a:slim(apps.instance(oa.instance.id)),b:slim(apps.instance(ob.instance.id))};
    a2=apps.register(def('p06-probe-a','P06 probe A'));out.registrationSecond=a2;
    out.staleUnregister=await apps.unregister(a1.appId,a1.registrationId);
    out.afterStale={b:slim(apps.instance(ob.instance.id)),aRegistrationPresent:apps.list().apps.some(x=>x.id===a1.appId)};
    oa2=await apps.open({appId:a2.appId,deploymentId:'local',viewId:'p06-probe-a-new'});
    out.newOpen=slim(oa2.instance);
    out.currentUnregister=await apps.unregister(a2.appId,a2.registrationId);
    out.afterCurrent={a:slim(apps.instance(oa2.instance.id)),b:slim(apps.instance(ob.instance.id))};
    out.otherUnregister=await apps.unregister(b.appId,b.registrationId);
    out.afterAll={a:slim(apps.instance(oa2.instance.id)),b:slim(apps.instance(ob.instance.id))};
    out.result=(a1.registrationId!==a2.registrationId&&out.staleUnregister.reason==='registration-replaced'&&out.afterStale.b.status==='ready'&&out.afterStale.b.pidAlive&&out.afterCurrent.b.status==='ready'&&out.afterCurrent.b.pidAlive&&!out.afterAll.b.pidAlive&&!out.afterAll.a.pidAlive)?'PASS':'PARTIAL';
   }catch(error){out.result='PARTIAL';out.error={name:error.name,code:error.code??null,message:error.message};}
   finally{out.completedAt=new Date().toISOString();fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');}
  })();
  return ()=>{};
 });
}
