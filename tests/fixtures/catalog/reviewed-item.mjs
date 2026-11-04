// Positive provider fixture: explicit reviewed facts; never a product authorization fallback.
export function reviewedNpmItem(item, version='1.2.3') {
 const name=item.package.name;
 return {...item,oneClickInstall:{allowed:true,reason:null},installMethods:[{channel:'hanamesh',kind:'npm',spec:name,command:null,allowBuild:[],sourceId:item.source?.sourceId??'awesome',sourceRef:item.source?.sourceRef??item.id,target:{source:'npm',name,version,allowBuild:[]}}]};
}
