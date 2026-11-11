// Persist only redacted diagnostics. Never store request bodies, PII or secrets.
export function redactAdvertiserText(raw, lead = {}) {
  let value = String(raw ?? '').slice(0, 6000);
  for (const secret of [lead.name, lead.phone, lead.email, lead.content, lead.money, lead.area, lead.calldate]) {
    const s = String(secret ?? '').trim();
    if (s.length > 1) value = value.split(s).join('[REDACTED]');
  }
  return value
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    .replace(/(?:\+?82[- .]?)?0?1[016-9][-. ]?\d{3,4}[-. ]?\d{4}/g, '[PHONE]')
    .replace(/\b\d{9,}\b/g, '[NUMBER]')
    .replace(/ctwh_[a-zA-Z0-9_-]+/g, '[SECRET]')
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[URL]').slice(0, 700);
}
export function responsePreview(body, contentType, lead) {
  const raw = String(body || '');
  if (!raw) return '(empty response)';
  const type = String(contentType || '').toLowerCase();
  if (type.includes('json') || /^[\s]*[{[]/.test(raw)) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const keys = ['ok','success','status','result','code','error_code','error','message','msg'];
        const filtered = {};
        for (const k of keys) {
          const v = parsed[k];
          if (['string','number','boolean'].includes(typeof v))
            filtered[k] = redactAdvertiserText(v, lead).slice(0,240);
        }
        const text = Object.keys(filtered).length ? JSON.stringify(filtered)
          : 'JSON keys: ' + Object.keys(parsed).slice(0,20).join(',');
        return redactAdvertiserText(text,lead);
      }
    } catch {}
  }
  if (type.includes('html') || /^\s*(<!doctype html|<html)/i.test(raw)) {
    const title = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
    const clean = title || raw.replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return 'HTML: ' + redactAdvertiserText(clean, lead);
  }
  return redactAdvertiserText(raw, lead);
}
// Distinguish upstream edge refusal from form validation. This is diagnostic
// evidence, not proof of a particular Cloudflare WAF rule.
export function advertiserAccessRefusal(status, headers) {
  if (status !== 403) return null;
  const server = String(headers?.get?.('server') || '').slice(0,80);
  const cfRay = String(headers?.get?.('cf-ray') || '').slice(0,96);
  return {
    kind: (cfRay || /cloudflare/i.test(server)) ? 'EDGE_403' : 'HTTP_403',
    server, cfRay
  };
}
export function requestShape(lead, item) {
  const fields={DATAS_name:lead.name,DATAS_phone:lead.phone,
    DATAS_money:lead.money,DATAS_calldate:lead.calldate,DATAS_data:lead.content};
  return {
    item:String(item),
    supplied:Object.entries(fields).filter(([,v])=>String(v ?? '').trim()).map(([k])=>k),
    empty:Object.entries(fields).filter(([,v])=>!String(v ?? '').trim()).map(([k])=>k)
  };
}
export function safeRedirect(raw, original) {
  if (!raw) return {host:'',path:''};
  try {
    const next=new URL(raw,original);
    return {host:next.hostname.slice(0,120),path:next.pathname.slice(0,200)};
  } catch {return {host:'',path:'(invalid location)'};}
}
export async function ensureAdvertiserDiagnosticsSchema(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS meta_sheet_advertiser_http_logs ('+
    'event_id TEXT NOT NULL, attempt INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,'+
    'method TEXT NOT NULL DEFAULT \'POST\', host TEXT NOT NULL DEFAULT \'\', path TEXT NOT NULL DEFAULT \'\','+
    'item TEXT NOT NULL DEFAULT \'\', content_type_sent TEXT NOT NULL DEFAULT \'\','+
    'supplied_fields TEXT NOT NULL DEFAULT \'\', empty_fields TEXT NOT NULL DEFAULT \'\','+
    'elapsed_ms INTEGER NOT NULL DEFAULT 0, http_status INTEGER NOT NULL DEFAULT 0,'+
    'response_type TEXT NOT NULL DEFAULT \'\', response_preview TEXT NOT NULL DEFAULT \'\','+
    'redirect_host TEXT NOT NULL DEFAULT \'\', redirect_path TEXT NOT NULL DEFAULT \'\','+
    'exception_type TEXT NOT NULL DEFAULT \'\', exception_code TEXT NOT NULL DEFAULT \'\','+
    'outcome TEXT NOT NULL DEFAULT \'\', PRIMARY KEY(event_id,attempt))').run();
}
export async function recordAdvertiserHttpLog(db, record) {
  await ensureAdvertiserDiagnosticsSchema(db);
  const url=new URL(record.advertiserUrl);
  const method=['GET','HEAD'].includes(record.method) ? record.method : 'POST';
  const shape=method!=='POST' ? {item:String(record.item || ''),supplied:[],empty:[]} : requestShape(record.lead,record.item);
  await db.prepare('INSERT OR REPLACE INTO meta_sheet_advertiser_http_logs '+
    '(event_id,attempt,method,host,path,item,content_type_sent,supplied_fields,empty_fields,'+
    'elapsed_ms,http_status,response_type,response_preview,redirect_host,redirect_path,'+
    'exception_type,exception_code,outcome) '+
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(record.eventId,record.attempt,method,url.hostname.slice(0,120),url.pathname.slice(0,200),
      shape.item,method==='POST'?'application/x-www-form-urlencoded':'',JSON.stringify(shape.supplied),JSON.stringify(shape.empty),
      Math.max(0,Math.round(Number(record.duration)||0)),Number(record.status||0),
      String(record.contentType||'').slice(0,100),String(record.preview||'').slice(0,700),
      String(record.redirect?.host||''),String(record.redirect?.path||''),
      String(record.errorName||'').slice(0,80),String(record.errorCode||'').slice(0,80),
      String(record.outcome||'').slice(0,32)).run();
}
export async function getAdvertiserHttpLogs(db,eventId) {
  await ensureAdvertiserDiagnosticsSchema(db);
  const result=await db.prepare('SELECT attempt,created_at,method,host,path,item,content_type_sent,'+
    'supplied_fields,empty_fields,elapsed_ms,http_status,response_type,response_preview,'+
    'redirect_host,redirect_path,exception_type,exception_code,outcome '+
    'FROM meta_sheet_advertiser_http_logs WHERE event_id=? ORDER BY attempt DESC LIMIT 5')
    .bind(eventId).all();
  return (result.results||[]).map(v=>({
    attempt:v.attempt,createdAt:v.created_at,method:v.method,target:v.host+v.path,item:v.item,
    contentTypeSent:v.content_type_sent,
    suppliedFields:JSON.parse(v.supplied_fields||'[]'),
    emptyFields:JSON.parse(v.empty_fields||'[]'),
    elapsedMs:v.elapsed_ms,httpStatus:v.http_status,responseType:v.response_type,
    responsePreview:v.response_preview,redirectHost:v.redirect_host,redirectPath:v.redirect_path,
    exceptionType:v.exception_type,exceptionCode:v.exception_code,outcome:v.outcome
  }));
}

export function safeDiagnosticHeaders(headers) {
  const allowed=['server','cf-ray','via','allow','x-cache','www-authenticate','x-request-id'];
  return Object.fromEntries(allowed.flatMap(key => {
    const v=String(headers?.get?.(key)||'').slice(0,100);
    return v ? [[key,redactAdvertiserText(v)]] : [];
  }));
}
