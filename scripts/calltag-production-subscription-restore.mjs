// Production-only backfill. The secret is provisioned and rotated in the existing
// deploy workflow. No user emails, orders, purchase tokens, or secret are logged.
const secret=String(process.env.INLET_PRODUCTION_SAVE_QA_SECRET||'').trim();
const origin='https://pagero.kr';
const endpoint=origin+'/api/qa/calltag-stale-subscription-repair';
if(secret.length<64) throw new Error('CALLTAG_REPAIR_QA_SECRET_UNAVAILABLE');

async function post(body) {
  const response=await fetch(endpoint,{
    method:'POST',
    headers:{'content-type':'application/json','X-Inlet-Production-QA-Secret':secret},
    body:JSON.stringify(body),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(90000)
  });
  const raw=await response.text();
  let data;
  try {data=JSON.parse(raw);}catch{throw new Error('CALLTAG_REPAIR_INVALID_JSON_'+response.status);}
  if(!response.ok||data?.ok!==true)throw new Error('CALLTAG_REPAIR_API_'+response.status+'_'+String(data?.code||'FAIL').slice(0,64));
  return data;
}
const preview=await post({mode:'preview'});
const candidates=Array.isArray(preview.results)?preview.results:[];
const valid=candidates.filter(x=>x.providerVerified===true&&x.state==='verified_paid_owner_match');
console.log('CALLTAG_GOOGLE_PLAY_STALE_PROOF',JSON.stringify({
  examined:preview.examined,googlePaidMatched:valid.length,
  failures:candidates.filter(x=>!x.providerVerified).map(x=>({
    productCode:x.productCode,state:x.state,providerHttpStatus:x.providerHttpStatus
  }))
}));
const results=[];
for(const row of valid){
  // Apply one stable row id per call; each request rechecks the original
  // paid order/token owner and the current Google Play subscriptionsv2 status.
  const applied=await post({mode:'apply',ids:[row.id]});
  const outcome=applied.results?.[0]||{};
  results.push({
    productCode:outcome.productCode||row.productCode,
    state:outcome.state||'missing_result',
    providerVerified:outcome.providerVerified===true,
    subscriptionRefreshed:outcome.subscriptionRefreshed===true,
    activeNow:outcome.activeNow===true,
    providerHttpStatus:outcome.providerHttpStatus||0,
  });
}
const summary={
  ok:true,
  previewExamined:preview.examined||0,
  previewProviderPaid:valid.length,
  rechecked:results.length,
  refreshed:results.filter(x=>x.subscriptionRefreshed).length,
  activeNow:results.filter(x=>x.activeNow).length,
  errors:candidates.length-valid.length,
  results
};
console.log('CALLTAG_GOOGLE_PLAY_REPAIR_RESULT',JSON.stringify(summary));
process.stdout.write(JSON.stringify(summary));
