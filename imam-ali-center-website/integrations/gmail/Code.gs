// IAC website mail connection. Keep this project private.
// The authenticated website may send only to IAC's own inbox.
const IAC_SHARED_SECRET = '__IAC_SHARED_SECRET__';
const IAC_RECIPIENT = 'iacdmv@gmail.com';
const IAC_SERVICES = {
  marriage: 'Marriage & Nikah', divorce: 'Divorce guidance', funeral: 'Funeral & bereavement',
  consultation: 'Consultation', 'rent-a-hall': 'Hall rental', membership: 'Membership',
  'religious-question': 'Religious question'
};
function iacSignature(value) {
  return Utilities.computeHmacSha256Signature(value, IAC_SHARED_SECRET, Utilities.Charset.UTF_8)
    .map(function (n) { return ('0' + (n & 255).toString(16)).slice(-2); }).join('');
}
function iacEqual(a, b) {
  if (typeof a !== 'string' || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < b.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
function iacReply(data) {
  const payload = JSON.stringify(data);
  return ContentService.createTextOutput(JSON.stringify({payload: payload, signature: iacSignature(payload)}))
    .setMimeType(ContentService.MimeType.JSON);
}
function doGet() {
  return ContentService.createTextOutput('IAC mail connection. Website requests require authentication.');
}
function doPost(e) {
  let lock;
  try {
    if (!e || !e.postData || e.postData.contents.length > 16000000) return iacReply({ok:false, error:'Invalid request.'});
    const envelope = JSON.parse(e.postData.contents);
    if (typeof envelope.payload !== 'string' || !iacEqual(envelope.signature, iacSignature(envelope.payload))) return iacReply({ok:false, error:'Invalid website authorization.'});
    const data = JSON.parse(envelope.payload);
    if (typeof data.timestamp !== 'number' || Math.abs(Date.now() - data.timestamp) > 300000) return iacReply({ok:false, error:'Request expired.'});
    if (Session.getEffectiveUser().getEmail().toLowerCase() !== IAC_RECIPIENT) return iacReply({ok:false, error:'Deploy this project while signed in as iacdmv@gmail.com.'});
    if (data.operation === 'status') return iacReply({ok:true, recipient:IAC_RECIPIENT, quota:MailApp.getRemainingDailyQuota()});
    if (data.operation !== 'send' || !Object.prototype.hasOwnProperty.call(IAC_SERVICES,data.service) || !/^[0-9a-f-]{36}$/i.test(data.id) || typeof data.digest !== 'string' || !/^[0-9a-f]{64}$/.test(data.digest) || !data.fields || !Array.isArray(data.attachments)) return iacReply({ok:false,error:'Invalid service request.'});
    const reference = data.id.slice(0,8).toUpperCase();
    const attachments = [];
    let total = 0;
    if (data.attachments.length > 10) return iacReply({ok:false,error:'Too many documents.'});
    data.attachments.forEach(function(file) {
      if (!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Unsupported document.');
      const bytes = Utilities.base64Decode(file.data);total += bytes.length;
      if (bytes.length > 5*1024*1024 || total > 10*1024*1024) throw new Error('Documents are too large.');
      attachments.push(Utilities.newBlob(bytes,file.type,String(file.name).slice(0,180)));
    });
    const body = ['IAC website service request','Service: '+IAC_SERVICES[data.service],'Reference: '+reference,'Received: '+new Date(data.timestamp).toISOString(),''];
    Object.keys(data.fields).forEach(function(key) {
      if (typeof data.fields[key] !== 'string' || data.fields[key].length > 2000) throw new Error('Invalid answer.');
      if (data.fields[key]) body.push(key.replace(/([a-z])([A-Z])/g,'$1 $2')+': '+data.fields[key],'');
    });
    if (body.join('\n').length > 25000) return iacReply({ok:false,error:'Request is too long.'});
    lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) return iacReply({ok:false,error:'Mail connection is busy. Please try again.'});
    const properties = PropertiesService.getScriptProperties(),key = 'receipt_'+data.id;
    const old = properties.getProperty(key);
    if (old) {
      const receipt=JSON.parse(old);
      if(receipt.digest!==data.digest)return iacReply({ok:false,error:'This reference was already used.'});
      if(receipt.state==='sent')return iacReply({ok:true,sent:true,reference:reference});
      return iacReply({ok:false,uncertain:true,error:'Sending was interrupted. Contact IAC and quote reference '+reference+' before resending.'});
    }
    if (MailApp.getRemainingDailyQuota() < 1) return iacReply({ok:false,error:'The Gmail daily sending allowance has been reached. Please call IAC.'});
    // Retain only delivery IDs and digests for seven days to avoid duplicate emails.
    // No form answers or documents are stored in script properties.
    Object.entries(properties.getProperties()).forEach(function(entry){if(entry[0].startsWith('receipt_')){try{if(JSON.parse(entry[1]).time<Date.now()-7*86400000)properties.deleteProperty(entry[0]);}catch(ignored){}}});
    properties.setProperty(key,JSON.stringify({digest:data.digest,time:Date.now(),state:'sending'}));
    try {
      const options={to:IAC_RECIPIENT,subject:'[IAC] '+IAC_SERVICES[data.service]+' request · '+reference,body:body.join('\n'),name:'Imam Ali Center website',attachments:attachments};
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.fields.email || '') && !/[\r\n]/.test(data.fields.email)) options.replyTo=data.fields.email;
      MailApp.sendEmail(options);
    } catch (error) {
      return iacReply({ok:false,uncertain:true,error:'Gmail could not confirm sending. Contact IAC and quote reference '+reference+' before resending.'});
    }
    properties.setProperty(key,JSON.stringify({digest:data.digest,time:Date.now(),state:'sent'}));
    return iacReply({ok:true,sent:true,reference:reference});
  } catch (error) {
    return iacReply({ok:false,error:'The Gmail connection could not process this request. Please contact IAC.'});
  } finally {
    if (lock) {try {lock.releaseLock();} catch (ignored) {}}
  }
}
