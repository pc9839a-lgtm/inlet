import fs from 'node:fs';
import assert from 'node:assert/strict';
import { injectPageroRootSeo } from '../functions/lib/pageroRootSeo.js';
import { onRequest } from '../functions/_middleware.js';

const read=p=>fs.readFileSync(p,'utf8');
const guide=read('public/guide/index.html');
const sitemap=read('public/sitemap.xml');
const referencePaths=[
  'guide/landing-page-prelaunch/',
  'guide/form-submission-debug/',
  'guide/lead-funnel-metrics/',
  'tools/lead-calculator/',
];
assert.match(guide,/^<!doctype html>/i);
assert.equal((guide.match(/<h1\b/gi)||[]).length,1,'Guide hub must have one H1');
assert.equal((guide.match(/rel="canonical"/gi)||[]).length,1,'Only one canonical is allowed');
assert(guide.includes('<link rel="canonical" href="https://pagero.kr/guide/">'));
assert(guide.includes('<meta name="robots" content="index,follow'), 'Guide hub must be indexable');
assert(/<meta name="description" content="[^"]{65,}"/.test(guide),'Nontrivial description needed');
assert((guide.match(/<tr>/g)||[]).length>=4,'Diagnostic comparison must offer actual decision steps');
assert(guide.includes('증상부터 찾는 빠른 진단표'));
assert((guide.match(/class="card manual-card"/g)||[]).length>=15, 'Official hub must list the 15 product manuals');
assert(guide.includes('adsense-account') && !guide.includes('개별 광고 계정의 성과를 보장합니다'));
assert(sitemap.includes('<loc>https://pagero.kr/guide/</loc><lastmod>2026-10-29</lastmod>'));
for(const resource of referencePaths){
  assert(guide.includes('href="/'+resource+'"'), 'Hub must link existing resource: '+resource);
  const file='public/'+resource+'index.html';
  assert(fs.existsSync(file), 'Hub linked to missing static file '+file);
  assert(read(file).includes('href="/guide/"'), 'Resource lacks hub backlink '+file);
}

const detailedManuals = ["getting-started","editor-overview","contact-form","preview-publish","inbox-management","analytics","seo-tracking","troubleshooting"];
for(const slug of detailedManuals){
  const file = 'public/guide/'+slug+'/index.html';
  const article=read(file);
  assert(article.includes('<section id="deep-dive"'), 'Detailed how-to section missing: '+slug);
  assert(article.includes('class="manual-route"'), 'Actual menu path missing: '+slug);
  assert(article.includes('<a href="#deep-dive">'), 'In-page jump link missing: '+slug);
  assert((article.match(/class="manual-work-block"/g)||[]).length>=3,'Need 3+ practical labs: '+slug);
  assert((article.match(/<tr>/g)||[]).length>=4,'Need real settings matrix: '+slug);
  assert(article.includes('<link rel="canonical" href="https://pagero.kr/guide/'+slug+'/">'),'Canonical missing: '+slug);
}


const searchIndex=JSON.parse(read('public/guide/search-index.json'));
assert.equal(searchIndex.documents.length,15,'Full-text index must cover 15 official guides');
assert.equal(new Set(searchIndex.documents.map(doc=>doc.path)).size,15,'Index URLs must be unique');
for(const doc of searchIndex.documents){
  assert(doc.body.length>500, 'Missing substantive text: '+doc.slug);
  const article=read('public/guide/'+doc.slug+'/index.html');
  assert(article.includes('class="manual-faq"'), 'FAQ section missing: '+doc.slug);
  assert((article.match(/<details>/g)||[]).length>=2,'Require 2+ concrete FAQ entries: '+doc.slug);
}
assert(guide.includes('src="/guide/help-center.js"'),'Search script missing');
assert(guide.includes('id="manual-results"'),'Result region missing');
assert((guide.match(/data-guide-doc/g)||[]).length===15,'Avoid duplicate manual cards');
assert((guide.match(/data-guide-filter/g)||[]).length===6,'All six topic filters are required');
const {rankManuals}=await import('../public/guide/search-core.mjs');
assert(rankManuals(searchIndex.documents,'중복 접수').some(d=>d.slug==='contact-form'),'Must find settings inside text');
assert(rankManuals(searchIndex.documents,'엑셀').some(d=>d.slug==='inbox-management'),'Must find CSV via common synonym');
assert.equal(rankManuals(searchIndex.documents,'완전히없는검색문자열xyz').length,0);

const structuredScripts=[...guide.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
assert.equal(structuredScripts.length,1,'Use one valid JSON-LD graph');
const data=JSON.parse(structuredScripts[0][1]);
assert(data['@graph'].some(x=>x['@type']==='CollectionPage'));
assert(data['@graph'].some(x=>x['@type']==='BreadcrumbList'));

const html='<!doctype html><html lang="ko"><head><title>페이지로</title></head><body><main><section class="pagero-ssr-life"><h2>생활에 필요한 정보를 한곳에</h2><p>생활정보</p></section></main></body></html>';
const url=new URL('https://pagero.kr/');
const injected=await injectPageroRootSeo(url,new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8'}}));
const home=await injected.text();
assert(home.includes('href="/guide/"'), 'Root SSR fallback must point to hub in raw HTML');
assert(home.includes('href="/guide/lead-funnel-metrics/"'), 'Previous guide references must not disappear');
assert(home.includes('생활에 필요한 정보를 한곳에'), 'Life editorial section must remain intact');
assert.equal((home.match(/rel="canonical"/g)||[]).length,1,'Root should have only one canonical');

let nextCalls=0;
const served=await onRequest({
  request:new Request('https://pagero.kr/guide/'),
  env:{},
  next:async()=>{nextCalls++;return new Response(guide,{status:200,headers:{'Content-Type':'text/html; charset=utf-8'}});},
});
assert.equal(nextCalls,1,'Guide route must use a real static asset, not a protected SPA');
assert.equal(served.status,200);
assert((await served.text()).includes('증상부터 찾는 빠른 진단표'));
console.log(JSON.stringify({ok:true,hub:'/guide/',resourceLinks:4,canonical:'https://pagero.kr/guide/',rootStaticLinked:true,staticResponse:true,externalWrites:false,protectedRoutesChanged:false},null,2));
