import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { googlePlayOrderPaidAmountKrw } from '../functions/api/billing/_shared.js';
const source=readFileSync('functions/api/billing/_shared.js','utf8');
assert(source.includes("const endpoints = ["));
assert(source.includes("'https://oauth2.googleapis.com/token'"));
assert(source.includes("'https://www.googleapis.com/oauth2/v4/token'"));
assert(source.includes("if (typeof AbortSignal?.timeout === 'function')"));
assert(source.includes('causeCategory: allowedNames.has(name)'));
assert(source.includes("scope: 'https://www.googleapis.com/auth/androidpublisher'"));
assert(source.includes("grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer'"));
const keys=generateKeyPairSync('rsa',{modulusLength:2048});
const env={
  GOOGLE_PLAY_CLIENT_EMAIL:'quality-check@project.iam.gserviceaccount.com',
  GOOGLE_PLAY_PRIVATE_KEY:keys.privateKey.export({format:'pem',type:'pkcs8'}),
};
let tries=0,orders=0;
const original=globalThis.fetch;
try{
  globalThis.fetch=async (url,options)=>{
    const endpoint=String(url);
    if(endpoint.includes('/token')){
      tries++;
      assert.equal(options.method,'POST');
      assert.equal(new URLSearchParams(options.body).get('grant_type'),'urn:ietf:params:oauth:grant-type:jwt-bearer');
      if(tries===1) throw new TypeError('simulated temporary transport failure');
      return new Response(JSON.stringify({access_token:'fake-test-token',expires_in:3600}),{status:200,headers:{'content-type':'application/json'}});
    }
    assert(endpoint.includes('/orders/'),'Orders API next');
    assert.equal(options.headers.Authorization,'Bearer fake-test-token');
    orders++;
    return new Response(JSON.stringify({
      state:'PROCESSED',orderId:'test-id',purchaseToken:'test-token',
      createTime:'2026-10-15T06:40:00Z',
      lineItems:[{productId:'call_monthly',total:{currencyCode:'KRW',units:'1900',nanos:0}}],
    }),{status:200,headers:{'content-type':'application/json'}});
  };
  const result=await googlePlayOrderPaidAmountKrw(env,'kr.pagero.calltag','test-id','call_monthly');
  assert.equal(result.ok,true);
  assert.equal(result.amountKrw,1900);
  assert.equal(result.purchaseTokenHash.length,64);
  assert.equal(tries,2);
  assert.equal(orders,1);
  console.log('ok - transient Google OAuth transport failure retries without real credentials');
}finally{globalThis.fetch=original;}
