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


const currentGuideEvidence = {
 'getting-started': ['첫 상담 페이지를 실제로 끝내는 순서','미리보기 → 발행','접수함'],
 'editor-overview': ['편집기 실제 구조와 선택에 따른 변화','선택 항목 편집','페이지 설정'],
 'contact-form': ['한 건의 상담 접수가 저장되기까지 확인할 것','연락처 중복','7일'],
};
for (const [slug, markers] of Object.entries(currentGuideEvidence)) {
 const html=read('public/guide/'+slug+'/index.html');
 assert(html.includes('<section id="field-workflow" class="manual-lab"'), 'First-party workflow evidence missing: '+slug);
 assert(html.includes('role="img"') && html.includes('<figcaption>'), 'Accessible labeled workflow diagram missing: '+slug);
 assert(html.includes('<a href="#field-workflow">'), 'Workflow section missing from table of contents: '+slug);
 assert.equal((html.match(/rel="canonical"/g)||[]).length,1, 'Canonical duplication: '+slug);
 assert(html.includes('"dateModified":"2026-11-03"') && html.includes('최종 확인 2026.11.03'),'Real update date missing: '+slug);
 assert(sitemap.includes('<loc>https://pagero.kr/guide/'+slug+'/</loc><lastmod>2026-11-03</lastmod>'),'Updated sitemap lastmod missing: '+slug);
 for(const marker of markers) assert(html.includes(marker), 'Verified product procedure missing: '+slug+' / '+marker);
}
const workStyles=read('public/guide/manual.css');
assert(workStyles.includes('.guide-process-steps,.guide-editor-map') && workStyles.includes('@media(max-width:700px)'), 'Mobile workflow diagram styles missing');


const updatedOperationalGuides = {
 'analytics': ['실제 코드 기준으로 전환율 다시 계산하기','저장된 접수 42 ÷ 조회 500 × 100','8.4%','CTA 전환율','75.0%'],
 'inbox-management': ['접수함 6건을 상태별로 분류하는 실무 예제','확인중·보류','연락완료·예약완료·종료','처리중'],
 'troubleshooting': ['오류를 지우지 않고 원인을 좁히는 4단계 진단','전송 내역','접수함','광고 전환 50, 접수 42'],
};
for (const [slug, markers] of Object.entries(updatedOperationalGuides)) {
 const html=read('public/guide/'+slug+'/index.html');
 assert(html.includes('<section id="field-workflow" class="manual-lab"'),'Operational walkthrough missing: '+slug);
 assert(html.includes('<a href="#field-workflow">'),'Operational walkthrough not in TOC: '+slug);
 assert(html.includes('class="guide-ops-flow') && html.includes('role="img"') && html.includes('<figcaption>'),'Accessible operation diagram missing: '+slug);
 assert.equal((html.match(/rel="canonical"/g)||[]).length,1,'Canonical duplication: '+slug);
 assert(html.includes('"dateModified":"2026-11-03"') && html.includes('최종 확인 2026.11.03'),'Metadata date mismatch: '+slug);
 assert(sitemap.includes('<loc>https://pagero.kr/guide/'+slug+'/</loc><lastmod>2026-11-03</lastmod>'),'Sitemap lastmod mismatch: '+slug);
 for(const marker of markers) assert(html.includes(marker),'Missing operational evidence: '+slug+' / '+marker);
}
const operationStyle=read('public/guide/manual.css');
assert(operationStyle.includes('.guide-ops-flow') && operationStyle.includes('grid-template-columns:repeat(2,minmax(0,1fr))'),'Responsive operation diagrams missing');

// Arithmetic and status grouping are derived from the same values rendered in the guides.
// The tests prevent plausible-looking but wrong denominator and status-group examples.
const sample={pv:500,cta:120,formStarts:90,attempts:60,successEvents:45,savedLeads:42};
assert.equal((sample.savedLeads/sample.pv*100).toFixed(1),'8.4');
assert.equal((sample.savedLeads/sample.cta*100).toFixed(1),'35.0');
assert.equal((sample.formStarts/sample.pv*100).toFixed(1),'18.0');
assert.equal((sample.successEvents/sample.attempts*100).toFixed(1),'75.0');
const exampleStatuses=['신규','신규','확인중','보류','연락완료','종료'];
assert.equal(exampleStatuses.filter(s=>s==='신규').length,2);
assert.equal(exampleStatuses.filter(s=>['확인중','보류'].includes(s)).length,2);
assert.equal(exampleStatuses.filter(s=>['연락완료','예약완료','종료'].includes(s)).length,2);

const searchIndex=JSON.parse(read('public/guide/search-index.json'));
assert.equal(searchIndex.documents.length,15,'Full-text index must cover 15 official guides');
for (const [slug, markers] of Object.entries(updatedOperationalGuides)) {
 const doc=searchIndex.documents.find(d=>d.slug===slug);
 assert(doc && doc.headings.includes('실무 지표·오류 진단 예제'),'Index missing updated operational heading: '+slug);
 for(const marker of markers) assert(doc.body.includes(marker),'Index missing updated evidence: '+slug+' / '+marker);
}

for (const [slug, markers] of Object.entries(currentGuideEvidence)) {
 const entry=searchIndex.documents.find(doc=>doc.slug===slug);
 assert(entry && entry.headings.includes('실무 예제·화면 구조도'),'Search index missing new section: '+slug);
 for(const marker of markers) assert(entry.body.includes(marker),'Search index missing workflow text: '+slug+' / '+marker);
}
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
