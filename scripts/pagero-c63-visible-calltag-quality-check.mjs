import assert from 'node:assert/strict';
import fs from 'node:fs';
import { onRequest } from '../functions/index.js';

const js=fs.readFileSync('public/c63-life-bridge.js','utf8');
const css=fs.readFileSync('public/c63-life-bridge.css','utf8');
const response=onRequest();
const html=await response.text();

assert.equal(response.status,200);
assert(html.includes('/c63-assets/index-pagero-main-fix-20260615.js'),
  'Live home must still use existing frozen C63 JS entry');
assert(html.includes('c63-life-bridge.js?v=calltag-20261022'),
  'CallTag bridge script must load on real C63 home with cache-busting');
assert(html.includes('c63-life-bridge.css?v=calltag-20261022'),
  'CallTag mobile CSS must be cache-busted');
assert(html.includes('https://calltag.pagero.kr/'),'Crawler-readable HTML must link to official CallTag');
assert(html.includes('href="/life/"'),'LIFE link must remain');
assert(html.includes('name="google-adsense-account"'),'Publisher AdSense verification must remain');

assert(js.includes('createCallTagSection'));
assert(js.includes("section.className = 'c63-calltag-bridge'"));
assert(js.includes("section.id = 'c63-calltag'"));
assert(js.includes("ensureLink(footerLinks, 'https://calltag.pagero.kr/', '콜태그')"),
  'Actual C63 footer must gain CallTag link, not the unused SPA footer');
assert(js.includes('home.insertBefore(createCallTagSection(), footer || null)'),
  'Actual C63 home must insert the service section BEFORE visible footer');
assert(js.includes("home.insertBefore(createLifeSection(), footer || null)"),
  'Existing LIFE section remains');
assert(js.includes("if (!home.querySelector('.c63-calltag-bridge'))"),
  'Idempotent DOM insertion required because frozen C63 re-hydrates');
assert(js.includes('MutationObserver(queueInstall)'), 'C63 re-hydration must be covered');
assert(js.includes('신규 고객 알림') && js.includes('통화 메모') && js.includes('안내 문자 자동화'),
  'Service facts should be visible in the actual DOM');
assert(css.includes('.pagero-exact-home .c63-calltag-bridge'));
assert(css.includes('@media (max-width: 760px)'),'Actual visible section needs mobile layout');
console.log('PASS: real frozen C63 home, footer, LIFE and CallTag service section correctly wired; publisher verification preserved');
