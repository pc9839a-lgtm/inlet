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


// End-to-end middleware routing proof. This catches a Pages deploy that passes
// generic readiness but rewrites the recovery HTML/CSS/JS to the SPA shell.
const { onRequest } = await import('../functions/_middleware.js');
async function routeTest(url, expectedAsset) {
  let got = '';
  const context = {
    request: new Request(url),
    env: {
      ASSETS: {
        async fetch(request) {
          got = new URL(request.url).pathname;
          const mime = got.endsWith('.css') ? 'text/css'
            : got.endsWith('.js') ? 'text/javascript' : 'text/html';
          return new Response('<html><body>route-smoke</body></html>', {
            status: 200, headers: {'Content-Type': mime},
          });
        },
      },
    },
    next: async () => new Response('next-unchanged', {status: 299}),
  };
  const response = await onRequest(context);
  assert.equal(got,expectedAsset,url);
  assert.equal(response.status,200,url);
  assert.equal(response.headers.get('x-calltag-recovery-route'),'standalone-v1',url);
  assert.match(response.headers.get('cache-control') || '',/no-store/,url);
  assert.match(response.headers.get('x-robots-tag') || '',/noindex/,url);
  return response;
}
for (const host of ['calltag.pagero.kr','pagero.kr','sample-123.pages.dev']) {
  for (const [requestPath,assetPath] of [
    ['/admin/subscription-recovery/','/admin/subscription-recovery/index.html'],
    ['/admin/subscription-recovery/index.html','/admin/subscription-recovery/index.html'],
    ['/admin/subscription-recovery/app.js','/admin/subscription-recovery/app.js'],
    ['/admin/subscription-recovery/style.css','/admin/subscription-recovery/style.css'],
  ]) await routeTest('https://' + host + requestPath,assetPath);
}
console.log('ok - exact standalone HTML/JS/CSS recovery routes served on all expected hosts');

// Keep the existing administrator API protected and unaffected by static routing.
{
  const url = 'https://calltag.pagero.kr/api/call/admin/subscription-reconcile';
  const response = await onRequest({
    request: new Request(url),
    env: {ASSETS:{fetch:async () => {throw new Error('API unexpectedly served as static asset');}}},
    next:async () => new Response('api-passthrough',{status:200}),
  });
  assert.equal(await response.text(),'api-passthrough');
}
// Never hijack the existing CallTag /admin route; fix only the new recovery page.
{
  const response = await onRequest({
    request:new Request('https://calltag.pagero.kr/admin'),
    env:{ASSETS:{fetch:async () => {throw new Error('Existing admin route hijacked');}}},
    next:async () => new Response('legacy-admin',{status:200}),
  });
  assert.equal(await response.text(),'legacy-admin');
}
console.log('ok - existing protected admin API and site routes remain unchanged');
