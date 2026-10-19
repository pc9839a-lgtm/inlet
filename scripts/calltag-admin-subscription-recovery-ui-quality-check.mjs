import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';

const html = readFileSync('public/admin/subscription-recovery/index.html','utf8');
const js = readFileSync('public/admin/subscription-recovery/app.js','utf8');
const css = readFileSync('public/admin/subscription-recovery/style.css','utf8');
const backend = readFileSync('functions/api/call/admin/subscription-reconcile.js','utf8');

new Script(js, {filename:'admin-subscription-recovery/app.js'});
const cases = {
  'No real order IDs committed in UI': !/GPA\.\d{4}-\d{4}-\d{4}-\d{5}/.test(html + js + css),
  'Admin API preserved': backend.includes('requireCalltagAdmin(request, env)'),
  'Same-origin admin API only': js.includes("const api = '/api/call/admin/subscription-reconcile'"),
  'Default order proof is dry-run': js.includes('callAdmin({ orders, apply: false })'),
  'Actual paid-order write needs distinct user click': js.includes("id('apply').addEventListener('click'"),
  'Actual paid-order write explicitly authorized': js.includes('window.confirm(batch.count'),
  'Backend requires apply===true for writes': backend.includes('const apply = payload.apply === true'),
  'Never write when any unverified order exists': js.includes('data.results.every((item) => item.state ==='),
  'Never write if input changes after preview': js.includes('JSON.stringify(current) !== JSON.stringify(batch.orders)'),
  'Official paid and owner binding verified': js.includes('data.providerPaid') && js.includes('data.matchedExistingOwner'),
  'Orders are not persisted in browser': !/(localStorage|sessionStorage|indexedDB|sendBeacon)/i.test(js),
  'No raw HTML inserted from server': !/innerHTML/.test(js),
  'Refunds are not auto-added': !/refund/.test(js) && html.includes('환불 주문은 제외합니다'),
  'Separate stale subscription recovery is confirmed': js.includes("id('refresh').addEventListener('click'") && js.includes('callAdmin({})'),
  'Backend rechecks official subscription state': backend.includes('reconcileGoogleSubscriptionByOrder('),
  'Both CSS and JS are external': html.includes('src="./app.js"') && html.includes('href="./style.css"') && !/<script(?![^>]*src)/i.test(html),
  'Search engines excluded': html.includes('noindex,nofollow'),
  'Mobile CSS provided': css.includes('@media(max-width:620px)'),
};
for (const [key,pass] of Object.entries(cases)) {
  assert.equal(pass,true,key);
  console.log('ok',key);
}
console.log('CallTag subscription recovery UI contract:',Object.keys(cases).length,'checks pass');
