// Migrated from hanamesh-plugin-auth-apikey 8bb7ba7d2ac18a4dc3004674b5fc2b9aa5e3b0f5
// source sha256 e903802b3d1473b643693634a0e3ffcf506b6006d2522c44553a6dc8b4a9e00e.
// Detection, adoption and key mutation were intentionally not migrated: Router only grants existing providers.
import { providerOf } from './sources.js';

const REF=/^[A-Za-z_][A-Za-z_0-9]*$/, APP=/^[a-z0-9][a-z0-9-]*$/;
const KEY=/^hanamesh-auth-oauth\/([a-z0-9-]+)--app-([a-z0-9-]+)$/;
const error=code=>Object.assign(new Error(code),{code});
export const entryId=entry=>entry.projection==='file'?`file:${entry.base??'home'}:${entry.path}`:`env:${entry.env}`;
const emptyApp=()=>({mode:'managed',grants:{},ledger:{},revoked:{}});

export function createRouter({credentials,domain,apps,sources,oauth=()=>undefined}) {
  let writing=Promise.resolve(); const instancePending=new Map();
  const snapshot=()=>domain.global.get();
  const appState=appId=>snapshot().apps[appId]??emptyApp();
  function updateApp(appId,change){
    const next=writing.then(async()=>{const old=snapshot(),app=structuredClone(old.apps[appId]??emptyApp());change(app);
      await domain.global.set({...old,apps:{...old.apps,[appId]:app}});});writing=next.catch(()=>{});return next;
  }
  function declaration(appId){
    if(!APP.test(appId))throw error('INVALID_APP');
    const app=apps.list().apps.find(item=>item.id===appId);if(!app)throw error('APP_NOT_FOUND');
    return app.deployments.filter(d=>d.mode==='owned').flatMap(d=>d.credentialEnv??[]);
  }
  const declared=(appId,id)=>declaration(appId).find(entry=>entryId(entry)===id);
  function validSubject(entry,subject,appId){
    if(!subject||!['api-key','provider','grant'].includes(subject.kind))throw error('INVALID_SUBJECT');
    if(entry.kind&&entry.kind!==(subject.kind==='provider'?'api-key':subject.kind))throw error('SUBJECT_KIND_MISMATCH');
    let provider;
    if(subject.kind==='api-key'){if(!REF.test(subject.ref))throw error('INVALID_REF');provider=providerOf(subject.ref);}
    if(subject.kind==='provider'){if(!/^[a-z0-9][a-z0-9-]*$/.test(subject.providerId))throw error('INVALID_PROVIDER');provider=subject.providerId;}
    if(subject.kind==='grant'){
      const match=KEY.exec(subject.key);if(!match||match[2]!==appId)throw error('CONSUMER_MISMATCH');provider=match[1];
    }
    if(!accepts(entry,provider))throw error('PROVIDER_MISMATCH');
  }
  async function providerDirectory(){return await sources.list();}
  /** Providers an api-key entry accepts: its declared ids, plus the OpenAI-compatible Coding OAuth
   *  gateway wherever `openai` is accepted (same wire protocol, `{{baseUrl}}` carries the difference). */
  const accepts=(entry,providerId)=>!entry.providers?.length||entry.providers.includes(providerId)
    ||(providerId==='coding-oauth-gateway'&&entry.providers.includes('openai'));
  /** Auto-route (2026-09-21 contract): when the profile already holds a configured provider the entry accepts
   *  and the user has not revoked it, the Router grants it without a click. Declared order wins; the gateway
   *  is the last resort. Explicit grants and `app-owned` mode always take precedence. */
  function autoSubject(entry,app,providers){
    const id=entryId(entry);if(entry.kind!=='api-key'||entry.projection==='file'||app.revoked?.[id])return undefined;
    const configured=providers.filter(p=>p.state==='configured'&&accepts(entry,p.id));
    const ordered=[...(entry.providers??[]).map(pid=>configured.find(p=>p.id===pid)).filter(Boolean),...configured.filter(p=>p.id==='coding-oauth-gateway')];
    const found=ordered[0]??configured[0];if(!found)return undefined;
    return found.ref?{kind:'api-key',ref:found.ref}:{kind:'provider',providerId:found.id};
  }
  function template(value,vars){
    return value.replace(/\{\{(provider|baseUrl|model)(?:\|([^}]*))?\}\}/g,(_,name,fallback)=>vars[name]||fallback||'');
  }
  const api={
    providers:providerDirectory,
    async enableGateway(enabled){return await sources.enableGateway(enabled);},
    async mode(appId){declaration(appId);return appState(appId).mode;},
    async setMode(appId,mode){declaration(appId);if(!['managed','app-owned'].includes(mode))throw error('INVALID_MODE');
      await updateApp(appId,app=>{app.mode=mode;});},
    async plan(appId){
      const entries=declaration(appId),app=appState(appId),oauthProvider=oauth(),providers=await providerDirectory();
      const oauthInfos=oauthProvider?await oauthProvider.providers():[];
      const items=await Promise.all(entries.map(async entry=>{
        const id=entryId(entry),grant=app.grants[id],item={entry,state:'missing'};
        if(app.mode==='app-owned'){item.state='app-owned';return item;}
        if(grant){item.granted=grant.subject;if(grant.model)item.model=grant.model;
          let present=false;
          if(grant.subject.kind==='api-key')present=(await credentials.describe(grant.subject.ref)).configured;
          if(grant.subject.kind==='provider')present=providers.some(p=>p.id===grant.subject.providerId&&p.state==='configured');
          if(grant.subject.kind==='grant')present=!!oauthProvider&&(await credentials.describeRecord(grant.subject.key)).configured;
          item.state=present?'granted':'missing';
          if(grant.subject.kind==='grant'){item.riskNotice=oauthInfos.find(x=>x.id===KEY.exec(grant.subject.key)?.[1])?.riskNotice;item.projectedVersion=app.ledger[id]?.projectedVersion;}
        }else{
          const auto=autoSubject(entry,app,providers);
          if(auto){item.granted=auto;item.auto=true;item.state='auto';}
          else if(app.revoked?.[id])item.state='revoked';
        }
        return item;
      }));return{appId,mode:app.mode,items};
    },
    async grant(appId,id,subject,opts={}){
      const entry=declared(appId,id);if(!entry)throw error('ENTRY_UNKNOWN');validSubject(entry,subject,appId);
      if(subject.kind==='grant'&&opts.riskAcknowledged!==true)throw error('RISK_NOT_ACKNOWLEDGED');
      if(subject.kind==='provider'&&!((await providerDirectory()).some(p=>p.id===subject.providerId)))throw error('ROUTER_PROVIDER_ABSENT');
      await updateApp(appId,app=>{app.grants[id]={subject,...(opts.model?{model:opts.model}:{}),grantedAt:new Date().toISOString(),riskAcknowledged:opts.riskAcknowledged===true};delete app.revoked?.[id];});
      return await api.plan(appId);
    },
    async revoke(appId,id){if(!declared(appId,id))throw error('ENTRY_UNKNOWN');await updateApp(appId,app=>{delete app.grants[id];app.revoked??={};app.revoked[id]=true;});return await api.plan(appId);},
    async credentialResolver(input){
      await writing;const{appId,instanceId}=input,current=declaration(appId),byId=new Map(current.map(e=>[entryId(e),e]));
      const app=appState(appId),env={},files=[],secrets=[],pending=new Map();
      if(app.mode==='app-owned'){
        for(const[id,ledger]of Object.entries(app.ledger))if(byId.has(id)&&id.startsWith('file:')&&(ledger.pendingVersion??ledger.projectedVersion)!==undefined&&ledger.removedForVersion!==(ledger.pendingVersion??ledger.projectedVersion))files.push({path:byId.get(id).path,policy:'remove'});
        return files.length?{files}:undefined;
      }
      const applySets=(entry,vars)=>{for(const[name,value]of Object.entries(entry.sets??{}))if(byId.has('env:'+name)){const expanded=template(value,vars);if(expanded)env[name]=expanded;}};
      const directory=await providerDirectory();
      for(const entry of input.credentialEnv){
        const id=entryId(entry),matched=byId.get(id);if(!matched||JSON.stringify(matched)!==JSON.stringify(entry))continue;
        const auto=app.grants[id]?undefined:autoSubject(matched,app,directory),grant=app.grants[id]??(auto?{subject:auto}:undefined);if(!grant)continue;validSubject(entry,grant.subject,appId);
        if(entry.projection==='file'){
          if(grant.subject.kind!=='grant'||!oauth())continue;if(!(await credentials.describeRecord(grant.subject.key)).configured)continue;
          const projection=await oauth().project(grant.subject.key,entry.format);if(typeof projection.content!=='string')continue;
          const version=projection.version,old=app.ledger[id];files.push({path:entry.path,content:projection.content,policy:(old?.pendingVersion??old?.projectedVersion)===version?'if-absent':'overwrite'});
          pending.set(id,version);secrets.push(projection.content);applySets(entry,{provider:KEY.exec(grant.subject.key)?.[1]??'',baseUrl:'',model:grant.model??''});
        }else if(entry.env&&['api-key','provider'].includes(grant.subject.kind)){
          const resolved=await sources.resolve(grant.subject);if(!resolved?.value)continue;
          env[entry.env]=resolved.value;secrets.push(resolved.value);
          const provider=resolved.provider??{},model=grant.model??provider.models?.[0]??'';
          applySets(entry,{provider:provider.id??'',baseUrl:provider.baseUrl??'',model});
        }else if(entry.env&&grant.subject.kind==='grant'&&oauth()){
          const projection=await oauth().project(grant.subject.key,'env');if(projection.format==='env'&&typeof projection.env[entry.env]==='string'){
            env[entry.env]=projection.env[entry.env];secrets.push(projection.env[entry.env]);applySets(entry,{provider:KEY.exec(grant.subject.key)?.[1]??'',baseUrl:'',model:grant.model??''});
          }
        }
      }
      for(const[id,ledger]of Object.entries(app.ledger))if(id.startsWith('file:')&&byId.has(id)&&!app.grants[id]&&(ledger.pendingVersion??ledger.projectedVersion)!==undefined&&ledger.removedForVersion!==(ledger.pendingVersion??ledger.projectedVersion))files.push({path:byId.get(id).path,policy:'remove'});
      if(pending.size){await updateApp(appId,app=>{for(const[id,version]of pending)app.ledger[id]={...app.ledger[id],pendingVersion:version,pendingInstanceId:instanceId};});instancePending.set(instanceId,{appId,pending});}
      return Object.keys(env).length||files.length?{env,files,secrets}:undefined;
    },
    async observe(event){
      if(!['credential.injected','credential.file-removed'].includes(event.type))return;
      const pending=instancePending.get(event.instanceId),appId=pending?.appId??Object.keys(snapshot().apps).find(id=>Object.entries(appState(id).ledger).some(([key,ledger])=>key.startsWith('file:')&&(ledger.pendingInstanceId===event.instanceId||event.names?.includes(`file:${key.split(':').slice(2).join(':')}`))));
      if(!appId)return;
      for(const name of event.names??[]){if(!name.startsWith('file:'))continue;const id=Object.keys(appState(appId).ledger).concat([...pending?.pending.keys()??[]]).find(key=>key.startsWith('file:')&&`file:${key.split(':').slice(2).join(':')}`===name);if(!id)continue;
        await updateApp(appId,app=>{const ledger=app.ledger[id]??{};if(event.type==='credential.injected'&&ledger.pendingInstanceId===event.instanceId){ledger.projectedVersion=ledger.pendingVersion;delete ledger.removedForVersion;}if(event.type==='credential.file-removed')ledger.removedForVersion=ledger.pendingVersion??ledger.projectedVersion;app.ledger[id]=ledger;});}
    },
  };
  return api;
}
