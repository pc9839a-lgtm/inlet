import { assertD1 } from '../_shared.js';
import { googlePlayOrderPaidAmountKrw, reconcileGoogleSubscriptionByOrder } from '../billing/_shared.js';
const PKG = 'kr.pagero.calltag';
const LIMIT = 5;
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: {
  'content-type':'application/json; charset=utf-8', 'cache-control':'no-store',
  'x-robots-tag':'noindex,nofollow', 'x-content-type-options':'nosniff' } });
function safeCompare(a,b) {
  a=String(a||''); b=String(b||'');
  let d=a.length^b.length;
  for(let i=0;i<Math.max(a.length,b.length);i++) d|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
  return d===0;
}
function authorized(request,env) {
  const url=new URL(request.url);
  if(url.protocol!=='https:'||url.hostname!=='pagero.kr') return false;
  const expected=String(env.INLET_PRODUCTION_QA_SECRET||'').trim();
  const actual=String(request.headers.get('X-Inlet-Production-QA-Secret')||'').trim();
  return expected.length>=64&&actual.length>=64&&safeCompare(actual,expected);
}
async function candidates(db) {
  const query=[
    'SELECT id,owner_id,product_code,channel,order_id,purchase_token_hash',
    'FROM billing_subscriptions',
    "WHERE channel='google_play' AND verification_state='verified'",
    "AND product_code IN ('call_monthly','message_monthly','all_monthly')",
    "AND status IN ('active','grace','cancelled','expired')",
    "AND length(purchase_token_hash)=64 AND order_id!=''",
    "AND (expires_at='' OR datetime(expires_at)<=datetime('now'))",
    'ORDER BY id ASC LIMIT ?'
  ].join(' ');
  const q=await db.prepare(query).bind(LIMIT).all();
  return Array.isArray(q?.results)?q.results:[];
}
async function officialOrderMatch(env,row) {
  if(!row?.owner_id||!Number.isSafeInteger(Number(row?.id))) return {ok:false,reason:'invalid_record'};
  try {
    const check=await googlePlayOrderPaidAmountKrw(env,PKG,row.order_id,row.product_code);
    if(check?.ok!==true) return {
      ok:false,reason:String(check?.reason||'play_order_unverified').slice(0,64),
      googleStatus:[401,403,404].includes(Number(check?.googleStatus))?Number(check.googleStatus):0,
      providerErrorStatus:String(check?.providerErrorStatus||'').slice(0,40),
      providerErrorReason:String(check?.providerErrorReason||'').slice(0,40),
      authChallenge:String(check?.authChallenge||'').slice(0,40),
    };
    if(!check.purchaseTokenHash||String(check.purchaseTokenHash).toLowerCase()!==String(row.purchase_token_hash||'').toLowerCase()) {
      return {ok:false,reason:'purchase_token_owner_mismatch'};
    }
    return {ok:true,reason:'verified_paid_owner_match'};
  } catch (error) {
    // Expose only a known error category, never the exception message, JWT,
    // purchase token, key material or provider response body.
    const code = String(error?.details?.code || error?.code || '').trim();
    const permitted = new Set([
      'PLAY_AUTH_FAILED','PLAY_AUTH_NETWORK_FAILED','PLAY_PRIVATE_KEY_REQUIRED',
      'PLAY_ORDER_LOOKUP_FAILED','PLAY_ORDER_NETWORK_FAILED',
      'PLAY_ORDER_INPUT_INCOMPLETE','PLAY_SUBSCRIPTION_LOOKUP_FAILED',
    ]);
    const name = String(error?.name || '');
    const allowedNames = new Set(['DataError','InvalidCharacterError','OperationError','NotSupportedError','TypeError','ReferenceError']);
    return {
      ok:false,
      reason:permitted.has(code) ? code : (allowedNames.has(name) ? 'RUNTIME_'+name : 'GOOGLE_PLAY_AUTH_UNKNOWN'),
      googleStatus:[401,403,404].includes(Number(error?.details?.googleStatus)) ? Number(error.details.googleStatus) : 0,
      transportCause:['TypeError','AbortError','TimeoutError','ReferenceError','NotSupportedError','OperationError','NetworkFailure'].includes(String(error?.details?.causeCategory))
        ? String(error.details.causeCategory) : '',
      transportAttempts:Math.max(0,Math.min(3,Number(error?.details?.attempts||0))),
    };
  }
}
export async function onRequest({request,env}) {
  if(request.method!=='POST'||!authorized(request,env)) return reply(404,{ok:false,code:'NOT_FOUND'});
  let input;
  try { input=await request.json(); }
  catch {return reply(400,{ok:false,code:'INVALID_JSON'});}
  const mode=String(input?.mode||'');
  if(!['preview','apply'].includes(mode)) return reply(400,{ok:false,code:'INVALID_MODE'});
  const ids=input?.ids;
  if(mode==='apply'&&(!Array.isArray(ids)||ids.length<1||ids.length>LIMIT
    ||ids.some(x=>!Number.isSafeInteger(x)||x<=0)||new Set(ids).size!==ids.length)) {
    return reply(400,{ok:false,code:'INVALID_IDS'});
  }
  try {
    const db=assertD1(env);
    const stale=await candidates(db);
    const rows=mode==='apply'?stale.filter(x=>ids.includes(Number(x.id))):stale;
    if(mode==='apply'&&rows.length!==ids.length) return reply(409,{ok:false,code:'RECORDS_CHANGED'});
    const checks=await Promise.all(rows.map(row=>officialOrderMatch(env,row)));
    const results=[];
    for(let i=0;i<rows.length;i++){
      const row=rows[i],check=checks[i];
      const one={id:Number(row.id),productCode:row.product_code,providerVerified:check.ok,
        activeNow:false,state:check.reason,providerHttpStatus:check.googleStatus||0,
        transportCause:check.transportCause||'',transportAttempts:check.transportAttempts||0};
      if(mode==='apply'&&check.ok){
        try{
          const fresh=await reconcileGoogleSubscriptionByOrder(env,db,row);
          one.subscriptionRefreshed=fresh.ok===true;
          one.activeNow=fresh.active===true;
          one.state=String(fresh.reason||'provider_unavailable').slice(0,64);
          one.providerHttpStatus=fresh.providerHttpStatus||0;
        }catch {one.state='subscription_verification_failed';one.subscriptionRefreshed=false;}
      }
      results.push(one);
    }
    return reply(200,{ok:true,applied:mode==='apply',examined:results.length,
      providerVerified:results.filter(x=>x.providerVerified).length,
      subscriptionRefreshed:results.filter(x=>x.subscriptionRefreshed===true).length,
      activeNow:results.filter(x=>x.activeNow===true).length,results});
  }catch{return reply(503,{ok:false,code:'PLAY_RECONCILE_UNAVAILABLE'});}
}
