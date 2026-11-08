import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Script, createContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizePhone, normalizeSheetLead, advertiserForm, explicitAdvertiserSuccess, onRequest } from '../../functions/api/integrations/meta-sheets/relay.js';

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)),'Code.gs'),'utf8');
const headers = ['id','created_time','ad_id','ad_name','adset_id','adset_name',
  'campaign_id','campaign_name','form_id','form_name','is_organic','platform',
  '총_채무액(2,000만원_이상_가능)','상담가능시간','문의내용(ex개인회생/파산_등)',
  'full_name','phone_number','lead_status'];
const lead = {id:'l:2013932282624321',created_time:'2026-11-08T07:23:31-05:00',
  '총_채무액(2,000만원_이상_가능)':'3000만원',상담가능시간:'오후',
  '문의내용(ex개인회생/파산_등)':'개인회생 상담',full_name:'샘플',
  phone_number:'P:+821023456789',lead_status:'CREATED'};
const dummy = {...lead,full_name:'<test lead: dummy data for full_name>'};

function mockGas(initial){
  const rows=initial.map(r=>r.slice()),props=new Map(),calls=[],triggers=[];
  const sheet={getLastRow:()=>rows.length,getRange(r,c,h=1,w=1){
    return {getDisplayValues:()=>Array.from({length:h},(_,i)=>
      Array.from({length:w},(_,j)=>rows[r-1+i]?.[c-1+j]??''))};
  }};
  const property={getProperty:k=>props.get(k)||'',setProperty:(k,v)=>props.set(k,String(v))};
  const context=createContext({
    PropertiesService:{getScriptProperties:()=>property},
    SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:()=>sheet})},
    ScriptApp:{getProjectTriggers:()=>triggers,deleteTrigger:t=>{const i=triggers.indexOf(t);if(i>=0)triggers.splice(i,1);},
      newTrigger:name=>({timeBased:()=>({everyMinutes:minutes=>({create:()=>triggers.push({minutes,getHandlerFunction:()=>name})})})})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
    UrlFetchApp:{fetch:(url,options)=>{
      const body=JSON.parse(options.payload);calls.push({url,options,body});
      return {getResponseCode:()=>props.get('FAIL')==='1'?503:202,
        getContentText:()=>JSON.stringify({ok:true,accepted:body.rows.length})};
    }},
    console:{log(){}}
  });
  new Script(source).runInContext(context);
  return {rows,props,calls,triggers,context};
}
function fakeDb(){
  const stored=new Map();
  return {stored,prepare:sql=>({
    args:[],bind(...args){this.args=args;return this;},
    async run(){
      if(sql.includes('INSERT OR IGNORE INTO meta_sheet_dual_queue')&&!stored.has(this.args[0]))
        stored.set(this.args[0],this.args[1]);
      return {meta:{changes:1}};
    },
    async all(){return {results:[]};},
    async first(){return this.args && typeof this.args[0] === 'string' && this.args[0].length === 64 ? {id:'fake-active-webhook'} : null;}
  })};
}
const FAKE_WEBHOOK_KEY='ctwh_fake12345678901234567890';
const FAKE_WEBHOOK_URL='https://pagero.kr/api/calltag/v1/hooks/'+FAKE_WEBHOOK_KEY;
const config={
  META_SHEETS_EXPECTED_ENDPOINT_HASH:createHash('sha256').update(FAKE_WEBHOOK_KEY).digest('hex'),
  META_SHEETS_DISPATCH_ENABLED:'1'
};

test('GAS is only a Cloudflare connector, never an advertiser/CallTag client',()=>{
  assert.doesNotThrow(()=>new Script(source));
  assert.match(source,/META_RELAY_ENDPOINT/);
  assert.doesNotMatch(source,/ollymkt|DATAS_|ctwh_XHQF/);
  assert.match(source,/getProperty\('CALLTAG_WEBHOOK_URL'\)/);
});
test('install skips old rows and creates one 1-minute trigger',()=>{
  const x=mockGas([headers,headers.map(h=>dummy[h]??'')]);
  x.context.installMetaRelay();
  assert.equal(x.props.get('META_RELAY_CURSOR'),'2');
  assert.equal(x.triggers[0].minutes,1);
  assert.equal(x.calls.length,0);
});
test('new row forwarded to Cloudflare; no duplicate after ACK; heartbeat on idle',()=>{
  const x=mockGas([headers,headers.map(h=>dummy[h]??'')]);
  x.context.installMetaRelay();x.props.set('CALLTAG_WEBHOOK_URL',FAKE_WEBHOOK_URL);
  x.rows.push(headers.map(h=>lead[h]??''));
  x.context.relayMetaLeads();
  assert.equal(x.calls.length,1);
  assert.equal(x.calls[0].body.rows[0].id,lead.id);
  assert.match(x.calls[0].url,/\/meta-sheets\/relay$/);
  assert.equal(x.props.get('META_RELAY_CURSOR'),'3');
  x.context.relayMetaLeads();
  assert.equal(x.calls[1].body.rows.length,0);
});
test('GAS retries same row after server 503 without cursor advance',()=>{
  const x=mockGas([headers]);x.context.installMetaRelay();
  x.props.set('CALLTAG_WEBHOOK_URL',FAKE_WEBHOOK_URL);x.props.set('FAIL','1');
  x.rows.push(headers.map(h=>lead[h]??''));
  assert.throws(()=>x.context.relayMetaLeads(),/접수 확인 실패/);
  assert.equal(x.props.get('META_RELAY_CURSOR'),'1');
  x.props.delete('FAIL');x.context.relayMetaLeads();
  assert.equal(x.props.get('META_RELAY_CURSOR'),'2');
  assert.equal(x.calls.length,2);
});
test('Cloudflare handles Meta field mapping, Make-compatible phone and advertiser form',()=>{
  assert.equal(normalizePhone('P:+821023456789'),'01023456789');
  const mapped=normalizeSheetLead(lead);
  assert.equal(mapped.eventId,'meta-l2013932282624321');
  assert.equal(mapped.money,'3000만원');
  assert.equal(mapped.content,'개인회생 상담');
  assert.match(advertiserForm(mapped),/ITEM=64/);
  assert.match(advertiserForm(mapped),/DATAS_phone=010-2345-6789/);
  assert.equal(normalizeSheetLead(dummy),null);
});
test('advertiser response must be explicit and unknown 200 is not proof',()=>{
  assert.equal(explicitAdvertiserSuccess(200,'OK'),true);
  assert.equal(explicitAdvertiserSuccess(200,'{"ok":true}'),true);
  assert.equal(explicitAdvertiserSuccess(200,'<html>unknown</html>'),false);
  assert.equal(explicitAdvertiserSuccess(503,'OK'),false);
});
test('Cloudflare relay fails closed without secrets or with wrong token',async()=>{
  const request=new Request('https://pagero.kr/api/integrations/meta-sheets/relay',
    {method:'POST',body:'{"rows":[]}'});
  assert.equal((await onRequest({request,env:{...config,META_SHEETS_DISPATCH_ENABLED:'0'},ctx:{}})).status,503);
  assert.equal((await onRequest({request,env:{...config,DB:fakeDb()},ctx:{}})).status,401);
});
test('Cloudflare accepts and deduplicates valid lead, omits Meta test lead',async()=>{
  const db=fakeDb(),tasks=[];
  const makeRequest=()=>new Request('https://pagero.kr/api/integrations/meta-sheets/relay',{
    method:'POST',headers:{'X-Meta-Relay-Token':FAKE_WEBHOOK_URL},
    body:JSON.stringify({rows:[lead,dummy]})});
  const ctx={waitUntil:promise=>tasks.push(promise)};
  const first=await onRequest({request:makeRequest(),env:{...config,DB:db},ctx});
  assert.equal(first.status,202);
  assert.equal((await first.json()).accepted,2);
  await Promise.all(tasks.splice(0));
  assert.equal(db.stored.size,1);
  const second=await onRequest({request:makeRequest(),env:{...config,DB:db},ctx});
  assert.equal(second.status,202);
  await Promise.all(tasks);
  assert.equal(db.stored.size,1);
});

test('a malformed real lead rejects the batch instead of losing a customer',async()=>{
  const db=fakeDb(),tasks=[];
  const invalid={...lead,phone_number:'not-a-phone'};
  const request=new Request('https://pagero.kr/api/integrations/meta-sheets/relay',{
    method:'POST',
    headers:{'X-Meta-Relay-Token':FAKE_WEBHOOK_URL},
    body:JSON.stringify({rows:[lead,invalid]})
  });
  const response=await onRequest({request,env:{...config,DB:db},
    ctx:{waitUntil:promise=>tasks.push(promise)}});
  assert.equal(response.status,422);
  const result=await response.json();
  assert.equal(result.error,'INVALID_LEAD_ROW');
  assert.equal(result.rowIndex,1);
  assert.equal(db.stored.size,0,'validation must happen before any inserts');
  assert.equal(tasks.length,0);
});


test('WebHook credential is required, wrong key rejected, unrelated WebHook rejected',async()=>{
  const db=fakeDb();
  const base='https://pagero.kr/api/integrations/meta-sheets/relay';
  const send=(token)=>new Request(base,{method:'POST',headers:{'X-Meta-Relay-Token':token},body:'{"rows":[]}'});
  assert.equal((await onRequest({request:send('garbage'),env:{...config,DB:db},ctx:{}})).status,401);
  assert.equal((await onRequest({request:send('ctwh_otherFake12345678901234567890'),env:{...config,DB:db},ctx:{}})).status,401);
  const allowed=await onRequest({request:send(FAKE_WEBHOOK_URL),env:{...config,DB:db},ctx:{}});
  assert.equal(allowed.status,202);
});
