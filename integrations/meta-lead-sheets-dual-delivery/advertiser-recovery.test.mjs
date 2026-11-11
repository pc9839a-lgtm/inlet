import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequest } from '../../functions/api/integrations/meta-sheets/recovery.js';
import { advertiserForm } from '../../functions/api/integrations/meta-sheets/relay.js';
import {
  responsePreview, redactAdvertiserText, requestShape, safeRedirect, safeDiagnosticHeaders
} from '../../functions/api/integrations/meta-sheets/advertiser-diagnostics.js';

const server=readFileSync(new URL('../../functions/api/integrations/meta-sheets/relay.js',import.meta.url),'utf8');
const recovery=readFileSync(new URL('../../functions/api/integrations/meta-sheets/recovery.js',import.meta.url),'utf8');
const diagnostics=readFileSync(new URL('../../functions/api/integrations/meta-sheets/advertiser-diagnostics.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../../public/meta-advertiser-recovery/index.html',import.meta.url),'utf8');
const endpoint='https://pagero.kr/api/integrations/meta-sheets/recovery';

test('only status and safe HEAD probe are available; no POST resend action',()=>{
  assert.match(recovery,/probe-connection/);
  assert.doesNotMatch(recovery,/retry-advertiser|advertiserForm\(|confirmedNotReceived/);
  assert.match(recovery,/\['HEAD',-1\],\['GET',0\]/);
  assert.match(recovery,/method,redirect:'manual'/);
  assert.doesNotMatch(recovery,/method:'POST'[\s\S]{0,300}body:advertiserForm/);
  assert.match(ui,/HEAD \+ GET · 고객정보 전송 안 함/);
  assert.doesNotMatch(ui,/retry-advertiser|고객 1건 전송/);
});
test('historical advertiser retries are completely disabled, future PENDING still sent',()=>{
  assert.doesNotMatch(server,/APPROVED_ADVERTISER_RECOVERY_EVENT_ID/);
  assert.doesNotMatch(server,/approvedOneTimeReplay/);
  assert.match(server,/record.ad_status === 'PENDING'/);
  assert.match(server,/recordAdvertiserHttpLog/);
  assert.match(server,/responsePreview/);
});
test('diagnostics redact customer email, phone, name and webhook key',()=>{
  const raw='김테스트 님 010-1234-5678 / test@example.com ctwh_supersecret99999';
  const out=redactAdvertiserText(raw,{
    name:'김테스트',phone:'01012345678',email:'test@example.com'
  });
  assert.doesNotMatch(out,/김테스트|010-1234|test@example.com|ctwh_supersecret99999/);
  assert.match(out,/REDACTED|PHONE/);
});
test('logs retain useful JSON error codes but no exact submitted field values',()=>{
  const out=responsePreview(JSON.stringify({
    status:'ERROR',error_code:'INVALID_AREA',message:'010-1234-5678 연락처가 포함됨',
    raw_customer_name:'김테스트'
  }), 'application/json', {name:'김테스트',phone:'01012345678'});
  assert.match(out,/INVALID_AREA/);
  assert.doesNotMatch(out,/010-1234|김테스트/);
  assert.doesNotMatch(out,/raw_customer_name/);
});
test('request shape only includes field names, not customer values',()=>{
  const shape=requestShape({name:'김테스트',phone:'01012345678',money:'3000만원',
    area:'',calldate:'오후',content:'문의내용'},'64');
  assert.deepEqual(shape.empty,['DATAS_area']);
  assert.equal(shape.item,'64');
  assert.doesNotMatch(JSON.stringify(shape),/김테스트|01012345678|3000만원/);
});
test('redirect displays host/path only without query tokens',()=>{
  const out=safeRedirect('https://ollymkt.shop/auth/login?secret=private#x','https://ollymkt.shop/dbapi/');
  assert.deepEqual(out,{host:'ollymkt.shop',path:'/auth/login'});
});
test('diagnostic logs are durable per attempt, no raw POST payload retained',()=>{
  assert.match(diagnostics,/CREATE TABLE IF NOT EXISTS meta_sheet_advertiser_http_logs/);
  assert.match(diagnostics,/http_status/);
  assert.match(diagnostics,/response_preview/);
  assert.match(diagnostics,/exception_code/);
  assert.match(diagnostics,/empty_fields/);
  assert.doesNotMatch(diagnostics,/request_payload|payload_json/);
});
test('recovery is forbidden for GET and unauthorized POST without reading customer records',async()=>{
  const get=await onRequest({request:new Request(endpoint),env:{}});
  assert.equal(get.status,405);
  const accessed=[];
  const db={prepare(sql){accessed.push(sql);throw Error('unauthorized must not perform SQL')}};
  const request=new Request(endpoint,{method:'POST',
    headers:{'X-Meta-Relay-Token':'ctwh_fakeinvalid111111111111111111'},
    body:JSON.stringify({action:'probe-connection'})});
  const unauthorized=await onRequest({request,env:{DB:db}});
  assert.equal(unauthorized.status,401);
  assert.equal(accessed.length,0);
});
test('previous Make request seven fields are preserved',()=>{
  const form=new URLSearchParams(advertiserForm({name:'test',phone:'01012345678',
    money:'2천만원',area:'',calldate:'오후',content:'상담',email:'ignore@example.com'}));
  assert.deepEqual([...form.keys()],['ITEM','DATAS_name','DATAS_phone',
    'DATAS_money','DATAS_area','DATAS_calldate','DATAS_data']);
  assert.equal(form.get('ITEM'),'64');
  assert.equal(form.has('DATAS_email'),false);
});

test('GET and HEAD safe probes store only header allowlist and do not create advertiser POST',()=>{
  assert.match(recovery,/method==='GET' \? \(await response.text\(\)\)/);
  assert.match(recovery,/safeDiagnosticHeaders\(response.headers\)/);
  assert.match(recovery,/await recordAdvertiserHttpLog\(db,entry\)/);
  const headers=new Headers({
    server:'nginx', 'cf-ray':'abc123-ICN', 'allow':'POST',
    'set-cookie':'user=private', 'authorization':'Bearer secret'
  });
  const result=safeDiagnosticHeaders(headers);
  assert.equal(result.server,'nginx');
  assert.equal(result['cf-ray'],'abc123-ICN');
  assert.equal(result.allow,'POST');
  assert.equal(result['set-cookie'],undefined);
  assert.equal(result.authorization,undefined);
});

test('advertiser POST follows redirects as in Make blueprint while HEAD/GET diagnostic remains no-lead',()=>{
  assert.match(server,/redirect:'follow', \/\/ Mirror Make blueprint followRedirect=true/);
  assert.match(server,/export const ADVERTISER_ITEM = '64'/);
  assert.match(recovery,/item:ADVERTISER_ITEM/);
  assert.match(server,/method:'POST'/);
  assert.match(server,/ad_status === 'PENDING'/);
  assert.doesNotMatch(recovery,/retry-advertiser/);
});

test('production advertiser and diagnostics cannot use deprecated ITEM 40 or 41',()=>{
  assert.doesNotMatch(server,/env\.META_SHEETS_ADVERTISER_ITEM/);
  assert.doesNotMatch(recovery,/env\.META_SHEETS_ADVERTISER_ITEM/);
  assert.match(server,/form\.set\('ITEM', ADVERTISER_ITEM\)/);
  assert.match(server,/return \{ advertiser: advertiser\.href, item: ADVERTISER_ITEM, advertiserTransport \}/);
  assert.match(recovery,/const shape=requestShape\(source,ADVERTISER_ITEM\)/);
});
