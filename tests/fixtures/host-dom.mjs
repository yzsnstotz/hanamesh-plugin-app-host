// Component-only host-node/ref commit driver. No browser, navigation or security
// behavior is simulated. A retained iframe Window stays stable until removal.
export function createHostDom(){
  let mounted=new Map();
  const assign=(ref,value)=>{if(typeof ref==='function')ref(value);else if(ref)ref.current=value;};
  function commit(tree){
    const next=new Map();
    function visit(v,path){
      if(Array.isArray(v)){v.forEach((child,i)=>visit(child,path+'/'+(child?.props?.key??i)));return;}
      if(!v||typeof v!=='object')return;
      if(typeof v.type==='string'){
        const key=path+':'+v.type,old=mounted.get(key);
        const element=old?.element??{tagName:v.type.toUpperCase(),isConnected:true,
          ...(v.type==='iframe'?{contentWindow:{sentMessages:[],postMessage(data,targetOrigin){this.sentMessages.push({data,targetOrigin});}}}:{}),
          getAttribute(name){return this.attributes[name]??null;}};
        element.attributes=Object.fromEntries(Object.entries(v.props??{}).filter(([name])=>name!=='ref'));
        element.isConnected=true;next.set(key,{element,ref:v.props?.ref});
      }
      visit(v.children,path+'/children');
    }
    visit(tree,'root');
    for(const[key,old]of mounted){const current=next.get(key);if(!current||old.ref!==current.ref)assign(old.ref,null);if(!current)old.element.isConnected=false;}
    for(const[key,current]of next){if(!mounted.has(key)||mounted.get(key).ref!==current.ref)assign(current.ref,current.element);}
    mounted=next;
  }
  return{commit,querySelectorAll(tag){return[...mounted.values()].map(v=>v.element).filter(e=>e.tagName===tag.toUpperCase());},clear(){commit(null);}};
}
