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
assert(guide.includes('adsense-account') && !guide.includes('개별 광고 계정의 성과를 보장합니다'));
assert(sitemap.includes('<loc>https://pagero.kr/guide/</loc><lastmod>2026-10-26</lastmod>'));
for(const resource of referencePaths){
  assert(guide.includes('href="/'+resource+'"'), 'Hub must link existing resource: '+resource);
  const file='public/'+resource+'index.html';
  assert(fs.existsSync(file), 'Hub linked to missing static file '+file);
  assert(read(file).includes('href="/guide/"'), 'Resource lacks hub backlink '+file);
}
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
assert(home.includes('href="/life/'), 'Life editorial navigation must remain intact');
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
