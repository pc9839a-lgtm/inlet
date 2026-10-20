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
// A service account email is not an API credential; share it only after the
// existing strong production-QA secret gate, never expose private key contents.
env.GOOGLE_PLAY_CLIENT_EMAIL='server-play@some-project.iam.gserviceaccount.com';
env.GOOGLE_PLAY_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\\nTEST-ONLY\\n-----END PRIVATE KEY-----';
const identity=await (await call({body:{mode:'identity'}})).json();
assert.equal(identity.ok,true);
assert.equal(identity.serviceAccountEmail,'server-play@some-project.iam.gserviceaccount.com');
assert.equal(identity.serviceAccountFormatValid,true);
assert.equal(identity.privateKeyConfigured,true);
assert(!JSON.stringify(identity).includes('TEST-ONLY'),'no secret content in response');
assert.equal((await call({key:'bad',body:{mode:'identity'}})).status,404);
console.log('ok - Play service-account identity available only after QA-secret authentication');
// A payment completeness audit never writes: counts and statuses only.
const playEarningsSource=readFileSync('functions/api/billing/_playEarningsHistory.js','utf8');
const auditStart=playEarningsSource.indexOf('export async function auditPlayEarningsOrderCoverage');
const auditEnd=playEarningsSource.indexOf('export async function ensureSchemas',auditStart);
assert(auditStart>0&&auditEnd>auditStart,'read-only earnings function exists');
const auditCode=playEarningsSource.slice(auditStart,auditEnd);
assert(!/\b(INSERT|UPDATE|DELETE|REPLACE|\.run\()\b/i.test(auditCode),'Google earnings inventory must be read-only');
assert(auditCode.includes('paidFamiliesWithoutStoredSubscription'),'unmatched order-family count retained');
const inventory=await (await call({body:{mode:'inventory'}})).json();
assert.equal(inventory.ok,true);
assert.equal(inventory.mode,'inventory');
assert.equal(inventory.readOnly,true);
assert.equal(inventory.inventory.registered_subscriptions.available,false);
assert.equal(inventory.reportCoverage.available,false);
assert(!JSON.stringify(inventory).includes('TEST-ONLY'),'secrets are never returned');
assert.equal((await call({key:'bad',body:{mode:'inventory'}})).status,404);
console.log('ok - aggregate-only unmatched payer inventory, gated by production QA secret');
console.log('CallTag secure provider-backed subscription repair checks passed');
