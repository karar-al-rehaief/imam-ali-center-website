import site from './generated/worker.mjs';
const encoder=new TextEncoder();
let signingKeys=null;
const decode=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const read=value=>JSON.parse(new TextDecoder().decode(decode(value)));
async function accessIdentity(request,env){
 const domain=env.CF_ACCESS_TEAM_DOMAIN,audience=env.CF_ACCESS_AUD;
 if(!domain||!audience||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain))return null;
 const token=request.headers.get('Cf-Access-Jwt-Assertion');
 if(!token||token.length>16000)return null;
 try{
  const parts=token.split('.');if(parts.length!==3)return null;
  const header=read(parts[0]),claims=read(parts[1]),now=Math.floor(Date.now()/1000);
  if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>300||claims.iss!==domain||typeof claims.sub!=='string'||!claims.sub||!Array.isArray(claims.aud)||!claims.aud.includes(audience)||!Number.isFinite(claims.exp)||claims.exp<=now||!Number.isFinite(claims.iat)||claims.iat>now+60||claims.nbf&&claims.nbf>now+60||typeof claims.email!=='string'||claims.email.toLowerCase()!=='iacdmv@gmail.com')return null;
  if(!signingKeys||signingKeys.domain!==domain||signingKeys.expires<Date.now()||!signingKeys.keys.some(k=>k.kid===header.kid)){
   const response=await fetch(domain+'/cdn-cgi/access/certs',{signal:AbortSignal.timeout(10000)});if(!response.ok)return null;
   const json=await response.json();if(!Array.isArray(json.keys))return null;
   signingKeys={domain,keys:json.keys,expires:Date.now()+3600000};
  }
  const jwk=signingKeys.keys.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!jwk)return null;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),encoder.encode(parts[0]+'.'+parts[1])))return null;
  return {id:claims.sub,email:claims.email};
 }catch{return null;}
}
export default {async fetch(request,env,ctx){
 const url=new URL(request.url),path=url.pathname,headers=new Headers(request.headers);
 if(request.method==='POST'&&['/api/service-requests','/api/hall-checkout/pay'].includes(path)&&(!env.BUCKET||!env.CF_ACCESS_AUD||!env.CF_ACCESS_TEAM_DOMAIN))return Response.json({error:'This preview is not accepting requests yet. Please contact IAC at (571) 444-3578.'},{status:503,headers:{'cache-control':'no-store'}});
 for(const name of Array.from(headers.keys()))if(name.startsWith('oai-authenticated-'))headers.delete(name);
 if(path==='/admin'||path.startsWith('/admin/')||path.startsWith('/api/admin/')){
  if(!env.CF_ACCESS_TEAM_DOMAIN||!env.CF_ACCESS_AUD)return new Response('Admin sign-in is being configured. The public website remains available.',{status:503,headers:{'cache-control':'no-store'}});
  const identity=await accessIdentity(request,env);
  if(!identity)return new Response('Sign in with the authorized IAC account through Cloudflare Access.',{status:403,headers:{'cache-control':'no-store'}});
  headers.set('oai-authenticated-user-id',identity.id);headers.set('oai-authenticated-user-email',identity.email);
 }
 return site.fetch(new Request(request,{headers}),env,ctx);
}};
