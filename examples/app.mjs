// A controlled example application. It owns its own data and receives no host SDK.
import { createServer } from 'node:http';
import { writeFile,mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const [port,root,runtimeId]=process.argv.slice(2);await mkdir(root,{recursive:true});
await writeFile(join(root,`example-${runtimeId}.json`),JSON.stringify({pid:process.pid,runtimeId,startedAt:new Date().toISOString()}));
createServer((req,res)=>{
  res.setHeader('content-type','application/json');
  res.end(JSON.stringify(req.url==='/health'?{app:'HANAMESH_APP_HOST_EXAMPLE'}:{example:true,message:'App-host controlled example — not a DSH profile',pid:process.pid,runtimeId}));
}).listen(Number(port),'127.0.0.1');
