import { assertD1, jsonResponse, optionsResponse } from '../../_shared.js';
import { ensureWebhookSchema, sha256 } from '../../calltag/v1/_shared.js';
import { extractWebhookKey } from './relay.js';
import { getAdvertiserHttpLogs, recordAdvertiserHttpLog, requestShape, safeRedirect, responsePreview, safeDiagnosticHeaders } from './advertiser-diagnostics.js';

const METHODS='POST, OPTIONS';
const TARGET_ID='meta-l1870743443942053';
const ALLOWED_WEBHOOK_SHA256='5581b91b500d9fb0454d2377b8a53968d79d4471f314171d8eeb2d50dd78c57f';
const ADVERTISER_DEFAULT_URL='https://ollymkt.shop/dbapi/';

async function authorized(request,db) {
  const key=extractWebhookKey(request.headers.get('X-Meta-Relay-Token'));
  if(!key || await sha256(key)!==ALLOWED_WEBHOOK_SHA256) return false;
  await ensureWebhookSchema(db);
  const conn=await db.prepare("SELECT id FROM calltag_webhook_connections WHERE endpoint_hash=? AND status='active' LIMIT 1")
    .bind(ALLOWED_WEBHOOK_SHA256).first();
  return !!conn?.id;
}
function destination(env){
  const u=new URL(String(env.META_SHEETS_ADVERTISER_URL||ADVERTISER_DEFAULT_URL));
  if(u.protocol!=='https:'||u.hostname!=='ollymkt.shop'||u.username||u.password)
    throw Error('INVALID_ADVERTISER_URL');
  return u.href;
}
function summary(row){
  return {
    found:!!row,eventId:TARGET_ID,
    calltagStatus:String(row?.ct_status||''),
    advertiserStatus:String(row?.ad_status||''),
    advertiserAttempts:Number(row?.ad_attempts||0),
    lastError:String(row?.ad_error||'').slice(0,180),
    updatedAt:String(row?.updated_at||'')
  };
}
export async function onRequest({request,env}){
  if(request.method==='OPTIONS')return optionsResponse(request,env,METHODS);
  if(request.method!=='POST')return jsonResponse(request,env,405,{ok:false,error:'METHOD_NOT_ALLOWED'},METHODS);
  try{
    const db=assertD1(env);
    if(!await authorized(request,db))return jsonResponse(request,env,401,{ok:false,error:'UNAUTHORIZED'},METHODS);
    const raw=await request.text();
    if(raw.length>2000)return jsonResponse(request,env,413,{ok:false,error:'TOO_LARGE'},METHODS);
    const action=JSON.parse(raw||'{}')?.action;
    if(!['status','probe-connection'].includes(action))
      return jsonResponse(request,env,400,{ok:false,error:'INVALID_ACTION'},METHODS);
    const row=await db.prepare("SELECT event_id,payload_json,ct_status,ad_status,ad_attempts,ad_error,updated_at FROM meta_sheet_dual_queue WHERE event_id=? LIMIT 1")
      .bind(TARGET_ID).first();
    if(!row)return jsonResponse(request,env,200,{ok:true,...summary(row),logs:[]},METHODS);
    let source={};
    try{source=JSON.parse(row.payload_json);}catch{}
    const shape=requestShape(source,String(env.META_SHEETS_ADVERTISER_ITEM||'64'));

    if(action==='probe-connection') {
      // HEAD and GET are safe: neither request carries a lead or a form body.
      // Compare statuses to distinguish a method restriction from broader access rejection.
      const endpoint=destination(env);
      for (const [method,attempt] of [['HEAD',-1],['GET',0]]) {
        const entry={
          eventId:TARGET_ID,attempt,advertiserUrl:endpoint,
          item:String(env.META_SHEETS_ADVERTISER_ITEM||'64'),
          lead:{},method,status:0,contentType:'',preview:'',
          redirect:{host:'',path:''},errorName:'',errorCode:'',
          outcome:'TRANSPORT_PROBE',duration:0
        };
        const started=Date.now();
        try {
          const response=await fetch(endpoint,{
            method,redirect:'manual',signal:AbortSignal.timeout(8000),
            headers:{'Accept':'text/html,application/json;q=0.9,*/*;q=0.1'}
          });
          entry.status=response.status;
          entry.contentType=response.headers.get('content-type')||'';
          entry.redirect=safeRedirect(response.headers.get('location'),endpoint);
          const headers=safeDiagnosticHeaders(response.headers);
          const body=method==='GET' ? (await response.text()).slice(0,3500) : '';
          const detail=method==='GET' ? responsePreview(body,entry.contentType,{})
            : '(HEAD has no response body)';
          entry.preview=('headers='+JSON.stringify(headers)+'; body='+detail).slice(0,690);
        }catch(err){
          entry.errorName=String(err?.name||'Error').slice(0,80);
          entry.errorCode=String(err?.cause?.code||err?.code||'').slice(0,80);
          entry.preview='Network/transport exception';
        }
        entry.duration=Date.now()-started;
        await recordAdvertiserHttpLog(db,entry);
      }
    }
    const logs=await getAdvertiserHttpLogs(db,TARGET_ID);
    const postLogs=logs.filter(x=>x.method==='POST');
    return jsonResponse(request,env,200,{
      ok:true,...summary(row),
      requestShape:shape,
      logs,
      historicalResponsesUnavailable:Number(row.ad_attempts||0)>postLogs.length,
      note:'기존 POST 전송의 상세 응답은 소급 복구할 수 없습니다. HEAD/GET 테스트에는 고객정보를 포함하지 않습니다.'
    },METHODS);
  }catch(err){
    console.error('Advertiser diagnostics status error',{type:String(err?.name||'Error')});
    return jsonResponse(request,env,500,{ok:false,error:'DIAGNOSTICS_ERROR'},METHODS);
  }
}
