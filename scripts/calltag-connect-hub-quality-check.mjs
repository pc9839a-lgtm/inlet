import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlFile = 'public/call/connect/index.html';
const jsFile = 'public/call/connect/hub.js';
const cssFile = 'public/call/connect/hub.css';
const [html, js, css] = await Promise.all([readFile(htmlFile, 'utf8'), readFile(jsFile, 'utf8'), readFile(cssFile, 'utf8')]);
const source = `${html}\n${js}`;

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

assert.ok(source.includes("const SESSION_KEY='calllink-session'"), 'CallTag session key must remain compatible');
assert.ok(source.includes("const OAUTH_SESSION_KEY='calltag-meta-oauth-session'"), 'Meta OAuth refresh recovery must remain compatible');
assert.ok(source.includes('Promise.allSettled'), 'Hub channel loading must be failure-isolated');
assert.ok(source.includes('textContent='), 'Dynamic provider values should render through textContent');
assert.ok(!js.includes('innerHTML'), 'Connect hub must avoid dynamic HTML injection surfaces');
assert.doesNotMatch(source, /pageAccessToken|page_access_token|user_access_token|access_token/i, 'Provider access tokens must never be exposed in Connect HTML');

for (const storage of ['localStorage', 'sessionStorage']) {
  const secretWrite = new RegExp(`${storage}\\.setItem\\([^\\n]*(?:apiKey|endpointUrl|endpointKey|secret)`, 'i');
  assert.doesNotMatch(source, secretWrite, `${storage} must not persist one-time integration secrets`);
}

assert.match(source, /localStorage\.setItem\(SESSION_KEY,session\)/, 'Only the signed CallTag session should persist in localStorage');
assert.match(source, /sessionStorage\.setItem\(OAUTH_SESSION_KEY,id\)/, 'Only the temporary OAuth session id should persist in sessionStorage');
assert.match(source, /if\(rejected\.length\)\{\$\('hubState'\)\.textContent='일부 확인 필요'/, 'Partial channel failures must remain visible');

assert.ok(html.includes('/call/connect/hub.css') && html.includes('/call/connect/hub.js'), 'Connect hub assets must be loaded');
assert.ok(css.includes('@media(max-width:420px)'), 'Connect hub must keep mobile responsive rules');
assert.doesNotThrow(() => new Function(js), 'Connect hub browser script must parse');

console.log(JSON.stringify({
  ok: true,
  phase: 'CallTag Unified Connect Hub',
  contracts: [
    'pagero-built-in-channel',
    'meta-oauth-and-health-preserved',
    'generic-webhook-lifecycle-management',
    'direct-api-key-lifecycle-management',
    'one-time-secret-display-only',
    'no-secret-browser-storage',
    'failure-isolated-channel-loading',
    'future-provider-placeholder-honesty',
    'dom-text-only-dynamic-rendering',
  ],
}, null, 2));
