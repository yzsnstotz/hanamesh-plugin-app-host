/* Browser bundle for DSH client-modules. The Node condition of exports["./client"] remains the SDK. */
window.__ModuleLoader__.load({id:'@hanamesh/dsh-app-host',factory:function(require){'use strict';
  const React=require('react');
  const h=React.createElement;
  const request=async(path,init={})=>{
    const response=await globalThis.fetch.bind(globalThis)(path,{...init,headers:{'x-hanamesh-client':'workspace-v1',...(init.body?{'content-type':'application/json'}:{}),...init.headers}});
    const value=await response.json();if(!response.ok)throw new Error(value?.error?.code??`HTTP_${response.status}`);return value;
  };
  const entryId=entry=>entry.projection==='file'?`file:${entry.base??'home'}:${entry.path}`:`env:${entry.env}`;
  const groups=items=>{
    const found=new Map();for(const item of items){const title=item.entry.purpose??item.entry.env??item.entry.path??entryId(item.entry);
      if(!found.has(title))found.set(title,[]);found.get(title).push(item);}return[...found.entries()];
  };
  function ProvidersSection(){
    const[providers,setProviders]=React.useState([]),[apps,setApps]=React.useState([]),[plans,setPlans]=React.useState({}),[error,setError]=React.useState('');
    const load=React.useCallback(async()=>{try{setError('');const[p,a]=await Promise.all([request('/hanamesh/router/providers'),request('/hanamesh/apps')]);
      setProviders(p.providers??[]);setApps(a.apps??[]);const rows=await Promise.all((a.apps??[]).map(async app=>[app.id,await request('/hanamesh/router/plan?appId='+encodeURIComponent(app.id))]));setPlans(Object.fromEntries(rows));}catch(e){setError(String(e.message??e));}},[]);
    React.useEffect(()=>{void load();},[load]);
    const mutate=async(path,body)=>{try{setError('');await request(path,{method:'POST',body:JSON.stringify(body)});await load();}catch(e){setError(String(e.message??e));}};
    const sourceRows=providers.map(provider=>h('tr',{key:provider.id},h('td',null,provider.displayName),h('td',null,provider.source),h('td',null,provider.state),h('td',null,provider.keyHint??'—'),h('td',null,(provider.models??[]).join('、')||'—')));
    const cards=apps.map(app=>{const plan=plans[app.id];if(!plan)return null;return h('section',{className:'hm-provider-card',key:app.id},h('h3',null,app.name),
      ...groups(plan.items??[]).map(([purpose,items])=>h('div',{className:'hm-provider-purpose',key:purpose},h('strong',null,purpose),...items.map(item=>{
        const id=entryId(item.entry),choices=providers.filter(provider=>!item.entry.providers?.length||item.entry.providers.includes(provider.id));
        return h('div',{className:'hm-provider-row',key:id},h('span',null,item.entry.env??item.entry.path),h('span',null,item.state),
          h('select',{defaultValue:'',onChange:event=>{const provider=choices.find(row=>row.id===event.target.value);if(provider)void mutate('/hanamesh/router/grant',{appId:app.id,entryId:id,subject:provider.ref?{kind:'api-key',ref:provider.ref}:{kind:'provider',providerId:provider.id},model:provider.models?.[0]});}},h('option',{value:''},'选择供应商'),...choices.map(provider=>h('option',{value:provider.id,key:provider.id},provider.displayName))),
          item.granted?h('button',{type:'button',onClick:()=>void mutate('/hanamesh/router/revoke',{appId:app.id,entryId:id})},'撤销'):null);
      }))),h('details',null,h('summary',null,'高级'),h('button',{type:'button',onClick:()=>void mutate('/hanamesh/router/mode',{appId:app.id,mode:plan.mode==='managed'?'app-owned':'managed'})},plan.mode==='managed'?'切换为应用自管':'切换为托管')));});
    return h('section',{className:'hm-providers'},h('h2',null,'供应商'),h('p',null,'这里只显示来源、状态、提示与模型，不读取或展示密钥值。'),error?h('p',{role:'alert'},error):null,
      h('button',{type:'button',onClick:()=>void mutate('/hanamesh/router/gateway',{enabled:true})},'启用网关'),
      h('table',null,h('thead',null,h('tr',null,...['名称','来源','状态','Key 提示','模型'].map(label=>h('th',{key:label},label)))),h('tbody',null,...sourceRows)),...cards);
  }
  const name='hanamesh-app-host-client',inject=['slots','locale'];
  function apply(ctx){ctx.effect(()=>{const style=document.createElement('style');style.textContent='.hm-providers{display:grid;gap:16px}.hm-providers table{width:100%;border-collapse:collapse}.hm-providers th,.hm-providers td{padding:8px;text-align:left;border-bottom:1px solid color-mix(in srgb,currentColor 14%,transparent)}.hm-provider-card{padding:16px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:12px}.hm-provider-row{display:grid;grid-template-columns:minmax(120px,1fr) auto minmax(180px,1fr) auto;gap:8px;align-items:center;margin:8px 0}';document.head.append(style);return()=>style.remove();},'hanamesh-app-host:style');
    ctx.effect(()=>ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'hanamesh-providers',order:18,label:'供应商'},ProvidersSection)),'hanamesh-app-host:providers');}
  return{name,inject,apply,ProvidersSection};
}});
