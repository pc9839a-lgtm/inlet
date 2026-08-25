import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, js, css] = await Promise.all([
  readFile('public/call/connect/index.html', 'utf8'),
  readFile('public/call/connect/google-forms-guide.js', 'utf8'),
  readFile('public/call/connect/google-forms-guide.css', 'utf8'),
]);

for (const token of [
  'Google Forms',
  'id="openGoogleForms"',
  'id="googleFormsDetail"',
  'id="prepareGoogleFormsWebhook"',
  'id="openGoogleFormsMapper"',
  'id="googleFormsCode"',
  '/call/connect/google-forms-guide.css',
  '/call/connect/google-forms-guide.js',
]) {
  assert.ok(html.includes(token), `Google Forms Connect UI contract missing: ${token}`);
}

assert.doesNotMatch(html, /Naver|Kakao/i, 'Unsupported Naver/Kakao placeholders must not be shown in CallTag Connect');

for (const token of [
  "const GOOGLE_FORMS_SOURCE='Google Forms'",
  "source.value=GOOGLE_FORMS_SOURCE",
  "name.value='Google Forms'",
  "showDetail('webhookDetail')",
  'ScriptApp.newTrigger',
  '.forForm(form)',
  '.onFormSubmit()',
  'UrlFetchApp.fetch',
  "'Idempotency-Key': responseId",
  "source: 'google_forms'",
  '<YOUR_CALLTAG_WEBHOOK_URL>',
  "let transientEndpointUrl=''",
  'function endpointLiteral',
  'JSON.stringify(endpoint)',
  'function captureSecretIfGoogleForms',
  "querySelector('.secret-value')",
  "event?.detail?.area==='secret'",
  "showDetail('googleFormsDetail')",
  'URL 포함 Apps Script 복사',
  'function clearTransientEndpoint',
  'new MutationObserver',
  "authObserver.observe(loginPanel,{attributes:true,attributeFilter:['class']})",
  'function googleFormsReadiness',
  'function renderGoogleFormsConnections',
  'data.googleFormsAutoMap',
  '추천 매핑 자동 설정',
  'function autoMapGoogleForms',
  '/samples?limit=5',
  'draftMapping?.phone',
  "action:'update_mapping'",
  'function mergeSuggestedMapping',
]) {
  assert.ok(js.includes(token), `Google Forms bridge contract missing: ${token}`);
}

assert.ok(html.includes('전화번호 필드를 지정합니다.'), 'Google Forms setup must require phone mapping before production use');
assert.ok(html.includes('Webhook URL 자체가 비밀값입니다.'), 'Google Forms setup must warn that the endpoint URL is a secret');
assert.ok(html.includes('Google Forms API + Pub/Sub 기반 완전 자동 연결은 준비 중입니다.'), 'Native Google Forms status must be described honestly');
assert.doesNotMatch(js, /localStorage|sessionStorage/, 'Google Forms bridge guide must not persist endpoint secrets in browser storage');
assert.doesNotMatch(js, /innerHTML/, 'Google Forms bridge guide must render without dynamic HTML injection');
assert.doesNotMatch(js, /ctwh_[A-Za-z0-9_-]{8,}/, 'Google Forms bridge guide must never contain a real-looking CallTag Webhook secret');
assert.doesNotMatch(js, /observe\(document\.body/, 'Google Forms bridge must not reintroduce a body-wide MutationObserver');
assert.doesNotMatch(js, /replay_raw/, 'Google Forms one-click mapping must not automatically replay test samples into real customers');
assert.match(js, /copyText\(appsScriptTemplate\(\),event\.currentTarget\)/, 'Apps Script copy must use the existing transient copy helper');
assert.match(js, /if\(!loginPanel\.classList\.contains\('hidden'\)\)clearTransientEndpoint\(\)/, 'Auth reset must clear the transient endpoint-bearing script');
assert.match(js, /autoMap\.onclick=\(\)=>autoMapGoogleForms\(item\.id,card,autoMap\)/, 'Recommended mapping write must require an explicit user button click');
assert.match(css, /@media\(max-width:680px\)/, 'Google Forms guide must keep mobile responsive rules');
assert.match(css, /@media\(max-width:420px\)/, 'Google Forms guide must keep small-screen action rules');
assert.doesNotThrow(() => new Function(js), 'Google Forms bridge browser script must parse');

console.log(JSON.stringify({
  ok: true,
  phase: 'CallTag Google Forms One-click Mapping',
  contracts: [
    'google-forms-connect-card-and-detail',
    'unsupported-naver-kakao-removed',
    'existing-generic-webhook-reuse',
    'apps-script-installable-form-submit-trigger',
    'response-id-idempotency',
    'ready-to-paste-script-after-webhook-create',
    'transient-endpoint-only',
    'auth-reset-clears-endpoint-script',
    'google-forms-rotate-context',
    'connection-readiness-list',
    'sample-backed-recommended-mapping',
    'explicit-user-click-before-mapping-write',
    'no-automatic-test-sample-replay',
    'phone-mapping-required',
    'endpoint-secret-warning',
    'no-browser-secret-storage',
    'no-dynamic-inner-html',
    'no-body-wide-mutation-observer',
    'native-pubsub-status-honesty',
    'mobile-responsive-guide',
  ],
}, null, 2));