import { onRequest } from '../functions/_middleware.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const shellHtml = '<!doctype html><html><head></head><body><div id="root"></div></body></html>';
let checks = 0;

async function testRoute(path, { expectNoindex, expectShell = true, expectReset = false }) {
  let assetFetchCount = 0;
  let nextCount = 0;
  const request = new Request('https://pagero.kr' + path);
  const response = await onRequest({
    request,
    env: {
      ASSETS: {
        async fetch(assetRequest) {
          const assetUrl = assetRequest instanceof URL ? assetRequest : new URL(assetRequest.url);
          assert(assetUrl.pathname === '/index.html', 'protected SPA routes must reuse the canonical index.html');
          assetFetchCount += 1;
          return new Response(shellHtml, {
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
          });
        },
      },
    },
    async next() {
      nextCount += 1;
      return new Response(shellHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    },
  });
  assert(response.status === 200, path + ' should return 200');
  const policy = String(response.headers.get('X-Robots-Tag') || '').toLowerCase();
  const hasNoindex = /(?:^|,)\s*noindex\b/.test(policy);
  assert(hasNoindex === expectNoindex, path + ' noindex status unexpected: ' + (policy || '(missing)'));
  assert(!expectNoindex || policy.includes('nofollow'), path + ' should also restrict link following');
  if (expectShell) {
    assert(assetFetchCount === 1 && nextCount === 0, path + ' must render a Pages Functions SPA shell');
    assert(String(response.headers.get('Cache-Control') || '').includes('no-store'), path + ' must prevent HTML caching');
  }
  if (expectReset) {
    const html = await response.text();
    assert(html.includes('name="robots" content="noindex,nofollow"'), 'runtime reset must include its noindex meta');
  }
  checks += 1;
}

for (const path of [
  '/login', '/signup', '/app', '/dashboard', '/account/settings',
  '/admin', '/invite/token', '/example/admin',
  '/app?__fresh=123',
]) {
  await testRoute(path, { expectNoindex: true });
}

for (const path of ['/public-page?__fresh=123', '/contact?__hardreset=1']) {
  await testRoute(path, { expectNoindex: false });
}

await testRoute('/__pagero_runtime_reset?next=%2Fapp', {
  expectNoindex: true,
  expectShell: false,
  expectReset: true,
});

console.log(JSON.stringify({
  ok: true,
  check: 'pagero-protected-spa-noindex',
  cases: checks,
  protectedRoutes: 9,
  publicRecoveryRoutes: 2,
  resetRoute: 1,
  productionWrite: false,
  rootHomeChanged: false,
}, null, 2));
