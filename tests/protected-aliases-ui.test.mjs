import test from 'node:test';
import assert from 'node:assert/strict';
import {clientHarness, fakeClock} from './fixtures/client-ui-harness.mjs';

const protectedNames=['@hanamesh/dsh-app-host','hanamesh-core','hanamesh-usage','@hanamesh/dsh-core','@hanamesh/dsh-usage'];
const nodes=root=>root==null?[]:Array.isArray(root)?root.flatMap(nodes):typeof root==='object'?[root,...nodes(root.children)]:[];
const buttons=root=>nodes(root).filter(node=>node.type==='button').map(node=>node.children.join(''));

async function mountPage(t,{items=[],plugins=[]}){
  const calls=[],clock=fakeClock();
  const fetch=async(path,init={})=>{
    calls.push({path,method:init.method??'GET'});
    const value=path==='/hanamesh/library/target'?{target:null}:
      path.startsWith('/hanamesh/library?')?{items,plugins,installed:[],page:{nextCursor:null}}:null;
    assert(value,'unexpected route '+path);
    return{ok:true,json:async()=>value};
  };
  const ui=await clientHarness({fetch,clock,embedded:true});t.after(()=>ui.unmount());
  return{ui,calls};
}

test('P06-PA01: every protected name has no install, upgrade, or uninstall action in actual Market cards',async t=>{
  for(const name of protectedNames){
    for(const [scenario,row] of [
      ['uninstalled',null],
      ['upgrade',{packageName:name,version:'1.0.0',state:'installed'}],
      ['installed',{packageName:name,version:'2.0.0',state:'installed'}],
    ]){
      const id=`${name}-${scenario}`;
      const item={id,kind:'plugin',displayName:name,summary:'fixture',package:{registry:'npm',name},
        installed:row,upgradeAvailable:scenario==='upgrade',latestVersion:'2.0.0'};
      const{ui,calls}=await mountPage(t,{items:[item]});
      const card=ui.find(node=>node.props?.['data-hanamesh-library-item']===id);
      assert(card,`rendered ${id}`);
      assert.deepEqual(buttons(card),[],`protected catalog action ${id}`);
      assert.equal(calls.filter(call=>call.method==='POST').length,0);
    }
  }
});

test('P06-PA02: installed profile rows suppress uninstall for all five names, while ordinary plugin actions remain',async t=>{
  const plugins=[...protectedNames,'dsh-plugin-tether'].map(packageName=>({packageName,state:'installed',version:'1.0.0',kind:'plugin'}));
  const items=[
    {id:'ordinary-new',kind:'plugin',displayName:'New',summary:'fixture',package:{registry:'npm',name:'ordinary-new'},installed:null,upgradeAvailable:false},
    {id:'ordinary-upgrade',kind:'plugin',displayName:'Upgrade',summary:'fixture',package:{registry:'npm',name:'ordinary-upgrade'},installed:{packageName:'ordinary-upgrade',state:'installed',version:'1.0.0'},upgradeAvailable:true,latestVersion:'2.0.0'},
    {id:'ordinary-installed',kind:'plugin',displayName:'Installed',summary:'fixture',package:{registry:'npm',name:'dsh-plugin-tether'},installed:plugins.at(-1),upgradeAvailable:false},
  ];
  const{ui}=await mountPage(t,{items,plugins});
  for(const name of protectedNames){
    const row=ui.find(node=>node.props?.['data-hanamesh-installed']===name);
    assert(row,`installed row ${name}`);assert.deepEqual(buttons(row),[],`protected installed action ${name}`);
  }
  assert.deepEqual(buttons(ui.find(node=>node.props?.['data-hanamesh-installed']==='dsh-plugin-tether')),['卸载']);
  assert.deepEqual(buttons(ui.find(node=>node.props?.['data-hanamesh-library-item']==='ordinary-new')),['安装']);
  assert.deepEqual(buttons(ui.find(node=>node.props?.['data-hanamesh-library-item']==='ordinary-upgrade')),['升级到 2.0.0']);
  assert.deepEqual(buttons(ui.find(node=>node.props?.['data-hanamesh-library-item']==='ordinary-installed')),['卸载']);
});
