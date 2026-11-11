import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequest} from '../../functions/api/integrations/meta-sheets/recovery.js';
const endpoint='https://pagero.kr/api/integrations/meta-sheets/recovery';
const request=(action,token='ctwh_invalidfake111111111111111111111')=>
  new Request(endpoint,{method:'POST',headers:{'X-Meta-Relay-Token':token},
    body:JSON.stringify({action,confirmedNotReceived:action==='retry-advertiser'})});
function fakeDb(){
  const called=[];
  return {called,prepare(sql){const q={sql,args:[],
    bind(...args){this.args=args;return this},
    async run(){called.push({kind:'run',sql,args:this.args});return {meta:{changes:1}}},
    async first(){called.push({kind:'first',sql,args:this.args});return null}
  };return q;}};
}
test('status/retry endpoint never permits GET',async()=>{
  const r=await onRequest({request:new Request(endpoint),env:{}});
  assert.equal(r.status,405);
});
test('no Cloudflare DB request without valid secret',async()=>{
  const db=fakeDb(), r=await onRequest({request:request('retry-advertiser'),
     env:{DB:db}});
  assert.equal(r.status,401);
  assert.equal(db.called.length,0);
});
test('recovery is hard-scoped to one known Meta ID and is confirmation gated',()=>{
  const js=readFileSync(new URL('../../functions/api/integrations/meta-sheets/recovery.js',import.meta.url),'utf8');
  assert.match(js,/meta-l1870743443942053/);
  assert.match(js,/confirmedNotReceived/);
  assert.match(js,/ALREADY_MARKED_SENT/);
  assert.match(js,/CONCURRENT_DELIVERY/);
  assert.match(js,/ad_attempts <2/);
  assert.doesNotMatch(js,/ct_status='SENDING'|intakeCanonicalLead|notifyUniversalLeadAvailable/);
});
test('customer data and bearer Webhook do not appear in public HTML',()=>{
  const page=readFileSync(new URL('../../public/meta-advertiser-recovery/index.html',import.meta.url),'utf8');
  assert.match(page,/advertiserStatus/);
  assert.match(page,/confirmedNotReceived/);
  assert.match(page,/type="password"/);
  assert.doesNotMatch(page,/ctwh_XHQF78|localStorage|sessionStorage/);
});


test('server never replays REVIEW advertiser leads without operator confirmation',()=>{
  const server=readFileSync(new URL('../../functions/api/integrations/meta-sheets/relay.js',import.meta.url),'utf8');
  assert.match(server,/ad_status='PENDING' ORDER BY created_at LIMIT 10/);
  assert.doesNotMatch(server,/oneTimeRecovery/);
  assert.doesNotMatch(server,/OR \(event_id='meta-l1870743443942053'/);
});
test('successful Make blueprint request exactly matches current advertiser fields',async()=>{
  const { advertiserForm } = await import('../../functions/api/integrations/meta-sheets/relay.js');
  const encoded=advertiserForm({
    name:'임의 테스트',phone:'01012345678',money:'2000만원 이상',
    area:'서울',calldate:'오후 3시',content:'개인회생 상담',email:'private@example.com'
  },'64');
  const form=new URLSearchParams(encoded);
  assert.deepEqual([...form.keys()],[
    'ITEM','DATAS_name','DATAS_phone','DATAS_money',
    'DATAS_area','DATAS_calldate','DATAS_data'
  ]);
  assert.equal(form.get('ITEM'),'64');
  assert.equal(form.get('DATAS_phone'),'010-1234-5678');
  assert.equal(form.get('DATAS_name'),'임의 테스트');
  assert.equal(form.get('DATAS_area'),'서울');
  assert.equal(form.has('DATAS_email'),false);
  assert.equal(form.has('DATAS_insert_ad'),false);
  assert.deepEqual([...new URLSearchParams(advertiserForm({phone:'01012345678'},'64')).keys()],[
    'ITEM','DATAS_name','DATAS_phone','DATAS_money','DATAS_area','DATAS_calldate','DATAS_data'
  ]);
});

test('CallTag push and advertiser POST run independently, without head-of-line blocking',()=>{
  const src=readFileSync(new URL('../../functions/api/integrations/meta-sheets/relay.js',import.meta.url),'utf8');
  assert.match(src,/const deliveries = \[\]/);
  assert.match(src,/deliveries\.push\(sendAdvertiser\(/);
  assert.match(src,/deliveries\.push\(sendCallTag\(/);
  assert.match(src,/Promise\.allSettled\(deliveries\)/);
});
