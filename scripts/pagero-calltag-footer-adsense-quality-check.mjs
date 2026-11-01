import assert from 'node:assert/strict';
import fs from 'node:fs';
import { injectPageroRootSeo } from '../functions/lib/pageroRootSeo.js';

const app=fs.readFileSync('src/App.jsx','utf8');
const home=fs.readFileSync('src/screens/PageroCanonicalHome.jsx','utf8');
const server=fs.readFileSync('functions/index.js','utf8');
const publicPages=fs.readFileSync('functions/lib/publicPageMeta.js','utf8');
const domain='https://calltag.pagero.kr/';

assert(app.includes('key="root-login"') && app.includes('initialMode="login"'),
  'Existing login-first app contract must not be broken');
assert(app.includes("['생활비서', '/life/']"));
assert(app.includes("['콜태그(CallTag)', 'https://calltag.pagero.kr/']"),
  'Actual hydrated footer must link to official CallTag site');
assert(app.includes("pathname === '/login'") && app.includes("pathname === '/signup'"));
assert(home.includes('id="life"') && home.includes('id="calltag"'));
assert(home.includes('콜태그(CallTag)') && home.includes(domain));
assert(home.includes('후속 안내 문자') && home.includes('통화 후 상담 메모'));
assert(home.includes('<footer className="pagerol-home-footer"'));
assert(server.includes('<section class="pagero-ssr-life" id="calltag"'));
assert(server.includes('생활비서 전체보기') && server.includes('콜태그(CallTag)'));
assert(!server.includes('생활비서 전체보기</a></footer>'),'Publisher footer missing CallTag reference');
assert(publicPages.includes('stripPlatformAdsFromCustomerPage(await response.text())'),
  'Customer pages must remain excluded from platform publisher ad script');
const snippet=server.match(/<div id="root">([\s\S]+?)<\/body>/i);
assert(snippet && snippet[1].includes('<section class="pagero-ssr-life" id="calltag"'),
  'Public server HTML must contain CallTag independently of JS');
assert(snippet[1].includes('href="/life/"') && snippet[1].includes('href="'+domain+'"'));

const htmlSource=fs.readFileSync('functions/index.js','utf8');
const plain=`<!doctype html><html lang="ko"><head><title>페이지로</title></head><body>${snippet[0].replace(/<\/body>.*/, '')}</body></html>`;
const transformed=await injectPageroRootSeo(new URL('https://pagero.kr/'),
  new Response(plain,{headers:{'content-type':'text/html; charset=utf-8'}}));
const rendered=await transformed.text();
assert(rendered.includes('콜태그 공식 사이트') && rendered.includes(domain));
assert(rendered.includes('PAGERO_ROOT_SEO_V1'));
assert(rendered.includes('<link rel="canonical" href="https://pagero.kr/">'));
assert(!rendered.includes('https://life.pagero.kr/'));
console.log('PASS PageRo SEO fallback has CallTag and LIFE; hydrated login footer links both; existing auth and tenant-ad isolation preserved.');
