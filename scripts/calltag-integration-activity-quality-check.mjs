import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { listIntegrationActivity, publicActivityEvent } from '../functions/api/calltag/v1/_activity.js';

const routeFile='functions/api/calltag/v1/activity.js';
const serverFile='functions/api/calltag/v1/_activity.js';
const htmlFile='public/call/connect/index.html';
const jsFile='public/call/connect/activity.js';
const cssFile='public/call/connect/hub.css';
const [route,server,html,js,css]=await Promise.all([
  readFile(routeFile,'utf8'),readFile(serverFile,'utf8'),readFile(htmlFile,'utf8'),readFile(jsFile,'utf8'),readFile(cssFile,'utf8'),
]);

assert.match(route,/const METHODS = 'GET, OPTIONS'/,'Activity route must be GET only');
assert.ok(route.includes('callSession(request, env, {})'),'Activity route must derive owner from signed CallTag session');
assert.ok(route.includes('listIntegrationActivity(db, session.ownerId'),'Activity route must scope query to authenticated owner');
assert.doesNotMatch(server,/ensureUniversalLeadSchema|CREATE\s+TABLE|\bUPDATE\b|\bINSERT\b|\bDELETE\b/i,'Activity server must remain strictly read only');
assert.ok(server.includes("const where = ['owner_id = ?']"),'Activity query must always start owner-scoped');
assert.ok(server.includes('maskPhone(row?.customer_phone)'),'Activity response must mask phone server-side');
assert.ok(server.includes("pageroLegacy ? 'PAGERO_LEGACY'"),'PageRo must be separated from universal ACK diagnostics');

const fixture=publicActivityEvent({
  id:11,event_id:'evt_11',connection_id:'conn_1',source_type:'custom_webhook',source_name:'보험폼',provider:'custom_webhook',
  customer_name:'홍길동',customer_phone:'010-1234-5678',inquiry_content:'보험 상담을 원합니다.',status:'IMPORTED',
  delivered_at:'2026-08-25T01:00:00.000Z',imported_at:'2026-08-25T01:01:00.000Z',created_at:'2026-08-25T00:59:00.000Z',updated_at:'2026-08-25T01:01:00.000Z',
});
assert.equal(fixture.customer.phoneMasked,'010***5678');
assert.equal(fixture.customer.phone,undefined,'Raw phone must not be exposed');
assert.equal(fixture.stage,'IMPORTED');

const pagero=publicActivityEvent({source_type:'pagero',customer_phone:'01099998888',status:'ACCEPTED'});
assert.equal(pagero.stage,'PAGERO_LEGACY');
assert.equal(pagero.deliveryMode,'pagero_legacy');

const statements=[];
const fakeDb={
  prepare(sql){
    statements.push(String(sql));
    return {
      bind(...args){
        const normalized=String(sql).replace(/\s+/g,' ').trim();
        assert.equal(args[0],'owner_test','Every activity query must bind authenticated owner first');
        return {
          async all(){
            if(normalized.includes('GROUP BY status'))return {results:[{status:'ACCEPTED',count:2},{status:'IMPORTED',count:3}]};
            if(normalized.includes('GROUP BY lower(source_type)'))return {results:[{source_type:'custom_webhook',count:5}]};
            return {results:[{
              id:1,event_id:'evt_1',connection_id:'conn_1',source_type:'custom_webhook',source_name:'폼',provider:'custom_webhook',customer_name:'고객',customer_phone:'01011112222',inquiry_content:'문의',status:'ACCEPTED',created_at:'2026-08-25T01:00:00.000Z',updated_at:'2026-08-25T01:00:00.000Z',
            }]};
          },
        };
      },
    };
  },
};
const result=await listIntegrationActivity(fakeDb,'owner_test',{limit:50});
assert.equal(result.readOnly,true);
assert.deepEqual(result.summary,{accepted:2,delivered:0,imported:3,rejected:0,total:5});
assert.equal(result.events[0].customer.phoneMasked,'010***2222');
assert.ok(statements.length===3,'Activity should use exactly three read queries');
for(const sql of statements)assert.match(sql.trim(),/^SELECT\b/i,'Activity DB operation must be SELECT only');

for(const token of ['activityDetail','연동 활동','읽기 전용','자동 새로고침하지 않습니다.','/api/calltag/v1/activity','activity.js']){
  assert.ok(html.includes(token),`Activity UI contract missing: ${token}`);
}
for(const token of ['ACTIVITY_ENDPOINT','limit:\'50\'','sourceType','status','phoneMasked','PAGERO_LEGACY','서버 수신','앱 가져감','가져오기 완료','새로고침']){
  assert.ok(js.includes(token),`Activity client contract missing: ${token}`);
}
assert.doesNotMatch(js,/setInterval|setTimeout\s*\([^,]+,\s*[0-9]{3,}/,'Activity diagnostics must not auto-poll');
assert.doesNotMatch(js,/localStorage\.setItem|sessionStorage\.setItem/,'Activity diagnostics must not persist lead data in browser storage');
assert.ok(!js.includes('innerHTML'),'Activity diagnostics must render dynamic values without innerHTML');
assert.doesNotThrow(()=>new Function(js),'Activity browser script must parse');
assert.ok(css.includes('.activity-summary')&&css.includes('.activity-timeline'),'Activity mobile UI styles must exist');
assert.ok(css.includes('@media(max-width:420px)'),'Activity UI must retain small-screen responsive contract');

console.log(JSON.stringify({
  ok:true,
  phase:'CallTag Integration Activity Diagnostics',
  contracts:[
    'strict-read-only-selects',
    'signed-owner-scoped-query',
    'server-side-phone-masking',
    'pagero-legacy-status-isolation',
    'manual-refresh-only',
    'source-and-status-filters',
    'no-lead-browser-storage',
    'text-only-dynamic-rendering',
    'mobile-responsive-activity-view',
  ],
},null,2));
