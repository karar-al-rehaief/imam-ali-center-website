import {emailConfig,callGmail} from './gmail-delivery.mjs';
export const hallFees={ghadeer:{name:'Ghadeer Hall (Main)',amount:125000,capacity:200},small:{name:'Small Hall',amount:25000,capacity:50}};
export const extras={decoration:{name:'Decoration',amount:15000},cleaning:{name:'Cleaning',amount:15000},utensils:{name:'Utensils',amount:10000},kitchen:{name:'Kitchen',amount:50000}};
const enc=new TextEncoder(),dec=new TextDecoder();
const to64=bytes=>btoa(String.fromCharCode(...bytes)),from64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
async function key(env){if(!env.SQUARE_CONFIG_KEY)throw Error('Square setup is not available yet.');return crypto.subtle.importKey('raw',from64(env.SQUARE_CONFIG_KEY),'AES-GCM',false,['encrypt','decrypt']);}
async function seal(env,value){const iv=crypto.getRandomValues(new Uint8Array(12));return {iv:to64(iv),data:to64(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),enc.encode(JSON.stringify(value)))))};}
async function open(env,value){return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(value.iv)},await key(env),from64(value.data))));}
export async function squareConfig(env){if(!env.SQUARE_CONFIG_KEY)return null;const row=await env.DB.prepare('SELECT content FROM site_content WHERE id = ?').bind('square_connection').first();return row?open(env,JSON.parse(row.content)):null;}
async function square(config,path,body){
 let response;try{response=await fetch((config.mode==='sandbox'?'https://connect.squareupsandbox.com':'https://connect.squareup.com')+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${config.accessToken}`,'Square-Version':'2026-09-16','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});}catch{throw Object.assign(Error('Square could not confirm the result. Retry this payment to check its status; do not start another booking.'),{uncertain:true});}
 const result=await response.json();if(!response.ok)throw Object.assign(Error('Square could not process this request. '+(result.errors?.some(e=>['CARD_DECLINED','CVV_FAILURE','ADDRESS_VERIFICATION_FAILURE','INSUFFICIENT_FUNDS','CARD_EXPIRED'].includes(e.code))?'Please check your card or use another card.':'Please try again or call IAC.')),{definite:response.status<500,uncertain:response.status>=500});return result;
}
export async function connectSquare(env,data){
 if(!data||!['production','sandbox'].includes(data.mode)||typeof data.appId!=='string'||data.appId.length>150||typeof data.locationId!=='string'||data.locationId.length>80||typeof data.accessToken!=='string'||data.accessToken.length>1000||!data.accessToken||!data.appId||!data.locationId||data.ratesConfirmed!==true)throw Error('Complete the connection details and confirm the rental rates.');
 if(data.mode==='production'&&!data.appId.startsWith('sq0idp-')||data.mode==='sandbox'&&!data.appId.startsWith('sandbox-sq0idb-'))throw Error('Use the application ID for the selected Square environment.');
 const config={id:crypto.randomUUID(),mode:data.mode,appId:data.appId.trim(),locationId:data.locationId.trim(),accessToken:data.accessToken.trim()};
 const result=await square(config,'/v2/locations');const location=result.locations?.find(l=>l.id===config.locationId);
 if(!location||location.status!=='ACTIVE'||location.currency!=='USD'||!location.capabilities?.includes('CREDIT_CARD_PROCESSING'))throw Error('Choose an active USD location enabled for card payments.');
 config.businessName=location.business_name||location.name;await env.DB.prepare('INSERT INTO site_content (id,content,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at').bind('square_connection',JSON.stringify(await seal(env,config)),new Date().toISOString()).run();return publicSquare(config);
}
export const publicSquare=config=>({connected:!!config,mode:config?.mode||null,appId:config?.appId||null,locationId:config?.locationId||null,businessName:config?.businessName||null,halls:hallFees,extras});
export async function createHallCheckout(env,data,fields){
 const config=await squareConfig(env);if(!config)throw Error('Online payment is not connected yet. You can send a rental request without paying.');
 if(typeof data.checkoutSecret!=='string'||!/^([0-9a-f-]{36}){2}$/i.test(data.checkoutSecret)||data.availabilityConfirmed!==true)throw Error('Confirm your date with IAC before paying.');
 const hall=Object.keys(hallFees).find(k=>hallFees[k].name===fields.topic);if(!hall)throw Error('Choose the main hall or small hall to pay.');
 if(!Array.isArray(data.extras)||data.extras.length>4||new Set(data.extras).size!==data.extras.length||data.extras.some(x=>!Object.hasOwn(extras,x)))throw Error('Check your optional services.');
 const items=[hallFees[hall],...data.extras.map(k=>extras[k])],amount=items.reduce((sum,x)=>sum+x.amount,0),tokenHash=await digest(data.checkoutSecret);
 const payload={fields,items,availabilityConfirmed:true,mode:config.mode};const existing=await env.DB.prepare('SELECT token_hash,payload,amount,status FROM hall_checkouts WHERE id = ?').bind(data.id).first();
 if(existing){if(existing.token_hash!==tokenHash||JSON.stringify(payload)!==existing.payload)throw Error('Start a new rental request to change these details.');return {checkout:true,id:data.id,amount:existing.amount,currency:'USD',items,status:existing.status};}
 await env.DB.prepare('INSERT INTO hall_checkouts(id,token_hash,payload,amount,status,config_id,created_at) VALUES (?,?,?,?,?,?,?)').bind(data.id,tokenHash,JSON.stringify(payload),amount,'open',config.id,new Date().toISOString()).run();
 // Expired, unpaid forms can be removed; payments in progress and completed records are retained.
 await env.DB.prepare("DELETE FROM hall_checkouts WHERE status = 'open' AND created_at < ?").bind(new Date(Date.now()-7*86400000).toISOString()).run();
 return {checkout:true,id:data.id,amount,currency:'USD',items,status:'open'};
}
async function authorizedCheckout(env,data){
 if(typeof data.id!=='string'||data.id.length!==36||typeof data.secret!=='string'||data.secret.length!==72)throw Error('Invalid payment session.');
 const row=await env.DB.prepare('SELECT * FROM hall_checkouts WHERE id = ?').bind(data.id).first();if(!row||row.token_hash!==await digest(data.secret))throw Error('Payment session not found.');return row;
}
const receiptURL=value=>{try{const u=new URL(value);return u.protocol==='https:'&&['squareup.com','www.squareup.com','squareupsandbox.com'].includes(u.hostname)?u.href:null;}catch{return null;}};
async function paymentResult(env,row,config){
 const p=JSON.parse(row.payload);const mail=await emailConfig(env);
 if(!row.notified){
  const fields={...p.fields,'Rental fee':`USD ${(row.amount/100).toFixed(2)}`,'Payment status':config.mode==='sandbox'?'SANDBOX — no real payment':'Paid','Square payment ID':row.payment_id,'Receipt':row.receipt||'','Rental options':p.items.map(x=>x.name).join(', '),'Availability':'Customer confirms IAC has approved the date; payment does not confirm a booking.'};
  if(mail){try{const reply=await callGmail(env,mail.url,{operation:'send',id:row.id,digest:await digest(JSON.stringify(fields)),service:'rent-a-hall',fields,attachments:[]});if(reply.sent){await env.DB.prepare('UPDATE hall_checkouts SET notified = 1, payload = ? WHERE id = ?').bind(JSON.stringify({items:p.items,fields:{},emailed:true,mode:p.mode}),row.id).run();row.notified=1;}}catch{/* Payment remains paid even when email is temporarily unavailable. */}}
  else{await env.DB.prepare('INSERT OR IGNORE INTO service_requests (id,service,payload,payload_hash,status,created_at) VALUES (?,?,?,?,?,?)').bind(row.id,'rent-a-hall',JSON.stringify(fields),await digest(JSON.stringify(fields)),'new',row.created_at).run();await env.DB.prepare('UPDATE hall_checkouts SET notified = 1 WHERE id = ?').bind(row.id).run();row.notified=1;}
 }
 return {paid:true,reference:row.id.slice(0,8).toUpperCase(),amount:row.amount,receipt:receiptURL(row.receipt),mode:config.mode,delivery:row.notified?(mail?'email':'inbox'):'pending'};
}
export async function payHallCheckout(env,data){
 let row=await authorizedCheckout(env,data);const config=await squareConfig(env);
 if(!config||config.id!==row.config_id)throw Error('The Square connection has changed. Contact IAC before continuing this payment.');
 if(row.status==='paid')return paymentResult(env,row,config);
 if(Date.now()-Date.parse(row.created_at)>86400000&&row.status==='open')throw Error('This payment session expired. Start a new rental request.');
 if(row.status==='open'){
  if(typeof data.sourceId!=='string'||!data.sourceId||data.sourceId.length>1000)throw Error('Enter your card details.');
  const attempt=crypto.randomUUID(),source=JSON.stringify(await seal(env,data.sourceId));
  await env.DB.prepare("UPDATE hall_checkouts SET status='paying',attempt=?,source=? WHERE id=? AND status='open'").bind(attempt,source,row.id).run();
  row=await authorizedCheckout(env,data);
 }
 // Every retry of a payment in progress uses its original token and idempotency key.
 if(row.status!=='paying')throw Error('Contact IAC about this payment.');
 if(!row.order_id){
  const payload=JSON.parse(row.payload);let result;
  try{result=await square(config,'/v2/orders',{idempotency_key:row.id,order:{location_id:config.locationId,reference_id:row.id,line_items:payload.items.map(item=>({name:item.name,quantity:'1',base_price_money:{amount:item.amount,currency:'USD'}}))}});}catch(error){if(error.definite)await env.DB.prepare("UPDATE hall_checkouts SET status='open',source=NULL,attempt=NULL WHERE id=? AND attempt=?").bind(row.id,row.attempt).run();throw error;}
  row.order_id=result.order.id;await env.DB.prepare('UPDATE hall_checkouts SET order_id=? WHERE id=?').bind(row.order_id,row.id).run();
 }
 let result;try{result=await square(config,'/v2/payments',{source_id:await open(env,JSON.parse(row.source)),idempotency_key:row.attempt,amount_money:{amount:row.amount,currency:'USD'},autocomplete:true,location_id:config.locationId,order_id:row.order_id,reference_id:row.id,buyer_email_address:JSON.parse(row.payload).fields.email,note:`IAC hall rental ${row.id.slice(0,8).toUpperCase()}`});}catch(error){if(error.definite)await env.DB.prepare("UPDATE hall_checkouts SET status='open',source=NULL,attempt=NULL WHERE id=? AND attempt=?").bind(row.id,row.attempt).run();throw error;}
 const payment=result.payment;
 if(payment?.status!=='COMPLETED'||payment.amount_money?.amount!==row.amount||payment.amount_money?.currency!=='USD'||payment.location_id!==config.locationId)throw Error('Square has not confirmed a completed payment. Retry to check its status or contact IAC.');
 row.status='paid';row.payment_id=payment.id;row.receipt=receiptURL(payment.receipt_url);
 await env.DB.prepare("UPDATE hall_checkouts SET status='paid',payment_id=?,receipt=?,source=NULL WHERE id=?").bind(row.payment_id,row.receipt,row.id).run();return paymentResult(env,row,config);
}
export async function hallCheckoutStatus(env,data){const row=await authorizedCheckout(env,data),config=await squareConfig(env);if(row.status==='paid')return {paid:true,reference:row.id.slice(0,8).toUpperCase(),amount:row.amount,receipt:receiptURL(row.receipt),mode:JSON.parse(row.payload).mode,delivery:row.notified?(await emailConfig(env)?'email':'inbox'):'pending'};if(!config||config.id!==row.config_id)throw Error('Contact IAC before continuing: the payment connection has changed.');return {checkout:true,id:row.id,amount:row.amount,currency:'USD',status:row.status,...JSON.parse(row.payload)};}
