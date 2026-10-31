import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname);
const child=spawn(process.execPath,[resolve(root,'node_modules/wrangler/bin/wrangler.js'),...process.argv.slice(2)],{cwd:root,stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
process.exitCode=await new Promise(done=>child.on('exit',done));
