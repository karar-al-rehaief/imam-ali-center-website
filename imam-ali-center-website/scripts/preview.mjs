import http from 'node:http';
import{spawnSync}from'node:child_process';
import{readFileSync,mkdirSync}from'node:fs';
import{resolve}from'node:path';
import worker from '../dist/server/index.js';
const root=resolve(new URL('..',import.meta.url).pathname);mkdirSync(resolve(root,'.local'),{recursive:true});
const dbPath=resolve(root,'.local/preview.sqlite');
const python=`import sys,json,sqlite3\na=json.load(sys.stdin)\nc=sqlite3.connect(a['path']);c.row_factory=sqlite3.Row\nif a.get('script'):c.executescript(a['script']);res=[]\nelse:\n cur=c.execute(a['sql'],a['params']);res=[dict(r) for r in cur.fetchall()] if cur.description else []\nc.commit();print(json.dumps(res))`;
const query=data=>{const r=spawnSync('python3',['-c',python],{input:JSON.stringify({path:dbPath,...data}),encoding:'utf8'});if(r.status)throw Error(r.stderr);return JSON.parse(r.stdout);};
query({script:readFileSync(resolve(root,'drizzle/0001_content.sql'),'utf8')});
if(query({sql:'PRAGMA user_version',params:[]})[0].user_version < 2){
 if(!query({sql:"SELECT name FROM sqlite_master WHERE name = 'service_requests'",params:[]}).length)query({script:readFileSync(resolve(root,'drizzle/0002_service_requests.sql'),'utf8')});
 query({script:'PRAGMA user_version = 2;'});
}
if(query({sql:'PRAGMA user_version',params:[]})[0].user_version < 3){
 query({script:readFileSync(resolve(root,'drizzle/0003_hall_checkout.sql'),'utf8')});query({script:'PRAGMA user_version = 3;'});
}
const DB={prepare(sql){let params=[];const stmt={bind(...args){params=args;return stmt;},async first(){return query({sql,params})[0]||null;},async run(){return query({sql,params});},async all(){return {results:query({sql,params})};}};return stmt;},async batch(stmts){return Promise.all(stmts.map(s=>s.run()));}};
const uploads=new Map();const BUCKET={async delete(key){uploads.delete(key);},async put(key,bytes,opts){uploads.set(key,{bytes,type:opts.httpMetadata.contentType});},async get(key){const item=uploads.get(key);return item?{body:item.bytes,writeHttpMetadata(headers){headers.set('content-type',item.type);}}:null;}};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1:8766');const chunks=[];for await(const chunk of req)chunks.push(chunk);const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id','local-owner');headers.set('oai-authenticated-user-email','karara.1237@gmail.com');headers.set('cf-connecting-ip','127.0.0.1');const request=new Request(url,{method:req.method,headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})});const result=await worker.fetch(request,{DB,BUCKET},{waitUntil(p){p.catch(console.error);}});res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));}catch(e){console.error(e);res.writeHead(500);res.end('Preview unavailable');}}).listen(8766,'127.0.0.1',()=>console.log('IAC preview ready at http://127.0.0.1:8766/'));
