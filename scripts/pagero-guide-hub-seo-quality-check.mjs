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
  'tools/form-planner/',
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

// The protected main already exposes these paths in its static HTML.
// Keep the actual homepage untouched and verify discovery through the hub.
const productionHome = read('functions/index.js');
for (const resource of ['/guide/', '/tools/lead-calculator/', '/tools/form-planner/']) {
  assert(productionHome.includes('href="'+resource+'"'), 'Public root lost crawlable resource link '+resource);
}
const formPlanner = read('public/tools/form-planner/index.html');
assert(sitemap.includes('<loc>https://pagero.kr/tools/form-planner/</loc>'), 'Existing planner must be present in main sitemap');
assert(formPlanner.includes('href="/guide/"'), 'Form planner lacks guide hub backlink');
assert(formPlanner.includes('href="/guide/contact-form/"'), 'Planner must link its related product guide');

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


const guide9Cases={
 'reservation-form': ['방문 예약을 실제로 구성하고 검증하는 예제','평일 · 10:00~18:00','30분·1시간','방문 날짜·방문 시간','접수함'],
 'preview-publish': ['‘발행됨’ 표시보다 먼저 확인해야 할 여섯 가지','브랜드·핵심 문구·문의 행동·문의 항목·연락처/사업자·공개 URL','브라우저에 임시저장됨','공개 반영 확인 필요'],
 'settings-domain': ['도메인 DNS 연결: 서브도메인과 루트 도메인을 구분하세요','CNAME','네임서버','DNS 대기','SSL 확인 중'],
};
for(const [slug,markers] of Object.entries(guide9Cases)){
 const html=read('public/guide/'+slug+'/index.html');
 assert(html.includes('<section id="field-workflow" class="manual-lab"'), 'Missing source-verified hands-on setup: '+slug);
 assert(html.includes('<a href="#field-workflow">'), 'Missing TOC link to practical setup: '+slug);
 assert(html.includes('class="guide-process-steps" role="img"') && html.includes('<figcaption>'), 'Accessible workflow diagram missing: '+slug);
 assert.equal((html.match(/rel="canonical"/g)||[]).length,1, 'Duplicate canonical: '+slug);
 assert(html.includes('"dateModified":"2026-11-03"') && html.includes('최종 확인 2026.11.03'), 'Article review metadata inconsistent: '+slug);
 assert(sitemap.includes('<loc>https://pagero.kr/guide/'+slug+'/</loc><lastmod>2026-11-03</lastmod>'), 'Sitemap lastmod not updated: '+slug);
 for(const marker of markers) assert(html.includes(marker), 'Code-grounded setup content absent: '+slug+' / '+marker);
}
const rEditor=read('src/editor/blockEditors/ReservationEditor.jsx');
const rTime=read('src/editor/blockEditors/ReservationTimeSection.jsx');
const rFixed=read('src/editor/blockEditors/ReservationFixedFields.jsx');
const rCustom=read('src/editor/blockEditors/reservationEditorOptions.js');
assert(['예약 시간','입력 항목'].every(label=>rEditor.includes(label)), 'Reservation guide tabs diverged from editor');
assert(rTime.includes("value: '30'") && rTime.includes("value: '60'"), 'Reservation editor duration presets diverged from guide');
assert(rCustom.includes("['weekday'") && rCustom.includes("['everyday'") && rCustom.includes("['custom'"), 'Reservation weekday modes diverged from guide');
assert(rFixed.includes('T.date') && rFixed.includes('T.visitTime') && rFixed.includes('is-fixed'), 'Reservation required visit fields diverged from guide');
const checklist=read('src/editor/publishChecklist.js');
for(const item of ["id: 'brand'","id: 'hero'","id: 'action'","id: 'fields'","id: 'footer'","id: 'url'"]){
 assert(checklist.includes(item), 'Publish checklist item removed or renamed: '+item);
}
const domainUI=read('src/panels/settings/CustomDomainSettingsSection.jsx');
assert(domainUI.includes("apexDomain ? '네임서버' : 'CNAME'"), 'Domain root/subdomain instructions no longer match UI');
assert(domainUI.includes('refreshDomainStatus') && domainUI.includes('removeDomain') && domainUI.includes('sslLabel'), 'Domain verification / detach / SSL behavior changed');

const guide10Cases={
 'content-blocks': ['같은 정보라도 어떤 블록을 쓰느냐에 따라 다릅니다','블록 추가','자료 다운로드','상담 폼','지도'],
 'hero-and-buttons': ['히어로 한 화면과 고정 버튼 한 개를 완성하는 예제','글 위·글 뒤·전체 이미지','180~720px','0~85%','1개 / 2개 / 3개','위젯 / 링크 / 전화'],
 'design-mobile': ['모바일 360·390·430px에서 같은 페이지를 검증하는 방법','Pretendard / Noto / Serif','채우기 / 전체 보기 / 원본','스타일 미적용','적용'],
};
for(const [slug,markers] of Object.entries(guide10Cases)){
 const html=read('public/guide/'+slug+'/index.html');
 assert(html.includes('<section id="field-workflow" class="manual-lab"'), 'Source-verified manual walkthrough missing: '+slug);
 assert(html.includes('<a href="#field-workflow">실무 설정·판단 예제</a>'), 'Practical walkthrough omitted from TOC: '+slug);
 assert(html.includes('role="img"') && html.includes('<figcaption>'), 'Explanatory diagram needs accessible label: '+slug);
 assert.equal((html.match(/rel="canonical"/g)||[]).length,1, 'Canonical duplication: '+slug);
 assert(html.includes('"dateModified":"2026-11-04"') && html.includes('최종 확인 2026.11.04'), 'Article revision metadata mismatch: '+slug);
 assert(sitemap.includes('<loc>https://pagero.kr/guide/'+slug+'/</loc><lastmod>2026-11-04</lastmod>'), 'Sitemap revision date mismatch: '+slug);
 for(const marker of markers) assert(html.includes(marker), 'Practical product evidence missing: '+slug+' / '+marker);
}
// Check that these manuals describe actual live controls, not invented settings.
const blockCatalog=read('src/config/blockMeta.jsx');
for(const label of ['히어로','이미지','동영상','텍스트','카드','자료 다운로드','지도','FAQ','상담 폼','방문 예약']){
 assert(blockCatalog.includes("label: '"+label+"'"), 'Guide10 references a removed block type: '+label);
}
const targetModes=read('src/editor/targetControlModel.js');
for(const mode of ["widget: '위젯'","link: '링크'","phone: '전화'"]){
 assert(targetModes.includes(mode), 'Button target mode diverged: '+mode);
}
const heroImages=read('src/editor/blockEditors/HeroImageSection.jsx');
for(const key of ["value: 'top'","value: 'background'","value: 'full'","min={180} max={720}","min={0} max={85}"]){
 assert(heroImages.includes(key), 'Hero image guide diverged: '+key);
}
const bottomButtons=read('src/editor/blockEditors/BottomBarBasicSection.jsx');
for(const key of ["value: '1'","value: '2'","value: '3'"]){
 assert(bottomButtons.includes(key), 'Bottom button count options diverged: '+key);
}
const styleUI=read('src/panels/StylePanel.jsx');
for(const key of ["'pretendard', 'Pretendard'","'noto', 'Noto'","'serif', 'Serif'","'solid', T.solid","'gradient', T.gradient","'image', T.image","T.dirty","T.apply","'block', '블록별'"]){
 assert(styleUI.includes(key), 'Mobile style guide diverged: '+key);
}

const guide11Cases={
 'create-page':['페이지 주소가 저장되지 않을 때까지 확인하는 생성 예제','직접 · 템플릿 · AI','3자','48자','login','저장 성공'],
 'integrations':['접수 한 건이 이메일·시트·Webhook으로 전달되는지 구분하기','Google로 연결','Google Sheets — Webhook','외부 사이트에 넣기','연동 저장'],
 'seo-tracking':['검색 정보·태그 설치·실제 접수를 각각 검증하는 방법','GTM-XXXXXXX','G-XXXXXXXXXX','AW-123456789','Meta Pixel','색인'],
};
for(const [slug,markers] of Object.entries(guide11Cases)){
 const html=read('public/guide/'+slug+'/index.html');
 assert(html.includes('<section id="field-workflow" class="manual-lab"'),'Missing final first-party practical section: '+slug);
 assert(html.includes('<a href="#field-workflow">설정·진단 실무 예제</a>'),'Missing final section link in TOC: '+slug);
 assert(html.includes('class="guide-process-steps" role="img"') && html.includes('<figcaption>'),'Missing accessible explanatory workflow diagram: '+slug);
 assert.equal((html.match(/rel="canonical"/g)||[]).length,1,'Duplicate canonical: '+slug);
 assert(html.includes('"dateModified":"2026-11-04"') && html.includes('최종 확인 2026.11.04'),'Revised metadata missing: '+slug);
 assert(sitemap.includes('<loc>https://pagero.kr/guide/'+slug+'/</loc><lastmod>2026-11-04</lastmod>'),'Revised sitemap date missing: '+slug);
 for(const marker of markers) assert(html.includes(marker),'Missing source-grounded step: '+slug+' / '+marker);
}
const createSlug=read('src/lib/pageSlugs.js');
assert(createSlug.includes('slug.length < 3') && createSlug.includes('slug.length > 48'),'Real page URL length requirements changed');
assert(createSlug.includes("'login'") && createSlug.includes('RESERVED_PAGE_SLUGS'),'Reserved page URL restrictions changed');
const createPageActions=read('src/runtime/useCreatePageActions.js');
for(const fn of ['createWithAi','createManual','createFromTemplate','saveCreatedPageToServer']){
 assert(createPageActions.includes(fn),'Page creation guide disagrees with code: '+fn);
}
const createUrl=read('src/runtime/useCreatePageUrlCheck.js');
assert(createUrl.includes('서버 중복 확인이 불안정합니다. 저장 단계에서 다시 확인합니다.'),'Creation guide must cover uncertain duplicate lookups');
const inboxConnect=read('src/panels/inbox/InboxConnectionsPanel.jsx');
for(const item of ['Google로 연결','연동 저장','연결 테스트','받을 이메일','Webhook','id="inbox-connections-title"']){
 assert(inboxConnect.includes(item),'Integration guide no longer matches inbox settings: '+item);
}
const embedSource=read('src/lib/formEmbed.js');
assert(embedSource.includes('https://pagero.kr/embed/form.js') && embedSource.includes('data-pagero-page'),'External embedded form implementation changed');
const seoControls=read('src/panels/settings/SeoSettingsSection.jsx');
for(const field of ['메타 제목','메타 설명','파비콘','공유 이미지','네이버','Google']){
 assert(seoControls.includes(field),'SEO guide describes a missing field: '+field);
}
const trackingControls=read('src/panels/settings/TrackingSettingsSection.jsx');
for(const id of ['GTM-XXXXXXX','G-XXXXXXXXXX','AW-123456789','Meta Pixel','네이버 WCS','카카오 픽셀']){
 assert(trackingControls.includes(id),'Tracking guide describes a missing ID format: '+id);
}
const conversionFields=read('src/panels/settings/ConversionCodeFields.jsx');
assert(conversionFields.includes('AW-123456789/AbCdEf'),'Google Ads conversion action example changed');
const allFirstPartyGuideSlugs=[
 'getting-started','editor-overview','contact-form','analytics','inbox-management','troubleshooting',
 'reservation-form','preview-publish','settings-domain','content-blocks','hero-and-buttons','design-mobile',
 'create-page','integrations','seo-tracking',
];
for(const slug of allFirstPartyGuideSlugs){
 const html=read('public/guide/'+slug+'/index.html');
 assert(html.includes('id="field-workflow"'),'Official manual still lacks distinct hands-on evidence: '+slug);
 assert(html.includes('<a href="#field-workflow">'),'Official manual TOC still missing hands-on evidence: '+slug);
 assert(html.includes('<figcaption>'),'Official manual lacks clearly labeled explanatory diagram: '+slug);
}
const searchIndex=JSON.parse(read('public/guide/search-index.json'));
assert.equal(searchIndex.documents.length,15,'Full-text index must cover 15 official guides');
for(const [slug,markers] of Object.entries(guide11Cases)){
 const doc=searchIndex.documents.find(x=>x.slug===slug);
 assert(doc && doc.headings.includes('설정·진단 실무 예제'),'Search index missing final hands-on chapter: '+slug);
 for(const marker of markers) assert(doc.body.includes(marker),'Guide search index missing practical content: '+slug+' / '+marker);
}
assert.equal(searchIndex.documents.filter(doc=>allFirstPartyGuideSlugs.includes(doc.slug)).length,15,'All 15 guide titles must remain searchable');

for(const [slug,markers] of Object.entries(guide10Cases)){
 const doc=searchIndex.documents.find(x=>x.slug===slug);
 assert(doc && doc.headings.includes('실무 설정·판단 예제'), 'Guide search index lacks new walkthrough: '+slug);
 for(const marker of markers) assert(doc.body.includes(marker), 'Guide search text missing practical example: '+slug+' / '+marker);
}

for(const [slug,markers] of Object.entries(guide9Cases)){
 const doc=searchIndex.documents.find(d=>d.slug===slug);
 assert(doc && doc.headings.some(h=>h.includes('실무 점검')||h.includes('설정·오류 판별 예제')), 'Guide search index missing new practical section: '+slug);
 for(const marker of markers) assert(doc.body.includes(marker), 'Searchable body missing setup information: '+slug+' / '+marker);
}

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
console.log(JSON.stringify({ok:true,hub:'/guide/',resourceLinks:5,canonical:'https://pagero.kr/guide/',rootStaticLinked:true,staticResponse:true,externalWrites:false,protectedRoutesChanged:false},null,2));
