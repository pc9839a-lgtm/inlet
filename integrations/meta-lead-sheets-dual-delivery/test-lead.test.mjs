import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequest} from '../../functions/api/integrations/meta-sheets/test-lead.js';

const url='https://pagero.kr/api/integrations/meta-sheets/test-lead';
function request(method, token=''){
  return new Request(url,{method,headers:token?{'X-CallTag-Test-Webhook':token}:{},...(method==='POST'?{body:'{}'}:{})});
}
test('test endpoint never permits GET',async()=>{
  const result=await onRequest({request:request('GET'),env:{},params:{}});
  assert.equal(result.status,405);
});
test('test endpoint rejects blank, wrong or invalid hostname credentials',async()=>{
  const env={DB:{prepare(){throw Error('unauthorized request should not read DB')}}};
  // Although DB is checked for availability, no SQL is issued before auth hash check.
  for(const token of ['', 'bad',
    'https://attacker.example/api/calltag/v1/hooks/ctwh_XHQF78fwwGLQequlXQZV_wJJdAymWZFB',
    'ctwh_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']){
    const result=await onRequest({request:request('POST',token),env,params:{}});
    assert.equal(result.status,401);
  }
});
test('page is static and excludes the private webhook value',()=>{
  const page=readFileSync(new URL('../../public/calltag-lead-test/index.html',import.meta.url),'utf8');
  assert.match(page,/calltag-lead-test/);
  assert.match(page,/가상 고객 1건/);
  assert.doesNotMatch(page,/ctwh_XHQF78fwwGLQequlXQZV_wJJdAymWZFB/);
  assert.doesNotMatch(page,/localStorage|sessionStorage|document\.cookie/);
});
test('synthetic flow sends no advertiser request',()=>{
  const server=readFileSync(new URL('../../functions/api/integrations/meta-sheets/test-lead.js',import.meta.url),'utf8');
  assert.doesNotMatch(server,/ollymkt|DATAS_|sendAdvertiser|META_SHEETS_ADVERTISER_URL/);
  assert.match(server,/intakeCanonicalLead/);
  assert.match(server,/idempotencyKey/);
});
