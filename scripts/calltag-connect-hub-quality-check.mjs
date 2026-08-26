import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlFile = 'public/call/connect/index.html';
const jsFile = 'public/call/connect/hub.js';
const mapperFile = 'public/call/connect/webhook-mapper.js';
const cssFile = 'public/call/connect/hub.css';
const apiGuideFile = 'public/call/connect/direct-api-guide.js';
const apiGuideCssFile = 'public/call/connect/direct-api-guide.css';
const webhookGuideFile = 'public/call/connect/webhook-guide.js';
const webhookGuideCssFile = 'public/call/connect/webhook-guide.css';
const [html, js, mapper, css, apiGuide, apiGuideCss, webhookGuide, webhookGuideCss] = await Promise.all([
  readFile(htmlFile, 'utf8'),
  readFile(jsFile, 'utf8'),
  readFile(mapperFile, 'utf8'),
  readFile(cssFile, 'utf8'),
  readFile(apiGuideFile, 'utf8'),
  readFile(apiGuideCssFile, 'utf8'),
  readFile(webhookGuideFile, 'utf8'),
  readFile(webhookGuideCssFile, 'utf8'),
]);
const source = `${html}\n${js}\n${mapper}\n${apiGuide}\n${webhookGuide}`;

for (const label of ['PageRo', 'Meta Lead Ads', 'Generic Webhook', 'Direct API']) {
  assert.ok(source.includes(label), `Connect hub provider missing: ${label}`);
}
for (const endpoint of [
  '/api/calltag/v1/meta/connections',
  '/api/calltag/v1/meta/health',
  '/api/calltag/v1/connections',
  '/api/calltag/v1/keys',
  '/api/calltag/v1/leads',
]) {
  assert.ok(source.includes(endpoint), `Connect hub API missing: ${endpoint}`);
}

for (const token of [
  "action:'rotate_endpoint'",
  "action:'revoke'",
  "action:'create'",
  "action:'rotate'",
  'showSecret',
  'navigator.clipboard',
  '지금 한 번만 저장하세요',
  '브라우저 저장소에는 보관하지 않습니다.',
  '별도 설정 없음',
  '준비 중',
]) {
  assert.ok(source.includes(token), `Connect hub contract missing: ${token}`);
}

for (const token of [
  'webhook-mapper.js',
  '/samples?limit=5',
  "action:'update_mapping'",
  "action:'replay_raw'",
  '전화번호 필드는 반드시 지정해야 합니다.',
  '자동 추천 적용',
  '선택 샘플 재처리',
  'JSON Pointer',
  'JSON.stringify(sample.payload,null,2)',
  'value.slice(0,8000)',
  'sample?.mapper?.draftMapping',
  'sample?.mapper?.fields',
]) {
  assert.ok(source.includes(token), `Webhook mapper UI contract missing: ${token}`);
}

for (const token of [
  'Direct API 연동 가이드',
  'Authorization: Bearer <YOUR_API_KEY>',
  'Idempotency-Key',
  'event_id / external_id',
  'CALLTAG_API_KEY_REQUIRED',
  'CALLTAG_API_KEY_INVALID',
  'CALLTAG_LEAD_IDEMPOTENCY_REQUIRED',
  'CALLTAG_LEAD_PHONE_REQUIRED',
  'CALLTAG_LEAD_EMAIL_INVALID',
  'CALLTAG_LEAD_JSON_INVALID',
  'CALLTAG_LEAD_BODY_TOO_LARGE',
  'CREATED',
  'MATCHED_EXISTING',
  'DUPLICATE_IGNORED',
  '서버에서만 호출하세요.',
  'API Key를 웹페이지 JavaScript',
]) {
  assert.ok(apiGuide.includes(token), `Direct API guide contract missing: ${token}`);
}

for (const token of [
  'Webhook 연결 가이드',
  '<YOUR_WEBHOOK_URL>',
  'Webhook URL 자체가 비밀값입니다.',
  'MAPPING_REQUIRED',
  'MAPPED',
  'REJECTED',
  'Idempotency-Key',
  'X-Webhook-Id',
  'X-Delivery-Id',
  'X-Request-Id',
  'X-Event-Id',
  'SHA-256',
  '최대 256KB',
  '연결당 1분 300건',
  '1~30일 · 기본 7일',
  '/lead/customer/phone',
  '전화번호는 필수입니다.',
  'URL 교체',
]) {
  assert.ok(webhookGuide.includes(token), `Webhook usage guide contract missing: ${token}`);
}

assert.ok(source.includes("const SESSION_KEY='calllink-session'"), 'CallTag session key must remain compatible');
assert.ok(source.includes("const OAUTH_SESSION_KEY='calltag-meta-oauth-session'"), 'Meta OAuth refresh recovery must remain compatible');
assert.ok(source.includes('Promise.allSettled'), 'Hub channel loading must be failure-isolated');
assert.ok(source.includes('textContent='), 'Dynamic provider values should render through textContent');
assert.ok(!js.includes('innerHTML'), 'Connect hub must avoid dynamic HTML injection surfaces');
assert.ok(!mapper.includes('innerHTML'), 'Webhook mapper must render provider payloads without dynamic HTML injection');
assert.ok(!apiGuide.includes('innerHTML'), 'Direct API guide must render dynamic origin values without innerHTML');
assert.ok(!webhookGuide.includes('innerHTML'), 'Webhook guide must render examples without innerHTML');
assert.doesNotMatch(source, /pageAccessToken|page_access_token|user_access_token|access_token/i, 'Provider access tokens must never be exposed in Connect HTML');

for (const storage of ['localStorage', 'sessionStorage']) {
  const secretWrite = new RegExp(`${storage}\\.setItem\\([^\\n]*(?:apiKey|endpointUrl|endpointKey|secret|payload|sample|mapping)`, 'i');
  assert.doesNotMatch(source, secretWrite, `${storage} must not persist integration secrets or webhook samples`);
}
assert.doesNotMatch(mapper, /localStorage|sessionStorage/, 'Webhook mapper must not persist sample payload or mapping drafts in browser storage');
assert.doesNotMatch(apiGuide, /localStorage|sessionStorage/, 'Direct API guide must not persist API keys, payloads, or examples in browser storage');
assert.doesNotMatch(webhookGuide, /localStorage|sessionStorage/, 'Webhook guide must not persist endpoint secrets or samples in browser storage');
assert.doesNotMatch(apiGuide, /ctk_[A-Za-z0-9_-]{8,}/, 'Direct API guide must never contain a real-looking CallTag API key');
assert.doesNotMatch(webhookGuide, /ctwh_[A-Za-z0-9_-]{8,}/, 'Webhook guide must never contain a real-looking endpoint secret');

assert.match(source, /localStorage\.setItem\(SESSION_KEY,session\)/, 'Only the signed CallTag session should persist in localStorage');
assert.match(source, /sessionStorage\.setItem\(OAUTH_SESSION_KEY,id\)/, 'Only the temporary OAuth session id should persist in sessionStorage');
assert.match(source, /if\(rejected\.length\)\{\$\('hubState'\)\.textContent='일부 확인 필요'/, 'Partial channel failures must remain visible');
const cleanupStart=js.indexOf('function clearTransientAuthUi()');
const cleanupEnd=js.indexOf('\nfunction requireLogin()',cleanupStart);
assert.ok(cleanupStart>=0&&cleanupEnd>cleanupStart,'Transient auth cleanup must be defined before login reset');
const cleanupBody=js.slice(cleanupStart,cleanupEnd);
assert.match(cleanupBody,/rememberOauthSession\(''\)/,'Expired sessions must clear temporary Meta OAuth session state');
for(const id of ['webhookSecret','apiSecret']){
  assert.ok(cleanupBody.includes(`'${id}'`),`Expired sessions must target ${id}`);
}
assert.match(cleanupBody,/box\.textContent=''/,'Expired sessions must erase one-time secret DOM contents');
assert.match(cleanupBody,/box\.className='secret-box'/,'Expired sessions must restore secret boxes to hidden base state');
assert.match(cleanupBody,/removeAttribute\('role'\)/,'Expired sessions must remove transient secret accessibility region state');
assert.match(cleanupBody,/removeAttribute\('aria-label'\)/,'Expired sessions must remove transient secret accessibility labels');
assert.match(cleanupBody,/\$\('pagePicker'\).*classList\.add\('hidden'\)/s,'Expired sessions must hide stale Meta page selection UI');
assert.match(cleanupBody,/\$\('pageList'\).*textContent=''/s,'Expired sessions must clear stale Meta page selection content');
const requireLoginStart=js.indexOf('function requireLogin()');
const requireLoginEnd=js.indexOf('\nfunction handleConnectActionError',requireLoginStart);
const requireLoginBody=js.slice(requireLoginStart,requireLoginEnd);
assert.match(requireLoginBody,/localStorage\.removeItem\(SESSION_KEY\)/,'Expired session recovery must remove signed session storage');
assert.match(requireLoginBody,/clearTransientAuthUi\(\)/,'Expired session recovery must erase transient secrets before exposing login UI');
assert.match(js, /function handleConnectActionError\(error,target\)\{\s*if\(error\?\.status===401\|\|error\?\.status===403\)\{requireLogin\(\);return true\}/, 'Lifecycle action errors must route expired sessions back to login');
const lifecycleActionTargets = [
  ['revokeConnection', 'metaNotice'],
  ['rotateWebhook', 'webhookNotice'],
  ['revokeWebhook', 'webhookNotice'],
  ['rotateApiKey', 'apiNotice'],
  ['revokeApiKey', 'apiNotice'],
];
for (const [name,target] of lifecycleActionTargets) {
  const start=js.indexOf(`async function ${name}`);
  assert.ok(start>=0, `Lifecycle action missing: ${name}`);
  const next=js.indexOf('\nasync function ',start+1);
  const body=js.slice(start,next>=0?next:js.length);
  assert.match(body,new RegExp(`handleConnectActionError\\(error,\\$\\('${target}'\\)\\)`),`${name} must normalize expired-session handling`);
}
assert.equal((js.match(/catch\(error\)\{handleConnectActionError\(error,/g)||[]).length,5,'Exactly the five destructive/rotation lifecycle actions should use the scoped session handler');
const apiStart=js.indexOf('async function api(');
const apiEnd=js.indexOf('\nfunction showDetail',apiStart);
assert.ok(apiStart>=0&&apiEnd>apiStart,'Shared api helper must remain discoverable');
assert.doesNotMatch(js.slice(apiStart,apiEnd),/requireLogin\(/,'Shared api helper must not globally convert every 403 into session expiry');
assert.match(mapper, /if\(!mapping\.phone\)/, 'Client mapper must block save without a phone mapping');
assert.match(mapper, /mapping\.phone\.startsWith\('\/'\)/, 'Client mapper must validate JSON Pointer shape before save');
assert.match(mapper, /encodeURIComponent\(connectionId\)/, 'Webhook sample endpoint must encode connection identifiers');
assert.match(mapper, /Number\(sample\.id\)/, 'Raw replay must use a numeric sample id');
assert.match(js, /data\.webhookMapperTrigger|dataset\.webhookMapperTrigger/, 'Hub must mark the mapper trigger explicitly');
assert.match(js, /dataset\.webhookConnectionId/, 'Hub must bind each Webhook card to its connection id');
assert.match(js, /calltag:webhooks-rendered/, 'Hub must emit an explicit Webhook render event');
assert.match(mapper, /calltag:webhooks-rendered/, 'Webhook mapper must re-bind from the explicit render event');
assert.match(mapper, /webhookConnections\.find/, 'Webhook mapper must resolve the connection by id');
assert.match(mapper, /data-webhook-mapper-trigger/, 'Webhook mapper must target the explicit mapper button');
assert.doesNotMatch(mapper, /MutationObserver/, 'Webhook mapper must not watch DOM mutations to infer connection binding');
assert.doesNotMatch(mapper, /cards\.forEach\(\(card,index\)/, 'Webhook mapper must not bind cards by array position');
assert.match(apiGuide, /location\.origin/, 'Direct API guide should derive the endpoint from the current CallTag origin');
assert.match(apiGuide, /navigator\.clipboard/, 'Direct API guide should support copy actions without persisting secrets');
assert.doesNotMatch(apiGuide, /webhook-guide\.(?:css|js)|connect-polish\.(?:css|js)/, 'Direct API guide must not act as a hidden asset loader');
assert.match(webhookGuide, /document\.getElementById\('webhookDetail'\)/, 'Webhook guide must mount only inside the authenticated Webhook detail section');
assert.match(webhookGuide, /navigator\.clipboard/, 'Webhook guide should offer safe copy actions');

const expectedAssets=[
  '/call/connect/hub.css',
  '/call/connect/direct-api-guide.css',
  '/call/connect/webhook-guide.css',
  '/call/connect/connect-polish.css',
  '/call/connect/hub.js',
  '/call/connect/direct-api-guide.js',
  '/call/connect/webhook-guide.js',
  '/call/connect/connect-polish.js',
  '/call/connect/webhook-mapper.js',
  '/call/connect/activity.js',
  '/call/connect/e2e.js',
];
for(const asset of expectedAssets)assert.ok(html.includes(asset),`Connect HTML must explicitly load ${asset}`);
const orderedScripts=[
  '/call/connect/hub.js',
  '/call/connect/direct-api-guide.js',
  '/call/connect/webhook-guide.js',
  '/call/connect/connect-polish.js',
  '/call/connect/webhook-mapper.js',
  '/call/connect/activity.js',
  '/call/connect/e2e.js',
];
for(let index=1;index<orderedScripts.length;index++){
  assert.ok(html.indexOf(orderedScripts[index-1])<html.indexOf(orderedScripts[index]),`Connect script order must keep ${orderedScripts[index-1]} before ${orderedScripts[index]}`);
}
assert.ok(html.includes('id="apiGuide"'), 'Direct API guide mount point must be present');
assert.ok(css.includes('.mapper-panel') && css.includes('.mapper-grid') && css.includes('.mapper-payload'), 'Webhook mapper styles must be present');
assert.ok(css.includes('@media(max-width:420px)'), 'Connect hub must keep mobile responsive rules');
assert.ok(apiGuideCss.includes('.api-guide-shell') && apiGuideCss.includes('.api-guide-code'), 'Direct API guide styles must be present');
assert.ok(apiGuideCss.includes('@media(max-width:680px)'), 'Direct API guide must keep mobile responsive rules');
assert.ok(webhookGuideCss.includes('.webhook-guide-shell') && webhookGuideCss.includes('.webhook-guide-code'), 'Webhook guide styles must be present');
assert.ok(webhookGuideCss.includes('@media(max-width:680px)'), 'Webhook guide must keep mobile responsive rules');
assert.doesNotThrow(() => new Function(js), 'Connect hub browser script must parse');
assert.doesNotThrow(() => new Function(mapper), 'Webhook mapper browser script must parse');
assert.doesNotThrow(() => new Function(apiGuide), 'Direct API guide browser script must parse');
assert.doesNotThrow(() => new Function(webhookGuide), 'Webhook usage guide browser script must parse');

console.log(JSON.stringify({
  ok: true,
  phase: 'CallTag Unified Connect Hub + Webhook Mapper + Integration Guides',
  contracts: [
    'pagero-built-in-channel',
    'meta-oauth-and-health-preserved',
    'generic-webhook-lifecycle-management',
    'direct-api-key-lifecycle-management',
    'expired-session-lifecycle-action-normalization',
    'expired-session-transient-secret-erasure',
    'expired-session-oauth-state-erasure',
    'scoped-403-session-handling',
    'direct-api-server-only-security-guidance',
    'direct-api-bearer-auth-contract',
    'direct-api-idempotency-contract',
    'direct-api-request-response-examples',
    'direct-api-error-code-reference',
    'direct-api-same-phone-reinquiry-guidance',
    'webhook-secret-url-guidance',
    'webhook-test-payload-and-curl-example',
    'webhook-idempotency-header-reference',
    'webhook-payload-hash-fallback',
    'webhook-rate-body-retention-limits',
    'webhook-status-explanation',
    'webhook-mapping-and-replay-flow',
    'sample-assisted-json-pointer-mapping',
    'phone-mapping-required-before-save',
    'server-suggested-draft-mapping',
    'raw-sample-replay-after-mapping',
    'payload-preview-text-only-and-truncated',
    'webhook-card-id-binding',
    'webhook-render-event-rebinding',
    'no-mutation-observer-mapper-binding',
    'no-webhook-sample-browser-storage',
    'one-time-secret-display-only',
    'no-secret-browser-storage',
    'failure-isolated-channel-loading',
    'future-provider-placeholder-honesty',
    'explicit-static-asset-loading',
    'no-hidden-companion-asset-loader',
    'dom-text-only-dynamic-rendering',
  ],
}, null, 2));