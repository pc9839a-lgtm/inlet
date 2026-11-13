import assert from 'node:assert/strict';
import { onRequest as onRootMiddleware } from '../functions/_middleware.js';
import { stripPlatformAdsFromCustomerPage, injectPublicPageMeta } from '../functions/lib/publicPageMeta.js';

const pub = 'ca-pub-1906196934401001';
const sharedHtml = `<!doctype html><html lang="ko"><head>
<meta name="google-adsense-account" content="${pub}">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${pub}" crossorigin="anonymous"></script>
<title>Shared shell</title>
</head><body><main>Customer landing page original content</main></body></html>`;

const stripped = stripPlatformAdsFromCustomerPage(sharedHtml);
assert(!stripped.includes('google-adsense-account'));
assert(!stripped.includes('pagead2.googlesyndication.com'));
assert(stripped.includes('Customer landing page original content'));

const row = {
  slug: 'demo-customer',
  title: 'Customer demo page',
  page_json: JSON.stringify({ meta: { title: 'Customer demo page', desc: 'Customer-owned public page.' } }),
  revision: 1,
  updated_at: '2026-10-22',
};
const db = {
  prepare() {
    return { bind() { return { first: async () => row }; } };
  },
};
const context = { request: new Request('https://pagero.kr/demo-customer'), env: { DB: db } };
const url = new URL(context.request.url);
const input = new Response(sharedHtml, { headers: { 'content-type': 'text/html' } });
const result = await injectPublicPageMeta(context, url, input);
const published = await result.text();
assert(!published.includes('google-adsense-account'));
assert(!published.includes('pagead2.googlesyndication.com'));
assert(published.includes('Customer landing page original content'));
assert(published.includes('Customer demo page'));

const rootUrl = new URL('https://pagero.kr/');
const rootInput = new Response(sharedHtml, { headers: { 'content-type': 'text/html' } });
const rootResult = await injectPublicPageMeta({request: new Request(rootUrl), env: {}}, rootUrl, rootInput);
const home = await rootResult.text();
assert(home.includes('google-adsense-account'));
assert(home.includes('pagead2.googlesyndication.com'));


// Protected workspace routes use the same index.html as the public site.
// Their content must remain intact but AdSense must not run on these screens.
for (const path of ['/login', '/signup', '/app', '/app/editor', '/dashboard', '/account', '/admin', '/invite']) {
  const response = await onRootMiddleware({
    request: new Request('https://pagero.kr' + path),
    env: {
      ASSETS: {fetch: async () => new Response(sharedHtml, {headers: {'content-type': 'text/html'}})},
    },
    next: async () => { throw new Error('protected route escaped SPA shell: ' + path); },
  });
  const body = await response.text();
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get('x-robots-tag') || '', /noindex/i, path);
  assert(!body.includes('google-adsense-account'), path + ' inherited publisher meta');
  assert(!body.includes('pagead2.googlesyndication.com'), path + ' loaded Auto Ads');
  assert(body.includes('Customer landing page original content'), path + ' changed the SPA shell');
}

console.log('PASS: protected workspace shells exclude AdSense; customer pages isolate monetization; public homepage retains publisher verification.');

