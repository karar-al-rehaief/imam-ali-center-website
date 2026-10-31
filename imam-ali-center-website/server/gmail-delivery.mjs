import { gmailScript } from './gmail-script.mjs';
const encoder=new TextEncoder();
const fromHex=value=>Uint8Array.from(value.match(/../g)||[],part=>parseInt(part,16));
const hex=bytes=>Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
export const validGmailUrl=value=>typeof value==='string'&&/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,200}\/exec$/.test(value);
export async function emailConfig(env){const row=await env.DB.prepare('SELECT content FROM site_content WHERE id = ?').bind('email_delivery').first();if(!row)return null;const config=JSON.parse(row.content);return config.enabled&&validGmailUrl(config.url)&&env.GMAIL_BRIDGE_SECRET?config:null;}
export function downloadGmailScript(env){if(!env.GMAIL_BRIDGE_SECRET)throw Error('Mail setup is not available yet.');return gmailScript.replace('__IAC_SHARED_SECRET__',env.GMAIL_BRIDGE_SECRET);}
export async function callGmail(env,url,data){
 if(!validGmailUrl(url)||!env.GMAIL_BRIDGE_SECRET)throw Error('The Gmail connection has not been set up.');
 const key=await crypto.subtle.importKey('raw',encoder.encode(env.GMAIL_BRIDGE_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
 const payload=JSON.stringify({...data,timestamp:Date.now()}),signature=hex(await crypto.subtle.sign('HMAC',key,encoder.encode(payload)));
 let result;
 try{const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({payload,signature}),signal:AbortSignal.timeout(55000)});if(!response.ok)throw Error();result=await response.json();}
 catch{throw Error('Gmail could not confirm delivery. Your form is still here. Please call IAC and quote your request reference before resending.');}
 if(typeof result.payload!=='string'||result.payload.length>4000||typeof result.signature!=='string'||!/^[0-9a-f]{64}$/.test(result.signature)||!await crypto.subtle.verify('HMAC',key,fromHex(result.signature),encoder.encode(result.payload)))throw Error('The Gmail connection did not return a valid confirmation. Please contact IAC.');
 const reply=JSON.parse(result.payload);if(!reply.ok)throw Error(reply.error||'Gmail could not confirm delivery.');return reply;
}
export const encodeAttachment=buffer=>{const bytes=new Uint8Array(buffer);let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(text);};
