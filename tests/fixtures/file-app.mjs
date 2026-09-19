import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
const args=Object.fromEntries(process.argv.slice(2).map(arg=>arg.split('=',2)));
createServer(async(req,res)=>{
  if(req.url==='/health')return res.end('AK_FILE_READY');
  if(req.url==='/file'){res.setHeader('content-type','application/json');return res.end(JSON.stringify({value:await readFile(join(args.data,'auth','test.json'),'utf8').catch(()=>null)}));}
  res.end('AK_FILE_READY');
}).listen(Number(args.port),'127.0.0.1');
