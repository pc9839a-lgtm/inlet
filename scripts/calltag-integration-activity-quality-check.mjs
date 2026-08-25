import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { listIntegrationActivity, publicActivityEvent, publicAuditFailure } from '../functions/api/calltag/v1/_activity.js';

const routeFile='functions/api/calltag/v1/activity.js';
const serverFile='functions/api/calltag/v1/_activity.js';
const directFile='functions/api/calltag/v1/leads.js';
const webhookFile='functions/api/calltag/v1/hooks/[endpointKey].js';
const htmlFile='public/call/connect/index.html';
const jsFile='public/call/connect/activity.js';
const cssFile='public/call/connect/hub.css';
const [route,server,direct,webhook,html,js,css]=await Promise.all([
  readFile(routeFile,'utf8'),readFile(serverFile,'utf8'),readFile(directFile,'utf8'),readFile(webhookFile,'utf8'),
  readFile(htmlFile,'utf8'),readFile(jsFile,'utf8'),readFile(cssFile,'utf8'),
]);

assert.match(route,/const METHODS = 'GET, OPTIONS'/,'Activity route must be GET only');
assert.ok(route.includes('callSession(request, env, {})'),'Activity route must derive owner from signed CallTag session');
assert.ok(route.includes('listIntegrationActivity(db, session.ownerId'),'Activity route must scope query to authenticated owner');
assert.doesNotMatch(server,/ensureUniversalLeadSchema|CREATE\s+TABLE|\bUPDATE\b|\bINSERT\b|\bDELETE\b/i,'Activity server must remain strictly read only');
assert.ok(server.includes("const where = ['owner_id = ?']"),'Activity query must always start owner-scoped');
assert.ok(server.includes('maskPhone(row?.customer_phone)'),'Activity response must mask phone server-side');
assert.ok(server.includes("pageroLegacy ? 'PAGERO_LEGACY'"),'PageRo must be separated from universal ACK diagnostics');
assert.ok(server.includes('FROM calltag_lead_audit'),'Activity must reuse the existing lead audit table');
assert.ok(server.includes("const E2E_SOURCE_TYPE = 'calltag_e2e_test'"),'Activity must identify synthetic E2E source explicitly');
assert.ok(server.includes("AND lower(source_type) != ?"),'Operational summary/failures must exclude synthetic E2E probes');
assert.ok(server.includes('summaryExcludesTest: true'),'Activity response must disclose test exclusion semantics');
assert.ok(server.includes('LIMIT 20'),'Recent failure view must remain bounded');

const fixture=publicActivityEvent({
  id:11,event_id:'evt_11',connection_id:'conn_1',source_type:'custom_webhook',source_name:'보험폼',provider:'custom_webhook',
  customer_name:'홍길동',customer_phone:'010-1234-5678',inquiry_content:'보험 상담을 원합니다.',status:'IMPORTED',
  delivered_at:'2026-08-25T01:00:00.000Z',imported_at:'2026-08-25T01:01:00.000Z',created_at:'2026-08-25T00:59:00.000Z',updated_at:'2026-08-25T01:01:00.000Z',
});
assert.equal(fixture.customer.phoneMasked,'010****5678');
assert.equal(fixture.customer.phone,undefined,'Raw phone must not be exposed');
assert.equal(fixture.stage,'IMPORTED');

const failureFixture=publicAuditFailure({
  id:91,request_id:'ray_1',event_id:'evt_91',action:'lead.push',result:'CALLTAG_PUSH_FAILED',source_type:'direct_api',status_code:503,created_at:'2026-08-25T01:02:00.000Z',
  customer_name:'절대 노출 금지',customer_phone:'01012345678',email:'secret@example.com',inquiry_content:'민감 문의',
});
assert.deepEqual(Object.keys(failureFixture).sort(),['action','code','createdAt','eventId','id','requestId','sourceType','statusCode'].sort());
assert.equal(failureFixture.code,'CALLTAG_PUSH_FAILED');
assert.equal(failureFixture.customer_name,undefined);
assert.equal(failureFixture.customer_phone,undefined);
assert.equal(failureFixture.email,undefined);
assert.equal(failureFixture.inquiry_content,undefined);

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
        if(normalized.includes('lower(source_type) != ?'))assert.equal(args[1],'calltag_e2e_test','Test exclusion must use the explicit E2E source type');
        return {
          async all(){
            if(normalized.includes('GROUP BY status'))return {results:[{status:'ACCEPTED',count:2},{status:'IMPORTED',count:3}]};
            if(normalized.includes('GROUP BY lower(source_type)'))return {results:[{source_type:'custom_webhook',count:5},{source_type:'calltag_e2e_test',count:1}]};
            if(normalized.includes('FROM calltag_lead_audit'))return {results:[{id:7,request_id:'ray_7',event_id:'evt_7',action:'webhook.push',result:'CALLTAG_PUSH_FAILED',source_type:'custom_webhook',status_code:503,created_at:'2026-08-25T01:03:00.000Z'}]};
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
assert.equal(result.summaryExcludesTest,true);
assert.deepEqual(result.summary,{accepted:2,delivered:0,imported:3,rejected:0,total:5});
assert.equal(result.events[0].customer.phoneMasked,'010****2222');
assert.equal(result.failures.length,1);
assert.equal(result.failures[0].action,'webhook.push');
assert.equal(result.failures[0].code,'CALLTAG_PUSH_FAILED');
assert.ok(statements.length===4,'Activity should use exactly four bounded read queries');
for(const sql of statements)assert.match(sql.trim(),/^SELECT\b/i,'Activity DB operation must be SELECT only');

// FCM remains best effort: intake acceptance is preserved while a safe, PII-free audit record is added.
for(const token of ["action: 'lead.push'",'result: pushCode','statusCode: 503','notifyUniversalLeadAvailable','recordLeadAudit']){
  assert.ok(direct.includes(token),`Direct API push audit contract missing: ${token}`);
}
assert.ok(direct.includes('return jsonResponse(request, env, status'),'Direct API must still return accepted intake after best-effort push handling');
for(const token of ["action: 'webhook.push'","sourceType: 'custom_webhook'",'statusCode: 503','sha256(endpointKey)','SELECT owner_id','calltag_webhook_connections']){
  assert.ok(webhook.includes(token),`Webhook push audit contract missing: ${token}`);
}
assert.ok(webhook.includes('return jsonResponse(request, env, 202, result'),'Webhook must remain accepted even if its best-effort FCM signal fails');
assert.doesNotMatch(webhook,/body\?\.owner|body\.owner|ownerId\s*=\s*body/,'Webhook tenant identity must never come from payload');

for(const token of ['activityDetail','연동 활동','읽기 전용','자동 새로고침하지 않습니다.','/api/calltag/v1/activity','activity.js']){
  assert.ok(html.includes(token),`Activity UI contract missing: ${token}`);
}
for(const token of ['ACTIVITY_ENDPOINT','limit:\'50\'','sourceType','status','phoneMasked','PAGERO_LEGACY','서버 수신','앱 가져감','가져오기 완료','새로고침','activityRenderFailures','activityFailureList','최근 실패','summaryExcludesTest']){
  assert.ok(js.includes(token),`Activity client contract missing: ${token}`);
}
assert.doesNotMatch(js,/setInterval|setTimeout\s*\([^,]+,\s*[0-9]{3,}/,'Activity diagnostics must not auto-poll');
assert.doesNotMatch(js,/localStorage\.setItem|sessionStorage\.setItem/,'Activity diagnostics must not persist lead/audit data in browser storage');
assert.ok(!js.includes('innerHTML'),'Activity diagnostics must render dynamic values without innerHTML');
assert.doesNotThrow(()=>new Function(js),'Activity browser script must parse');
assert.ok(css.includes('.activity-summary')&&css.includes('.activity-timeline'),'Activity mobile UI styles must exist');
assert.ok(css.includes('@media(max-width:420px)'),'Activity UI must retain small-screen responsive contract');

console.log(JSON.stringify({
  ok:true,
  phase:'CallTag Integration Activity + Failure Audit',
  contracts:[
    'strict-read-only-selects',
    'signed-owner-scoped-query',
    'server-side-phone-masking',
    'pagero-legacy-status-isolation',
    'e2e-excluded-from-operational-summary',
    'bounded-pii-free-recent-failures',
    'best-effort-push-failure-audit',
    'webhook-owner-derived-from-endpoint-secret',
    'manual-refresh-only',
    'source-and-status-filters',
    'no-lead-browser-storage',
    'text-only-dynamic-rendering',
    'mobile-responsive-activity-view',
  ],
},null,2));
