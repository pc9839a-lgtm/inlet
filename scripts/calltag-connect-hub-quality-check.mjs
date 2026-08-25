import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlFile = 'public/call/connect/index.html';
const jsFile = 'public/call/connect/hub.js';
const mapperFile = 'public/call/connect/webhook-mapper.js';
const cssFile = 'public/call/connect/hub.css';
const [html, js, mapper, css] = await Promise.all([
  readFile(htmlFile, 'utf8'),
  readFile(jsFile, 'utf8'),
  readFile(mapperFile, 'utf8'),
  readFile(cssFile, 'utf8'),
]);
const source = `${html}\n${js}\n${mapper}`;

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
  'sample.mapper?.draftMapping',
  'sample.mapper?.fields',
]) {
  assert.ok(source.includes(token), `Webhook mapper UI contract missing: ${token}`);
}

assert.ok(source.includes("const SESSION_KEY='calllink-session'"), 'CallTag session key must remain compatible');
assert.ok(source.includes("const OAUTH_SESSION_KEY='calltag-meta-oauth-session'"), 'Meta OAuth refresh recovery must remain compatible');
assert.ok(source.includes('Promise.allSettled'), 'Hub channel loading must be failure-isolated');
assert.ok(source.includes('textContent='), 'Dynamic provider values should render through textContent');
assert.ok(!js.includes('innerHTML'), 'Connect hub must avoid dynamic HTML injection surfaces');
assert.ok(!mapper.includes('innerHTML'), 'Webhook mapper must render provider payloads without dynamic HTML injection');
assert.doesNotMatch(source, /pageAccessToken|page_access_token|user_access_token|access_token/i, 'Provider access tokens must never be exposed in Connect HTML');

for (const storage of ['localStorage', 'sessionStorage']) {
  const secretWrite = new RegExp(`${storage}\\.setItem\\([^\\n]*(?:apiKey|endpointUrl|endpointKey|secret|payload|sample|mapping)`, 'i');
  assert.doesNotMatch(source, secretWrite, `${storage} must not persist integration secrets or webhook samples`);
}
assert.doesNotMatch(mapper, /localStorage|sessionStorage/, 'Webhook mapper must not persist sample payload or mapping drafts in browser storage');

assert.match(source, /localStorage\.setItem\(SESSION_KEY,session\)/, 'Only the signed CallTag session should persist in localStorage');
assert.match(source, /sessionStorage\.setItem\(OAUTH_SESSION_KEY,id\)/, 'Only the temporary OAuth session id should persist in sessionStorage');
assert.match(source, /if\(rejected\.length\)\{\$\('hubState'\)\.textContent='일부 확인 필요'/, 'Partial channel failures must remain visible');
assert.match(mapper, /if\(!mapping\.phone\)/, 'Client mapper must block save without a phone mapping');
assert.match(mapper, /mapping\.phone\.startsWith\('\/'\)/, 'Client mapper must validate JSON Pointer shape before save');
assert.match(mapper, /encodeURIComponent\(connectionId\)/, 'Webhook sample endpoint must encode connection identifiers');
assert.match(mapper, /Number\(sample\.id\)/, 'Raw replay must use a numeric sample id');
assert.match(mapper, /MutationObserver/, 'Webhook mapper must re-bind after connection list refreshes');

assert.ok(html.includes('/call/connect/hub.css') && html.includes('/call/connect/hub.js'), 'Connect hub assets must be loaded');
assert.ok(html.includes('/call/connect/webhook-mapper.js'), 'Webhook mapper runtime must load after the Connect hub');
assert.ok(html.indexOf('/call/connect/hub.js') < html.indexOf('/call/connect/webhook-mapper.js'), 'Webhook mapper must load after hub globals are defined');
assert.ok(css.includes('.mapper-panel') && css.includes('.mapper-grid') && css.includes('.mapper-payload'), 'Webhook mapper styles must be present');
assert.ok(css.includes('@media(max-width:420px)'), 'Connect hub must keep mobile responsive rules');
assert.doesNotThrow(() => new Function(js), 'Connect hub browser script must parse');
assert.doesNotThrow(() => new Function(mapper), 'Webhook mapper browser script must parse');

console.log(JSON.stringify({
  ok: true,
  phase: 'CallTag Unified Connect Hub + Webhook Mapper UI',
  contracts: [
    'pagero-built-in-channel',
    'meta-oauth-and-health-preserved',
    'generic-webhook-lifecycle-management',
    'direct-api-key-lifecycle-management',
    'sample-assisted-json-pointer-mapping',
    'phone-mapping-required-before-save',
    'server-suggested-draft-mapping',
    'raw-sample-replay-after-mapping',
    'payload-preview-text-only-and-truncated',
    'no-webhook-sample-browser-storage',
    'one-time-secret-display-only',
    'no-secret-browser-storage',
    'failure-isolated-channel-loading',
    'future-provider-placeholder-honesty',
    'dom-text-only-dynamic-rendering',
  ],
}, null, 2));
