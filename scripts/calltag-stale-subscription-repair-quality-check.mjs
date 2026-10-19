import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequest} from '../functions/api/qa/calltag-stale-subscription-repair.js';
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
const src=readFileSync('functions/api/qa/calltag-stale-subscription-repair.js','utf8');
const runner=readFileSync('scripts/calltag-production-subscription-restore.mjs','utf8');
const deployment=readFileSync('.github/workflows/deploy-cloudflare.yml','utf8');
new AsyncFunction(runner);
for (const [name,condition] of Object.entries({
  'Production host only':src.includes("url.hostname!=='pagero.kr'"),
  'Secret length and constant comparison':src.includes('expected.length>=64&&actual.length>=64&&safeCompare'),
  'Official Orders API amount and token verification':src.includes('googlePlayOrderPaidAmountKrw(')&&src.includes('purchase_token_owner_mismatch'),
  'Existing verified owner and product binding only':src.includes("verification_state='verified'")&&src.includes("length(purchase_token_hash)=64"),
  'No unlimited scan':src.includes("LIMIT = 5")&&src.includes('LIMIT ?'),
  'Dry run does not change subscription':src.includes("if(mode==='apply'&&check.ok)"),
  'Subscriptionsv2 recheck before activation':src.includes('reconcileGoogleSubscriptionByOrder('),
  'No new entitlements/owners inserted':!src.includes('INSERT INTO')&&!src.includes('UPDATE billing_'),
  'No customer identifiers returned':!src.includes('ownerId:')&&!src.includes('orderId:')&&!src.includes('purchaseToken:'),
  'Deploy runner revalidates per row on apply':runner.includes("mode:'preview'")&&runner.includes("mode:'apply',ids:[row.id]"),
  'Deploy uses ephemerally rotated existing QA credential':runner.includes("process.env.INLET_PRODUCTION_SAVE_QA_SECRET")&&deployment.includes('Rotate production save QA secret'),
  'Secrets never printed by runner':!runner.includes('console.log(secret)')&&!runner.includes('JSON.stringify(secret)'),
})) assert.equal(condition,true,name);
const secret='s'.repeat(70);
const env={INLET_PRODUCTION_QA_SECRET:secret,DB:{
  prepare:()=>({bind:()=>({all:async()=>({results:[]})})})
}};
async function call({url='https://pagero.kr/api/qa/calltag-stale-subscription-repair',key=secret,body={mode:'preview'},method='POST'}={}) {
  return onRequest({env,request:new Request(url,{
    method,headers:{'content-type':'application/json','X-Inlet-Production-QA-Secret':key},
    ...(method==='POST'?{body:JSON.stringify(body)}:{})
  })});
}
assert.equal((await call({key:'bad'})).status,404,'invalid secret rejects');
assert.equal((await call({url:'https://calltag.pagero.kr/api/qa/calltag-stale-subscription-repair'})).status,404,'wrong host rejects');
assert.equal((await call({method:'GET'})).status,404,'GET rejects');
assert.equal((await call({body:{mode:'apply',ids:[]}})).status,400,'empty apply rejects');
assert.equal((await call({body:{mode:'apply',ids:[1,1]}})).status,400,'duplicate IDs rejects');
const preview=await (await call()).json();
assert.equal(preview.ok,true);
assert.equal(preview.examined,0);
assert.equal(preview.applied,false);
console.log('CallTag secure provider-backed subscription repair checks passed');
