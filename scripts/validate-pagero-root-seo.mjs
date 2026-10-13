import assert from 'node:assert/strict';
import { injectPageroRootSeo } from '../functions/lib/pageroRootSeo.js';

const source = `<!doctype html><html lang="ko"><head><meta name="description" content="old"><link rel="canonical" href="https://pagero.kr/"><title>페이지로</title></head><body><div id="root"><main class="pagero-ssr-fallback"><section class="pagero-ssr-hero"><small>모바일 랜딩페이지 제작 도구</small><h1>모바일 페이지를 빠르게 만들고 접수까지 관리하세요.</h1><p>페이지로는 상담 신청, 방문 예약, 견적 문의, 이벤트 접수용 모바일 랜딩페이지를 만들고 접수 내용과 전환 통계를 관리할 수 있는 웹 기반 제작·운영 서비스입니다.</p></section><section class="pagero-ssr-life"><h2>생활에 필요한 정보를 한곳에</h2><a href="https://life.pagero.kr/car/car-inspection-period/">검사기간</a></section></main></div></body></html>`;

const transformed = await injectPageroRootSeo(
  new URL('https://pagero.kr/'),
  new Response(source, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
);
const html = await transformed.text();

assert.equal(transformed.status, 200);
assert.equal(transformed.headers.get('X-Pagero-Root-SEO'), 'brand-entity-v1');
assert.match(html, /<title>페이지로 \| 모바일 랜딩페이지 제작·접수 관리<\/title>/);
assert.match(html, /페이지로\(PAGERO\)/);
assert.match(html, /페이지로는 어떤 서비스인가요\?/);
assert.match(html, /"@type":"WebSite"/);
assert.match(html, /"@type":"WebApplication"/);
assert.match(html, /https:\/\/pagero\.kr\/life\/car\/car-inspection-period\//);
assert.doesNotMatch(html, /https:\/\/life\.pagero\.kr\//);
assert.equal((html.match(/PAGERO_ROOT_SEO_V1/g) || []).length, 1);
assert.match(html, /<meta name="naver-site-verification" content="2b53120b247214ee096be40c7c15795e42a8a24c">/);
assert.equal((html.match(/name="naver-site-verification"/g) || []).length, 1);

const previouslyVerifiedSource = source.replace('</head>', '<meta name="naver-site-verification" content="old-token"></head>');
const updatedResponse = await injectPageroRootSeo(
  new URL('https://pagero.kr/'),
  new Response(previouslyVerifiedSource, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
);
const updatedHtml = await updatedResponse.text();
assert.equal((updatedHtml.match(/name="naver-site-verification"/g) || []).length, 1);
assert.match(updatedHtml, /content="2b53120b247214ee096be40c7c15795e42a8a24c"/);
assert.doesNotMatch(updatedHtml, /content="old-token"/);

const httpResponse = await injectPageroRootSeo(
  new URL('http://pagero.kr/'),
  new Response(source, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
);
const httpHtml = await httpResponse.text();
assert.match(httpHtml, /<link rel="canonical" href="https:\/\/pagero.kr\/">/);
assert.match(httpHtml, /name="naver-site-verification"/);

const untouched = await injectPageroRootSeo(
  new URL('https://pagero.kr/about'),
  new Response(source, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
);
assert.equal(untouched.headers.get('X-Pagero-Root-SEO'), null);

console.log('Pagero root SEO validation passed');
