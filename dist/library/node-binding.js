/** Each operation captures one delegate; consecutive operations share its writer until the binding changes. */
export function nodeBinding(current,make){
 const cache=new Map();
 const delegate=()=>{const node=current();if(!cache.has(node))cache.set(node,make(node));return cache.get(node);};
 return new Proxy({}, {get(_target,key){const value=delegate()[key];return typeof value==='function'?value.bind(delegate()):value;}});
}
export function nodeStatusBinding(current,make){
 const cache=new Map();
 const read=(...args)=>{const node=current();if(!cache.has(node))cache.set(node,make(node));return cache.get(node)(...args);};
 read.close=async()=>{for(const reader of cache.values())await reader.close?.();cache.clear();};return read;
}
