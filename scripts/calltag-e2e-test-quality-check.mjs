import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createE2eLead, e2eReadiness, getE2eStatus } from '../functions/api/calltag/v1/_e2e.js';

const files={
  route:'functions/api/calltag/v1/e2e.js',
  core:'functions/api/calltag/v1/_e2e.js',
  client:'public/call/connect/e2e.js',
  activity:'public/call/connect/activity.js',
};
const [route,core,client,activity]=await Promise.all(Object.values(files).map((file)=>readFile(file,'utf8')));

assert.match(route,/const METHODS = 'GET, POST, OPTIONS'/,'E2E route should expose only GET/POST');
assert.ok(route.includes('callSession(request, env'),'E2E route must require signed CallTag session');
assert.ok(core.includes("CALLTAG_E2E_TEST_ENABLED"),'E2E execution must be environment-gated');
assert.ok(core.includes("CREATE_CALLTAG_E2E_TEST_LEAD"),'E2E execution must require explicit confirmation phrase');
assert.ok(core.includes("calltag_e2e_test"),'E2E events must use a dedicated source type');
assert.ok(core.includes('normalizePhone(rawPhone)'),'E2E execution must validate an explicit user phone');
assert.ok(core.includes('notifyUniversalLeadAvailable'),'E2E must reuse the privacy-minimal universal FCM signal');
assert.ok(core.includes("action: 'e2e.push'"),'E2E push attempt must be auditable');
assert.ok(!core.includes('pagero_lead_available'),'E2E must never use the legacy PageRo push path');

assert.deepEqual(e2eReadiness({}),{
  enabled:false,
  firebaseConfigured:false,
  confirmPhrase:'CREATE_CALLTAG_E2E_TEST_LEAD',
  sourceType:'calltag_e2e_test',
});

await assert.rejects(
  ()=>createE2eLead({}, {prepare(){throw new Error('DB must not be touched while disabled')}}, 'owner_test', {confirm:'CREATE_CALLTAG_E2E_TEST_LEAD',phone:'01012345678'}),
  (error)=>error?.details?.code==='CALLTAG_E2E_DISABLED'||error?.code==='CALLTAG_E2E_DISABLED',
  'Disabled E2E mode must reject before touching D1',
);

const statements=[];
const fakeDb={
  prepare(sql){
    const normalized=String(sql).replace(/\s+/g,' ').trim();
    statements.push(normalized);
    return {
      bind(...args){
        assert.equal(args[0],'owner_test','Every E2E status query must bind authenticated owner first');
        return {
          async first(){
            if(normalized.includes('FROM calltag_lead_events'))return {
              id:7,event_id:'ct_e2e_evt',external_id:'cte2e_abcdef123456',source_type:'calltag_e2e_test',source_name:'CallTag E2E Test',
              customer_name:'테스트',customer_phone:'010-1234-5678',inquiry_content:'테스트 문의',status:'IMPORTED',
              delivered_at:'2026-08-25T02:00:00.000Z',imported_at:'2026-08-25T02:01:00.000Z',submitted_at:Date.now(),created_at:'2026-08-25T01:59:00.000Z',updated_at:'2026-08-25T02:01:00.000Z',result:'CALLTAG_LEAD',
            };
            return {action:'e2e.push',result:'PUSH_1_OF_1',status_code:200,created_at:'2026-08-25T01:59:01.000Z'};
          },
        };
      },
    };
  },
};
const status=await getE2eStatus(fakeDb,'owner_test','cte2e_abcdef123456');
assert.equal(status.stage,'IMPORTED');
assert.equal(status.customer.phoneMasked,'010****5678');
assert.equal(status.customer.phone,undefined,'Raw phone must never be returned by E2E status');
assert.equal(status.push.result,'PUSH_1_OF_1');
assert.equal(statements.length,2,'E2E status should use exactly two read queries');
for(const sql of statements)assert.match(sql,/^SELECT\b/i,'E2E status queries must be SELECT-only');

for(const token of [
  "const E2E_ENDPOINT='/api/calltag/v1/e2e'",
  "const E2E_CONFIRM='CREATE_CALLTAG_E2E_TEST_LEAD'",
  '테스트 전화번호',
  '테스트 문의 생성',
  '상태 확인',
  'CALLTAG_E2E_TEST_ENABLED=1',
  'phoneMasked',
  "method:'POST'",
  'encodeURIComponent(e2eLastRunId)',
])assert.ok(client.includes(token),`E2E client contract missing: ${token}`);

assert.ok(activity.includes("e2eScript.src='/call/connect/e2e.js'"),'Activity tab must load E2E controls');
assert.ok(activity.includes("calltag_e2e_test:'CallTag E2E Test'"),'Activity source labels must identify E2E events');
assert.doesNotMatch(client,/setInterval|setTimeout\s*\(/,'E2E client must not auto-poll');
assert.doesNotMatch(client,/localStorage\.setItem|sessionStorage\.setItem/,'E2E client must not persist test lead data');
assert.ok(!client.includes('innerHTML'),'E2E client must render dynamic values without innerHTML');
assert.doesNotThrow(()=>new Function(client),'E2E browser script must parse');

console.log(JSON.stringify({
  ok:true,
  phase:'CallTag guarded E2E test harness',
  contracts:[
    'disabled-by-default-env-gate',
    'explicit-confirmation-phrase',
    'explicit-test-phone-required',
    'dedicated-test-source',
    'signed-owner-scope',
    'pii-free-universal-fcm-reuse',
    'audited-push-attempt',
    'read-only-status-check',
    'server-side-phone-masking',
    'manual-status-refresh-only',
    'no-test-data-browser-storage',
  ],
},null,2));
