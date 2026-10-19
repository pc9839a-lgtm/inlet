import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateKeyPairSync} from 'node:crypto';
import {googlePlayOrderPaidAmountKrw} from '../functions/api/billing/_shared.js';
const source=readFileSync('functions/api/billing/_shared.js','utf8');
const qa=readFileSync('functions/api/qa/calltag-stale-subscription-repair.js','utf8');
const runner=readFileSync('scripts/calltag-production-subscription-restore.mjs','utf8');
assert(source.includes('providerErrorStatus: allowedProviderReasons.has(reason)'));
assert(source.includes('providerErrorReason: allowedErrorReasons.has(errorReason)'));
assert(source.includes('authChallenge,'));
assert(qa.includes('providerErrorStatus:check.providerErrorStatus'));
assert(runner.includes('providerErrorStatus:x.providerErrorStatus'));
assert(!runner.includes('console.log(secret)'));
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const env={GOOGLE_PLAY_CLIENT_EMAIL:'qa@demo.iam.gserviceaccount.com',
  GOOGLE_PLAY_PRIVATE_KEY:privateKey.export({format:'pem',type:'pkcs8'})};
const original=globalThis.fetch;
try {
  globalThis.fetch=async (url)=>{
    if(String(url).includes('/token')) return new Response(JSON.stringify({
      access_token:'fake-diagnostic-test-token',expires_in:3600
    }),{status:200,headers:{'content-type':'application/json'}});
    return new Response(JSON.stringify({
      error:{code:401,status:'UNAUTHENTICATED',
        message:'a personal token-looking secret that must NOT be included',
        errors:[{reason:'authError',message:'private provider data'}]},
    }),{status:401,headers:{
      'content-type':'application/json',
      'www-authenticate':'Bearer realm="test", error="invalid_token", error_description="Secret data omitted"'
    }});
  };
  const result=await googlePlayOrderPaidAmountKrw(env,'kr.pagero.calltag','test-only','call_monthly');
  assert.equal(result.ok,false);
  assert.equal(result.googleStatus,401);
  assert.equal(result.providerErrorStatus,'UNAUTHENTICATED');
  assert.equal(result.providerErrorReason,'autherror');
  assert.equal(result.authChallenge,'invalid_token');
  const rendered=JSON.stringify(result);
  assert(!rendered.includes('a personal token-looking'));
  assert(!rendered.includes('Secret data omitted'));
  console.log('PASS: Google Play 401 classification contains no raw provider message or bearer token');
}finally{globalThis.fetch=original;}
