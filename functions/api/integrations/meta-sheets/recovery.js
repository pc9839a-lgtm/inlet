import { assertD1, jsonResponse, optionsResponse } from '../../_shared.js';
import { ensureWebhookSchema, sha256 } from '../../calltag/v1/_shared.js';
import { advertiserForm, explicitAdvertiserSuccess, extractWebhookKey } from './relay.js';

const METHODS = 'POST, OPTIONS';
const TARGET_ID = 'meta-l1870743443942053';
const ALLOWED_WEBHOOK_SHA256 = '5581b91b500d9fb0454d2377b8a53968d79d4471f314171d8eeb2d50dd78c57f';

function safeStatus(row) {
  if (!row) return { found: false, eventId: TARGET_ID };
  return {
    found: true, eventId: TARGET_ID,
    calltagStatus: String(row.ct_status || ''),
    advertiserStatus: String(row.ad_status || ''),
    advertiserAttempts: Number(row.ad_attempts || 0),
    calltagAttempts: Number(row.ct_attempts || 0),
    advertiserError: String(row.ad_error || '').slice(0, 160),
    updatedAt: String(row.updated_at || '')
  };
}
async function authenticated(request, db) {
  const endpointKey = extractWebhookKey(request.headers.get('X-Meta-Relay-Token'));
  if (!endpointKey) return false;
  const hash = await sha256(endpointKey);
  if (hash !== ALLOWED_WEBHOOK_SHA256) return false;
  await ensureWebhookSchema(db);
  const connection = await db.prepare("SELECT id FROM calltag_webhook_connections WHERE endpoint_hash=? AND status='active' LIMIT 1")
    .bind(hash).first();
  return !!connection?.id;
}
function advertiserDestination(env) {
  const parsed = new URL(String(env.META_SHEETS_ADVERTISER_URL || 'https://ollymkt.shop/dbapi/'));
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'ollymkt.shop'
      || parsed.username || parsed.password) throw new Error('ADVERTISER_ENDPOINT_INVALID');
  return parsed.href;
}
export async function onRequest({request, env}) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, {ok:false,error:'METHOD_NOT_ALLOWED'}, METHODS);
  try {
    const db = assertD1(env);
    if (!await authenticated(request, db)) return jsonResponse(request, env, 401, {ok:false,error:'UNAUTHORIZED'}, METHODS);
    const raw = await request.text();
    if (raw.length > 2000) return jsonResponse(request, env, 413, {ok:false}, METHODS);
    const input = JSON.parse(raw || '{}');
    const action = String(input?.action || '');
    if (!['status','retry-advertiser'].includes(action)) return jsonResponse(request, env, 400, {ok:false,error:'INVALID_ACTION'}, METHODS);
    const row = await db.prepare("SELECT event_id,payload_json,ct_status,ad_status,ct_attempts,ad_attempts,ad_error,updated_at FROM meta_sheet_dual_queue WHERE event_id=? LIMIT 1")
      .bind(TARGET_ID).first();
    if (action === 'status') return jsonResponse(request, env, 200, {ok:true,...safeStatus(row)}, METHODS);
    if (input?.confirmedNotReceived !== true) return jsonResponse(request, env, 400, {ok:false,error:'CONFIRM_NOT_RECEIVED'}, METHODS);
    if (!row) return jsonResponse(request, env, 404, {ok:false,error:'NOT_IN_CLOUDFLARE'}, METHODS);
    if (row.ad_status === 'SENT') return jsonResponse(request, env, 409, {ok:false,error:'ALREADY_MARKED_SENT',...safeStatus(row)}, METHODS);
    if (!['PENDING','REVIEW','ERROR'].includes(row.ad_status)) return jsonResponse(request, env, 409, {ok:false,error:'NOT_RETRYABLE',...safeStatus(row)}, METHODS);
    if (Number(row.ad_attempts||0)>=2) return jsonResponse(request, env, 409, {ok:false,error:'MAX_ATTEMPTS',...safeStatus(row)}, METHODS);
    let lead;
    try { lead = JSON.parse(row.payload_json); } catch { return jsonResponse(request, env, 422, {ok:false,error:'CORRUPT_SAVED_LEAD'}, METHODS); }
    if (lead?.eventId !== TARGET_ID || !/^01\d{8,9}$/.test(String(lead?.phone||''))) {
      return jsonResponse(request, env, 422, {ok:false,error:'SAVED_LEAD_INVALID'}, METHODS);
    }
    const claimed = await db.prepare("UPDATE meta_sheet_dual_queue SET ad_status='SENDING', ad_attempts=ad_attempts+1, updated_at=CURRENT_TIMESTAMP WHERE event_id=? AND ad_status IN ('PENDING','REVIEW','ERROR') AND ad_attempts <2")
      .bind(TARGET_ID).run();
    if (!claimed?.meta?.changes) return jsonResponse(request, env, 409, {ok:false,error:'CONCURRENT_DELIVERY'}, METHODS);
    let remoteStatus = 0, resultStatus = 'REVIEW';
    try {
      const response = await fetch(advertiserDestination(env),{
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded; charset=utf-8'},
        body:advertiserForm(lead,String(env.META_SHEETS_ADVERTISER_ITEM||'64')),
        redirect:'manual',signal:AbortSignal.timeout(12000)
      });
      remoteStatus = response.status;
      const responseBody = (await response.text()).slice(0,12000);
      resultStatus = explicitAdvertiserSuccess(response.status,responseBody)?'SENT':'REVIEW';
    } catch {
      resultStatus = 'REVIEW';
    }
    await db.prepare("UPDATE meta_sheet_dual_queue SET ad_status=?, ad_error=?, updated_at=CURRENT_TIMESTAMP WHERE event_id=?")
      .bind(resultStatus, resultStatus==='SENT'?'':'광고주 실제 접수 확인 필요', TARGET_ID).run();
    return jsonResponse(request, env, 200, {
      ok:true, eventId:TARGET_ID, sentRequest:true,
      advertiserHttpStatus:remoteStatus, advertiserStatus:resultStatus,
      receiptVerified:resultStatus==='SENT'
    }, METHODS);
  } catch(err) {
    console.error('Meta advertiser recovery error',{type:String(err?.name||'Error')});
    return jsonResponse(request, env, 500, {ok:false,error:'RECOVERY_ERROR'}, METHODS);
  }
}
