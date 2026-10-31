import {cp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname),source=resolve(root,'../imam-ali-center-website');
await rm(resolve(root,'public'),{recursive:true,force:true});
await cp(resolve(source,'dist'),resolve(root,'public'),{recursive:true,filter:path=>!['server','client','.openai'].includes(path.split('/').at(-1))});
await mkdir(resolve(root,'src/generated'),{recursive:true});
const assets={};
for(const path of ['/content.json','/service-request-appearance.json','/service-form-config.json','/service-request/index.html']){
 const data=await readFile(resolve(root,'public',path.slice(1)));assets[path]={data:data.toString('base64'),type:path.endsWith('.json')?'application/json; charset=utf-8':'text/html; charset=utf-8'};
}
await writeFile(resolve(root,'src/generated/assets.mjs'),'export const assets='+JSON.stringify(assets)+';\n');
let worker=await readFile(resolve(source,'server/worker.mjs'),'utf8');
worker=worker.replace("const OWNER_EMAIL='karara.1237@gmail.com';","const OWNER_EMAIL='iacdmv@gmail.com';");
worker=worker.replace("return Response.redirect(new URL('/signin-with-chatgpt?return_to=%2Fadmin%2F',url.origin),302);","return new Response('Sign in through the configured Cloudflare Access application.',{status:403});");
worker=worker.replace("if(!asset)return new Response('Page not found',{status:404});","if(!asset)return env.ASSETS.fetch(request);");
await writeFile(resolve(root,'src/generated/worker.mjs'),worker);
for(const file of ['square-payments.mjs','gmail-delivery.mjs','photo-rotation.mjs'])await cp(resolve(source,'server',file),resolve(root,'src/generated',file));
await writeFile(resolve(root,'src/generated/gmail-script.mjs'),'export const gmailScript='+JSON.stringify(await readFile(resolve(source,'integrations/gmail/Code.gs'),'utf8'))+';\n');
await cp(resolve(source,'drizzle'),resolve(root,'migrations'),{recursive:true});
await rm(resolve(root,'migrations/meta'),{recursive:true,force:true});
await writeFile(resolve(root,'public/.assetsignore'),'/.assetsignore\n');
console.log('Cloudflare build prepared: static assets separated from server code.');
