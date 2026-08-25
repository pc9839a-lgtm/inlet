import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [runtime, css, html, apiGuide, hub, mapper, activity, e2e] = await Promise.all([
  readFile('public/call/connect/connect-polish.js','utf8'),
  readFile('public/call/connect/connect-polish.css','utf8'),
  readFile('public/call/connect/index.html','utf8'),
  readFile('public/call/connect/direct-api-guide.js','utf8'),
  readFile('public/call/connect/hub.js','utf8'),
  readFile('public/call/connect/webhook-mapper.js','utf8'),
  readFile('public/call/connect/activity.js','utf8'),
  readFile('public/call/connect/e2e.js','utf8'),
]);

for(const token of [
  "role','status'",
  "aria-live','polite'",
  "aria-selected",
  "aria-current",
  'Meta 연결하기',
  'Webhook 만들기',
  'API Key 만들기',
  'URL 교체',
  '키 폐기',
  '키 교체',
  'calltag:connect-ui-updated',
  "event.key!=='Escape'",
])assert.ok(runtime.includes(token),`Connect polish runtime missing ${token}`);

assert.doesNotMatch(runtime,/MutationObserver/,'UX polish must not watch the entire Connect DOM for mutations');
assert.doesNotMatch(runtime,/localStorage|sessionStorage/,'UX polish must not persist state or secrets');
assert.doesNotMatch(runtime,/innerHTML/,'UX polish must avoid dynamic HTML injection');
assert.doesNotMatch(runtime,/fetch\s*\(/,'UX polish must not add network/API behavior');
assert.doesNotMatch(runtime,/confirm\s*=|window\.confirm/,'UX polish must not bypass existing confirmation guards');
assert.doesNotThrow(()=>new Function(runtime),'Connect polish browser script must parse');

for(const [label,producer] of [
  ['hub',hub],
  ['webhook mapper',mapper],
  ['activity',activity],
  ['E2E',e2e],
])assert.ok(producer.includes('calltag:connect-ui-updated'),`${label} must announce dynamic Connect UI updates`);

for(const token of [
  "emitConnectUiUpdated('meta')",
  "emitConnectUiUpdated('webhook')",
  "emitConnectUiUpdated('api')",
  "emitConnectUiUpdated('secret')",
])assert.ok(hub.includes(token),`Connect hub UI update producer missing ${token}`);

assert.ok(mapper.includes("area:'mapper'"),'Webhook mapper must announce mapper panel renders');
assert.ok(activity.includes("area:'activity'"),'Activity renderer must announce activity UI renders');
assert.ok(e2e.includes("area:'e2e'")&&e2e.includes("area:'e2e-status'"),'E2E renderer must announce panel and status renders');

for(const token of [
  '.connect-empty-action',
  'min-height:42px',
  'position:sticky',
  'grid-template-columns:repeat(2,minmax(0,1fr))',
  '@media(max-width:420px)',
])assert.ok(css.includes(token),`Connect polish CSS missing ${token}`);

assert.ok(html.includes('/call/connect/connect-polish.css'),'Connect HTML must explicitly load UX polish CSS');
assert.ok(html.includes('/call/connect/connect-polish.js'),'Connect HTML must explicitly load UX polish runtime');
assert.ok(html.indexOf('/call/connect/connect-polish.js')>html.indexOf('/call/connect/hub.js'),'UX polish runtime must load after hub runtime');
assert.doesNotMatch(apiGuide,/connect-polish\.(?:css|js)/,'Direct API guide must not own UX polish asset loading');

console.log(JSON.stringify({
  ok:true,
  phase:'CallTag Connect Hub UX polish',
  contracts:[
    'aria-live-statuses',
    'tab-selection-accessibility',
    'empty-state-ctas',
    'risk-action-hints',
    'existing-confirmation-guards-preserved',
    'mobile-sticky-tabs',
    'mobile-minimum-action-targets',
    'responsive-action-grid',
    'escape-closes-create-forms',
    'explicit-ui-update-events',
    'no-body-mutation-observer',
    'explicit-html-asset-loading',
    'no-hidden-guide-loader',
    'no-new-network-behavior',
    'no-browser-storage',
    'no-innerhtml',
  ],
},null,2));