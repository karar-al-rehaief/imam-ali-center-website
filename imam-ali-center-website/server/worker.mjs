import {extras as rentalExtras,squareConfig,publicSquare,connectSquare,createHallCheckout,payHallCheckout,hallCheckoutStatus} from './square-payments.mjs';
import {weeklyPhotos} from './photo-rotation.mjs';
import { emailConfig, validGmailUrl, downloadGmailScript, callGmail, encodeAttachment } from './gmail-delivery.mjs';
import { assets } from './assets.mjs';
const OWNER_EMAIL='karara.1237@gmail.com';
const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});
const owner=r=>Boolean(r.headers.get('oai-authenticated-user-id'))&&r.headers.get('oai-authenticated-user-email')?.toLowerCase()===OWNER_EMAIL;
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const hash=s=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)).then(hex);
const defaults=assets['/content.json']?JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(assets['/content.json'].data),c=>c.charCodeAt(0)))):{};
const getContent=async env=>{const row=await env.DB.prepare('SELECT content FROM site_content WHERE id = ?').bind('homepage').first();const content=row?JSON.parse(row.content):defaults;
 // Migrate the earlier Instagram/editorial default library to approved Facebook photos.
 const oldHeroImages=new Set(['/assets/iac-community-gathering.jpg','/assets/iac-community-recitation.jpg','/assets/iac-community-youth.jpg','/assets/community-reading.jpg','/assets/community-hall.jpg','/assets/quran-study.webp','/assets/iac-eid-community.jpg','/assets/iac-eid-prayer.jpg','/assets/iac-eid-gathering.jpg','/assets/iac-eid-extra-1.jpg','/assets/iac-eid-extra-2.jpg','/assets/iac-eid-extra-3.jpg','/assets/iac-ghadeer-1.jpg','/assets/iac-ghadeer-2.jpg','/assets/iac-ghadeer-3.jpg','/assets/iac-ghadeer-4.jpg']);
 if(content.slides.every(slide=>oldHeroImages.has(slide.image)))content.slides=defaults.slides;
 else content.slides=content.slides.map((slide,i)=>oldHeroImages.has(slide.image)?defaults.slides[i%defaults.slides.length]:slide);
 const oldEducationImages=["/assets/quran-study.webp", "/assets/community-reading.jpg", "/assets/programs.webp", "/assets/community-gathering.jpg", "/assets/community-hall.jpg", "/assets/imam-sadiq-learning.jpg", "/assets/iac-saturday-students.avif", "/assets/scholar.jpg", "/assets/iac-quran-circle.jpg", "/assets/guide-academy-logo.jpg", "/assets/iac-youth-bonfire.jpg"];
 if(content.education.length===6)content.education.splice(3,1);
 content.education=content.education.map((item,i)=>oldEducationImages.includes(item.image)||item.image==="/assets/iac-student-circle.jpg"?defaults.education[i]:item);
 const destination={'/#about':'/about/','/#resources':'/business-directory/','/#community':'/staff/'};
 content.slides=content.slides.map(slide=>({...slide,primary:[slide.primary[0],destination[slide.primary[1]]||slide.primary[1]],secondary:[slide.secondary[0],destination[slide.secondary[1]]||slide.secondary[1]]}));
 return content;};
const requestAppearance=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(assets['/service-request-appearance.json'].data),c=>c.charCodeAt(0))));
const formConfig=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(assets['/service-form-config.json'].data),c=>c.charCodeAt(0))));
let randomPool=new Uint32Array(1024),randomIndex=1024;
const rnd=n=>{if(randomIndex===randomPool.length){crypto.getRandomValues(randomPool);randomIndex=0;}return randomPool[randomIndex++]%n;};
const glyphs={A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],H:['10001','10001','10001','11111','10001','10001','10001'],J:['00111','00010','00010','00010','10010','10010','01100'],K:['10001','10010','10100','11000','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],P:['11110','10001','10001','11110','10000','10000','10000'],R:['11110','10001','10001','11110','10100','10010','10001'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],W:['10001','10001','10001','10101','10101','10101','01010'],Y:['10001','10001','01010','00100','00100','00100','00100'],2:['01110','10001','00001','00010','00100','01000','11111'],3:['11110','00001','00001','01110','00001','00001','11110'],4:['00010','00110','01010','10010','11111','00010','00010'],5:['11111','10000','10000','11110','00001','00001','11110'],6:['01110','10000','10000','11110','10001','10001','01110'],7:['11111','00001','00010','00100','01000','01000','01000'],8:['01110','10001','10001','01110','10001','10001','01110'],9:['01110','10001','10001','01111','00001','00001','01110']};
function captchaBitmap(text){
 const w=220,h=72,row=Math.ceil(w*3/4)*4,size=54+row*h,b=new Uint8Array(size),v=new DataView(b.buffer);
 b[0]=66;b[1]=77;v.setUint32(2,size,true);v.setUint32(10,54,true);v.setUint32(14,40,true);v.setInt32(18,w,true);v.setInt32(22,h,true);v.setUint16(26,1,true);v.setUint16(28,24,true);
 const dot=(x,y,c)=>{if(x<0||y<0||x>=w||y>=h)return;const o=54+(h-y-1)*row+x*3;b[o]=c[2];b[o+1]=c[1];b[o+2]=c[0];};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)dot(x,y,[240+rnd(15),242+rnd(13),237+rnd(15)]);
 for(let n=0;n<900;n++)dot(rnd(w),rnd(h),[130+rnd(80),160+rnd(65),135+rnd(80)]);
 [...text].forEach((letter,i)=>{const y0=13+rnd(12),x0=14+i*40+rnd(6);glyphs[letter].forEach((r,y)=>[...r].forEach((a,x)=>{if(a==='1')for(let yy=0;yy<5;yy++)for(let xx=0;xx<5;xx++)dot(x0+x*5+xx+Math.round(Math.sin(y)*2),y0+y*5+yy,[20+rnd(10),55+rnd(15),40+rnd(15)]);}));});
 for(let n=0;n<3;n++){const offset=rnd(h);for(let x=0;x<w;x++)dot(x,(offset+Math.round(Math.sin(x/23+n)*8))%h,[105,142,119]);}
 return b;
}
function validContent(c){
 if(!c||!Array.isArray(c.slides)||c.slides.length<1||c.slides.length>10||!Array.isArray(c.education)||c.education.length!==5) return false;
 if(c.bookings!==undefined){if(!c.bookings||typeof c.bookings!=='object'||Array.isArray(c.bookings)||Object.keys(c.bookings).length>30)return false;for(const [key,value] of Object.entries(c.bookings)){if(!/^[a-z0-9-]{1,60}$/.test(key)||typeof value!=='string'||value.length>500)return false;if(value){try{const b=new URL(value);if(b.protocol!=='https:'||b.hostname!=='koalendar.com'||!/^\/e\/[^/]+\/?$/.test(b.pathname)||b.username||b.password||b.search||b.hash)return false;}catch{return false;}}}}
 const url=u=>typeof u==='string'&&(u.startsWith('/')&&!u.startsWith('//')||/^https:\/\//.test(u));
 return c.slides.every(s=>['kicker','title','description'].every(k=>typeof s[k]==='string'&&s[k].length<=1000&&!/[<>]/.test(s[k]))&&url(s.image)&&Array.isArray(s.primary)&&Array.isArray(s.secondary)&&[s.primary,s.secondary].every(a=>a.length===2&&typeof a[0]==='string'&&a[0].length<=100&&url(a[1]))&&typeof s.position==='string'&&typeof s.mobilePosition==='string')&&c.education.every(s=>url(s.image)&&typeof s.alt==='string'&&s.alt.length<300)&&Array.isArray(c.shorts)&&c.shorts.length>=4&&c.shorts.length<=100&&c.shorts.every(s=>/^[a-zA-Z0-9_-]{11}$/.test(s));
}
export default {async fetch(request,env,ctx){
 const url=new URL(request.url),path=url.pathname;
 if(/^\/(?:aim|aime)(?:\/|$)/i.test(path))return new Response('This page is no longer available.',{status:410,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
 try{
 if(path==='/service-request/'&&url.searchParams.get('service')==='rent-a-hall'&&request.method==='GET')return Response.redirect(new URL('/hall-rental/#rental-form',url.origin),302);
 if(path.startsWith('/api/admin/')||path.startsWith('/admin/')||path==='/admin'){
  if(!owner(request)){
   if(path.startsWith('/api/'))return json({error:'Sign in with the site owner account to edit content.'},403);
   if(!request.headers.get('oai-authenticated-user-id')) return Response.redirect(new URL('/signin-with-chatgpt?return_to=%2Fadmin%2F',url.origin),302);
   return new Response('This admin area is restricted to the site owner.',{status:403});
  }
  if(request.method!=='GET'&&request.headers.get('origin')!==url.origin)return json({error:'Invalid request origin.'},403);
  if(path==='/api/admin/square'&&request.method==='GET')return json({...publicSquare(await squareConfig(env)),setupReady:!!env.SQUARE_CONFIG_KEY});
  if(path==='/api/admin/square'&&request.method==='PUT'){
   const body=await request.text();if(body.length>2500)return json({error:'Invalid connection.'},400);
   try{return json(await connectSquare(env,JSON.parse(body)));}catch(error){return json({error:error.message},400);}
  }
  if(path==='/api/admin/hall-payments'&&request.method==='GET'){
   const rows=await env.DB.prepare('SELECT id,amount,status,payment_id,receipt,notified,created_at,payload FROM hall_checkouts ORDER BY created_at DESC LIMIT 100').all();return json({payments:rows.results.map(({payload,...row})=>({...row,mode:JSON.parse(payload).mode}))});
  }
  if(path==='/api/admin/email-script'&&request.method==='GET')return new Response(downloadGmailScript(env),{headers:{'content-type':'text/plain; charset=utf-8','content-disposition':'attachment; filename="IAC-Gmail.gs"','cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(path==='/api/admin/email-delivery'&&request.method==='GET'){const config=await emailConfig(env);return json({connected:!!config,url:config?.url||'',recipient:'iacdmv@gmail.com',setupReady:!!env.GMAIL_BRIDGE_SECRET});}
  if(path==='/api/admin/email-delivery'&&request.method==='PUT'){
   const body=await request.text();if(body.length>1000)return json({error:'Invalid connection.'},400);const data=JSON.parse(body);
   if(!validGmailUrl(data.url))return json({error:'Paste the Google Apps Script Web app URL ending in /exec.'},400);
   try{const reply=await callGmail(env,data.url,{operation:'status'});if(reply.recipient!=='iacdmv@gmail.com')throw Error('The connection must belong to iacdmv@gmail.com.');}
   catch(error){return json({error:error.message},400);}
   await env.DB.prepare('INSERT INTO site_content (id,content,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at').bind('email_delivery',JSON.stringify({url:data.url,enabled:true}),new Date().toISOString()).run();return json({connected:true,recipient:'iacdmv@gmail.com'});
  }
  if(path==='/api/admin/request-document'&&request.method==='GET'){
   const row=await env.DB.prepare('SELECT payload FROM service_requests WHERE id = ?').bind(url.searchParams.get('request')).first();
   const document=row?JSON.parse(row.payload)._attachments?.find(file=>file.id===url.searchParams.get('file')):null;
   if(!document)return new Response('Document not found',{status:404});
   const item=await env.BUCKET.get(document.key);if(!item)return new Response('Document unavailable',{status:404});
   const headers=new Headers({'content-type':document.type,'cache-control':'no-store','x-content-type-options':'nosniff','content-disposition':`attachment; filename="document.${document.type==='application/pdf'?'pdf':document.type==='image/jpeg'?'jpg':document.type==='image/png'?'png':'webp'}"`,'content-security-policy':"sandbox; default-src 'none'"});
   return new Response(item.body,{headers});
  }
  if(path==='/api/admin/requests'&&request.method==='GET'){
   const rows=await env.DB.prepare('SELECT id,service,payload,status,created_at FROM service_requests ORDER BY created_at DESC LIMIT 100').all();
   return json({requests:rows.results.map(row=>({...row,fields:JSON.parse(row.payload),payload:undefined}))});
  }
  if(path==='/api/admin/requests'&&request.method==='PUT'){
   const text=await request.text();if(text.length>500)return json({error:'Invalid request.'},400);
   const data=JSON.parse(text);if(typeof data.id!=='string'||data.id.length>40||!['new','reviewed','closed'].includes(data.status))return json({error:'Invalid request status.'},400);
   await env.DB.prepare('UPDATE service_requests SET status = ? WHERE id = ?').bind(data.status,data.id).run();return json({saved:true});
  }
  if(path==='/api/admin/content'&&request.method==='GET')return json(await getContent(env));
  if(path==='/api/admin/content'&&request.method==='PUT'){
   if(Number(request.headers.get('content-length'))>50000)return json({error:'Content is too large.'},413);
   const body=await request.text();if(body.length>50000)return json({error:'Content is too large.'},413);
   const data=JSON.parse(body);if(!validContent(data))return json({error:'Check slide fields, image paths, and at least four valid YouTube video IDs.'},400);
   await env.DB.prepare('INSERT INTO site_content (id, content, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET content=excluded.content, updated_at=excluded.updated_at').bind('homepage',JSON.stringify(data),new Date().toISOString()).run();return json({saved:true});
  }
  if(path==='/api/admin/upload'&&request.method==='POST'){
   if(Number(request.headers.get('content-length'))>5*1024*1024)return json({error:'Choose an image under 5 MB.'},413);
   const b=await request.arrayBuffer();if(b.byteLength>5*1024*1024)return json({error:'Choose an image under 5 MB.'},413);
   const a=new Uint8Array(b);let type,ext;
   if(a[0]===255&&a[1]===216&&a[2]===255){type='image/jpeg';ext='jpg';}
   else if(a[0]===137&&a[1]===80&&a[2]===78&&a[3]===71){type='image/png';ext='png';}
   else if(String.fromCharCode(...a.slice(0,4))==='RIFF'&&String.fromCharCode(...a.slice(8,12))==='WEBP'){type='image/webp';ext='webp';}
   else return json({error:'Use a JPEG, PNG, or WebP image.'},400);
   const key='images/'+crypto.randomUUID()+'.'+ext;await env.BUCKET.put(key,b,{httpMetadata:{contentType:type}});return json({url:'/uploads/'+key});
  }
 }
 if(path==='/api/hall-checkout/config'&&request.method==='GET')return json(publicSquare(await squareConfig(env)));
 if(['/api/hall-checkout/pay','/api/hall-checkout/status'].includes(path)&&request.method==='POST'){
  if(request.headers.get('origin')!==url.origin)return json({error:'Invalid request origin.'},403);
  const text=await request.text();if(text.length>2500)return json({error:'Invalid payment request.'},400);
  try{return json(await (path.endsWith('/status')?hallCheckoutStatus:payHallCheckout)(env,JSON.parse(text)));}catch(error){return json({error:error.message,retry:!!error.uncertain},error.uncertain?503:400);}
 }
 if(path==='/api/service-delivery'&&request.method==='GET')return json({mode:await emailConfig(env)?'email':'inbox',recipient:'iacdmv@gmail.com'});
 if(path==='/api/service-requests'&&request.method==='POST'){
  if(request.headers.get('origin')!==url.origin)return json({error:'Invalid request origin.'},403);
  const maximum=12*1024*1024;
  if(Number(request.headers.get('content-length'))>maximum)return json({error:'Files must total 10 MB or less.'},413);
  const reader=request.body?.getReader();if(!reader)return json({error:'Invalid request.'},400);
  const chunks=[];let length=0;while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>maximum){await reader.cancel();return json({error:'Files must total 10 MB or less.'},413);}chunks.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let data,uploads=[];
  try{
   if(request.headers.get('content-type')?.startsWith('multipart/form-data')){
    const form=await new Response(bytes,{headers:{'content-type':request.headers.get('content-type')}}).formData(),metadata=form.get('request');
    if(typeof metadata!=='string'||metadata.length>16000)return json({error:'Please shorten your request.'},413);
    data=JSON.parse(metadata);
    for(const [key,value] of form){if(key==='request')continue;if(!(value instanceof File)||!value.size)continue;uploads.push({field:key.replace(/^document:/,''),file:value});}
   }else{if(length>16000)return json({error:'Please shorten your request.'},413);data=JSON.parse(new TextDecoder().decode(bytes));}
  }catch{return json({error:'Invalid request. Please refresh the form.'},400);}
  if(!data||!Object.hasOwn(formConfig,data.service)||!data.fields||typeof data.fields!=='object'||Array.isArray(data.fields)||typeof data.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.id))return json({error:'Choose a service and complete the form.'},400);
  const config=formConfig[data.service],details=!config.detailTopics||config.detailTopics.includes(data.fields.topic);
  const questions=details?config.questions.filter(q=>!q.showIf||data.fields[q.showIf.field]===q.showIf.value):[];
  const fields={},limits={name:120,email:254,phone:40,topic:100,date:10,professional:120,message:2000};
  for(const q of questions){if(q.type!=='file')limits[q.name]=q.max||254;}
  for(const [key,max] of Object.entries(limits)){if(data.fields[key]!==undefined){if(typeof data.fields[key]!=='string'||data.fields[key].length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(data.fields[key]))return json({error:'Please check your form fields.'},400);fields[key]=data.fields[key].trim();}}
  const emailValid=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if(!fields.name||!fields.phone||!emailValid(fields.email||'')||data.consent!==true)return json({error:'Enter your name, email, phone number, and consent.'},400);
  if(config.topics.length&&!config.topics.includes(fields.topic))return json({error:'Choose the type of support you need.'},400);
  for(const q of questions){if(q.type==='file')continue;const value=fields[q.name];if(q.required&&!value)return json({error:`Please complete: ${q.label}`},400);if(!value)continue;
   if(q.type==='select'&&!q.options.includes(value)||q.type==='email'&&!emailValid(value)||q.type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value)))||q.type==='time'&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)||q.type==='number'&&(!/^\d+$/.test(value)||Number(value)<q.min||Number(value)>q.maxValue))return json({error:`Please check: ${q.label}`},400);
  }
  if(fields.date&&!/^\d{4}-\d{2}-\d{2}$/.test(fields.date))return json({error:'Please check your preferred date.'},400);
  if(data.service==='religious-question'&&!fields.message)return json({error:'Please enter your question.'},400);
  if(data.service==='rent-a-hall'){
   if(data.extras!==undefined){if(!Array.isArray(data.extras)||data.extras.length>4||new Set(data.extras).size!==data.extras.length||data.extras.some(x=>!Object.hasOwn(rentalExtras,x)))return json({error:'Check your optional services.'},400);fields.rentalExtras=data.extras.map(x=>rentalExtras[x].name).join(', ');}
   if(fields.eventLastDay<fields.eventFirstDay||fields.eventLastDay===fields.eventFirstDay&&fields.eventEndTime<=fields.eventStartTime)return json({error:'The event must end after it starts.'},400);
   if(fields.topic==='Small Hall'&&Number(fields.attendees)>50)return json({error:'Small Hall has 50 chair spaces. Choose Ghadeer Hall or discuss your requirements with IAC.'},400);
  }
  let total=0;const fileCounts={},documents=[];
  if(uploads.length>10)return json({error:'Upload at most 10 files.'},400);
  for(const {field,file} of uploads){
   const question=questions.find(q=>q.type==='file'&&q.name===field);if(!question)return json({error:'This document does not belong to the selected service.'},400);
   fileCounts[field]=(fileCounts[field]||0)+1;total+=file.size;if(file.size>5*1024*1024||fileCounts[field]>2||total>10*1024*1024)return json({error:'Use at most two files per document question, 5 MB each and 10 MB total.'},413);
   const buffer=await file.arrayBuffer(),a=new Uint8Array(buffer);let type,ext;
   if(new TextDecoder().decode(a.slice(0,5))==='%PDF-'){type='application/pdf';ext='pdf';}
   else if(a[0]===255&&a[1]===216&&a[2]===255){type='image/jpeg';ext='jpg';}
   else if(a[0]===137&&a[1]===80&&a[2]===78&&a[3]===71){type='image/png';ext='png';}
   else if(new TextDecoder().decode(a.slice(0,4))==='RIFF'&&new TextDecoder().decode(a.slice(8,12))==='WEBP'){type='image/webp';ext='webp';}
   else return json({error:'Documents must be PDF, JPG, PNG, or WebP files.'},400);
   documents.push({field,label:question.label,name:file.name.slice(0,180).replace(/[\u0000-\u001f]/g,''),size:file.size,type,ext,buffer,digest:hex(await crypto.subtle.digest('SHA-256',buffer))});
  }
  for(const [status,document] of [['legalMarriageStatus','legalMarriage'],['legalDivorceStatus','legalDivorce']]){if(fields[status]==='Yes, attached below'&&!documents.some(d=>d.field===document))return json({error:'Attach the document you indicated, or choose to provide it directly.'},400);}
  const payloadHash=await hash(data.service+JSON.stringify(fields)+(documents.length?JSON.stringify(documents.map(({field,name,digest})=>({field,name,digest}))):''));
  const mail=await emailConfig(env);
  const existing=data.checkout||mail?null:await env.DB.prepare('SELECT payload_hash FROM service_requests WHERE id = ?').bind(data.id).first();
  if(existing){if(existing.payload_hash!==payloadHash)return json({error:'This request was already received. Refresh the form to send a different request.'},409);return json({received:true,delivery:'inbox',reference:data.id.slice(0,8).toUpperCase()});}
  if(typeof data.captchaId!=='string'||typeof data.captchaAnswer!=='string'||data.captchaAnswer.length>10)return json({error:'Enter the verification code.'},400);
  const challenge=await env.DB.prepare('DELETE FROM captchas WHERE id = ? RETURNING answer_hash, expires').bind(data.captchaId).first();
  if(!challenge||challenge.expires<Date.now()||challenge.answer_hash!==await hash(data.captchaId+data.captchaAnswer.toUpperCase().replace(/\s/g,'')))return json({error:'The verification code was incorrect or expired. Please try the new image.'},400);
  const hour=Math.floor(Date.now()/3600000),ip=await hash(request.headers.get('cf-connecting-ip')||'unknown');
  const count=await env.DB.prepare('INSERT INTO service_request_limits (ip,hour,count) VALUES (?,?,1) ON CONFLICT(ip,hour) DO UPDATE SET count=count+1 RETURNING count').bind(ip,hour).first();
  if(count.count>8)return json({error:'Too many requests. Please call (571) 444-3578 for assistance.'},429);
  if(data.checkout){
   if(data.service!=='rent-a-hall')return json({error:'Only hall rentals support payment.'},400);
   try{return json(await createHallCheckout(env,data,fields),201);}catch(error){return json({error:error.message},400);}
  }
  if(mail){
   try{const reply=await callGmail(env,mail.url,{operation:'send',id:data.id,digest:payloadHash,service:data.service,fields,attachments:documents.map(document=>({name:document.name,type:document.type,data:encodeAttachment(document.buffer)}))});
    if(!reply.sent)throw Error('Gmail did not confirm sending. Please contact IAC.');
    return json({received:true,delivery:'email',reference:reply.reference},201);
   }catch(error){return json({error:error.message+` Reference: ${data.id.slice(0,8).toUpperCase()}.`},503);}
  }
  const attachments=[];
  try{
   for(const document of documents){const id=crypto.randomUUID(),key=`request-documents/${data.id}/${id}.${document.ext}`;attachments.push({id,key,name:document.name,label:document.label,type:document.type,size:document.size});await env.BUCKET.put(key,document.buffer,{httpMetadata:{contentType:document.type}});}
   if(attachments.length)fields._attachments=attachments;
   await env.DB.prepare('INSERT INTO service_requests (id,service,payload,payload_hash,status,created_at) VALUES (?,?,?,?,?,?)').bind(data.id,data.service,JSON.stringify(fields),payloadHash,'new',new Date().toISOString()).run();
  }catch(error){ctx.waitUntil(Promise.all(attachments.map(a=>env.BUCKET.delete(a.key))));throw error;}
  ctx.waitUntil(env.DB.prepare('DELETE FROM service_request_limits WHERE hour < ?').bind(hour-1).run());
  return json({received:true,delivery:'inbox',reference:data.id.slice(0,8).toUpperCase()},201);
 }
 if(path==='/api/site-time'&&request.method==='GET')return json({epochMs:Date.now(),timeZone:'America/New_York'});
 if(path==='/api/content'&&request.method==='GET'){const content=await getContent(env);return json({...content,slides:weeklyPhotos(content.slides)});}
 if(path.startsWith('/uploads/')&&request.method==='GET'){
  if(!path.startsWith('/uploads/images/'))return new Response('Not found',{status:404});
  const item=await env.BUCKET.get(path.slice(9));if(!item)return new Response('Image not found',{status:404});const headers=new Headers();item.writeHttpMetadata(headers);headers.set('cache-control','public,max-age=31536000,immutable');headers.set('x-content-type-options','nosniff');return new Response(item.body,{headers});
 }
 if(path==='/api/captcha'&&request.method==='GET'){
  const now=Date.now(),hour=Math.floor(now/3600000),ip=await hash(request.headers.get('cf-connecting-ip')||'unknown');
  const row=await env.DB.prepare('INSERT INTO captcha_limits (ip,hour,count) VALUES (?,?,1) ON CONFLICT(ip,hour) DO UPDATE SET count=count+1 RETURNING count').bind(ip,hour).first();
  if(row.count>40)return json({error:'Too many verification requests. Please try again later or call the Center.'},429);
  const letters=Object.keys(glyphs),answer=Array.from({length:5},()=>letters[rnd(letters.length)]).join(''),id=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO captchas (id,answer_hash,expires) VALUES (?,?,?)').bind(id,await hash(id+answer),now+300000).run();
  ctx.waitUntil(env.DB.batch([env.DB.prepare('DELETE FROM captchas WHERE expires < ?').bind(now),env.DB.prepare('DELETE FROM captcha_limits WHERE hour < ?').bind(hour-1)]));
  const bytes=captchaBitmap(answer);return json({id,image:'data:image/bmp;base64,'+btoa(String.fromCharCode(...bytes))});
 }
 if(path==='/api/captcha/verify'&&request.method==='POST'){
  if(request.headers.get('origin')!==url.origin)return json({error:'Invalid request origin.'},403);
  if(Number(request.headers.get('content-length'))>1000)return json({error:'Invalid verification.'},400);
  const text=await request.text();if(text.length>1000)return json({error:'Invalid verification.'},400);const data=JSON.parse(text);
  if(typeof data.id!=='string'||typeof data.answer!=='string'||data.answer.length>10)return json({error:'Enter the five characters from the image.'},400);
  const row=await env.DB.prepare('DELETE FROM captchas WHERE id = ? RETURNING answer_hash, expires').bind(data.id).first();
  if(!row||row.expires<Date.now()||row.answer_hash!==await hash(data.id+data.answer.toUpperCase().replace(/\s/g,'')))return json({error:'The code was incorrect or expired. Please try the new image.'},400);
  return json({verified:true});
 }
 const key=path.endsWith('/')?path+'index.html':path;const asset=assets[key]||assets[path+'/index.html'];
 if(!asset)return new Response('Page not found',{status:404});
 let bytes=Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));
 if(path==='/service-request/'||path==='/service-request'){
  const service=url.searchParams.get('service'),appearance=Object.hasOwn(requestAppearance,service)?requestAppearance[service]:requestAppearance.default;
  const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  let html=new TextDecoder().decode(bytes);
  html=html.replace(/(<section class="interior-hero interior-hero-service-request" style=")[^"]*/,`$1--interior-image:url('${appearance.image}');--request-image-position:${appearance.position}`)
   .replace(/<title>[^<]*<\/title>/,`<title>${escape(appearance.heading)} | Imam Ali Center</title>`)
   .replace(/(<h1 id="request-page-title">)[\s\S]*?<\/h1>/,`$1${escape(appearance.heading)}</h1>`)
   .replace(/(<p id="request-page-lead">)[\s\S]*?<\/p>/,`$1${escape(appearance.lead)}</p>`)
   .replace(/(<span class="eyebrow interior-eyebrow" id="request-page-eyebrow">)[\s\S]*?<\/span>[^<]*<\/span>/,`$1<span></span>${escape(appearance.eyebrow)}</span>`)
   .replace(/(<span id="request-page-breadcrumb">)[\s\S]*?<\/span>/,`$1${escape(appearance.heading)}</span>`);
  bytes=new TextEncoder().encode(html);
 }
 return new Response(bytes,{headers:{'content-type':asset.type,'cache-control':asset.type.startsWith('text/html')?'no-store':'public,max-age=300','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'}});
 }catch(error){console.error('IAC request failed',path,error?.message);return json({error:'This feature is temporarily unavailable. Please call the Center.'},503);}
}};
