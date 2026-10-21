import test from 'node:test';
import assert from 'node:assert/strict';
import {clientHarness} from './fixtures/client-ui-harness.mjs';
const fetch=async()=>({ok:true,json:async()=>({items:[],installed:[],plugins:[],categories:[],page:{nextCursor:null},restartRequired:true})});
function text(node){if(Array.isArray(node))return node.map(text).join('');if(node&&typeof node==='object')return text(node.children);return typeof node==='string'?node:'';}
function links(node){if(Array.isArray(node))return node.flatMap(links);if(node&&typeof node==='object')return[...(node.type==='a'?[node]:[]),...links(node.children)];return[];}
for(const framed of [false,true])test(`restart advice is manual with no shell bridge, framed=${framed}`,async()=>{
 const client=await clientHarness({fetch,framed});
 try {const component=client.find(node=>typeof node.type==='function'&&node.type.name==='RestartNotice');assert.ok(component,'pending changes keep their visible restart notice');const notice=component.type(component.props);assert.match(text(notice),/完全退出.*重新打开/);assert.equal(links(notice).length,0,'no executable restart link in either carrier');assert.deepEqual(client.sentMessages,[],'no parent restart request');}finally{client.unmount();}
});
