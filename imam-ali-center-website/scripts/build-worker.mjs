import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname),assets={};
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.avif':'image/avif','.svg':'image/svg+xml'};
async function walk(path){for(const f of await readdir(resolve(root,'dist',path.replace(/^\//,'')),{withFileTypes:true})){if(['server','.openai','client'].includes(f.name))continue;const key=path+'/'+f.name;if(f.isDirectory())await walk(key);else if(types[extname(key)])assets[key]={data:(await readFile(resolve(root,'dist',key.slice(1)))).toString('base64'),type:types[extname(key)]};}}
const rotationSource=await readFile(resolve(root,'server/photo-rotation.mjs'),'utf8');
await writeFile(resolve(root,'dist/photo-rotation.js'),'(()=>{\n'+rotationSource.replaceAll('export function','function')+'window.IACPhotos={photoWeek,weeklyPhotos};\n})();\n');
await walk('');await mkdir(resolve(root,'dist/server'),{recursive:true});await writeFile(resolve(root,'dist/server/assets.mjs'),'export const assets='+JSON.stringify(assets)+';');await writeFile(resolve(root,'dist/server/index.js'),await readFile(resolve(root,'server/worker.mjs'),'utf8'));await writeFile(resolve(root,'dist/server/gmail-delivery.mjs'),await readFile(resolve(root,'server/gmail-delivery.mjs'),'utf8'));
await writeFile(resolve(root,'dist/server/gmail-script.mjs'),'export const gmailScript='+JSON.stringify(await readFile(resolve(root,'integrations/gmail/Code.gs'),'utf8'))+';');
console.log('Built IAC content worker.');

await writeFile(resolve(root,'dist/server/photo-rotation.mjs'),await readFile(resolve(root,'server/photo-rotation.mjs'),'utf8'));

await writeFile(resolve(root,'dist/server/square-payments.mjs'),await readFile(resolve(root,'server/square-payments.mjs'),'utf8'));
