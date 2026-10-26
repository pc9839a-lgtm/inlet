import fs from 'node:fs';

const sitemapUrls=[
  'https://pagero.kr/sitemap.xml',
  'https://pagero.kr/life/sitemap.xml',
  'https://awards.pagero.kr/sitemap.xml',
  'https://calltag.pagero.kr/sitemap.xml',
  'https://peopleent.pagero.kr/sitemap.xml',
  'https://vowday.pagero.kr/sitemap.xml',
];
const allowedHosts=new Set(sitemapUrls.map(url=>new URL(url).hostname));
const allowed=url=>{try{const o=new URL(url);return o.protocol==='https:' && allowedHosts.has(o.hostname);}catch{return false;}};
const decode=s=>String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ');
const strip=s=>decode(String(s||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const tags=(html,tag)=>html.match(new RegExp('<'+tag+'\\b[^>]*>','gi'))||[];
const attr=(tag,key)=>tag.match(new RegExp('\\b'+key+'\\s*=\\s*["\\x27]([^"\\x27]+)["\\x27]','i'))?.[1]||'';
const metas=(html,key,prop=false)=>tags(html,'meta').filter(t=>attr(t,prop?'property':'name').toLowerCase()===key.toLowerCase()).map(t=>decode(attr(t,'content')));
const canonical=(html)=>tags(html,'link').filter(t=>attr(t,'rel').toLowerCase().split(/\s+/).includes('canonical')).map(t=>decode(attr(t,'href')));
const plainTag=(html,name)=>strip(html.match(new RegExp('<'+name+'\\b[^>]*>([\\s\\S]*?)</'+name+'>','i'))?.[1]||'');
async function get(url) {
 if(!allowed(url))throw Error('unapproved host '+url);
 let err;
 for(let attempt=0;attempt<2;attempt++){
  try{
   const res=await fetch(url,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 (PageRoSEOReadOnly/2026-10-26)','Cache-Control':'no-cache'},signal:AbortSignal.timeout(17500)});
   return {status:res.status,url:res.url,body:await res.text(),type:res.headers.get('content-type')||'',xRobots:res.headers.get('x-robots-tag')||''};
  }catch(e){err=e;if(attempt===0)await new Promise(r=>setTimeout(r,650));}
 }
 throw Error(String(err));
}
const sitemapStatus=[],paths=new Map(),networkErrors=[];
for(const map of sitemapUrls){
 try{
  const res=await get(map);
  const links=[...res.body.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(m=>decode(m[1].trim())).filter(allowed);
  for(const link of links)if(!paths.has(link))paths.set(link,map);
  sitemapStatus.push({url:map,status:res.status,entries:links.length,isUrlset:res.body.includes('<urlset')});
 }catch(e){sitemapStatus.push({url:map,status:0,error:String(e)});}
}
function parsePage(url,map,res){
 const html=res.body;
 const h1=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m=>strip(m[1]));
 const title=plainTag(html,'title'),description=metas(html,'description')[0]||'';
 const cans=canonical(html);
 const jsonLd=[];
 for(const tag of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{const j=JSON.parse(tag[1]);jsonLd.push({valid:true,types: [j['@type']||'unknown']});}
  catch(e){jsonLd.push({valid:false,error:String(e).slice(0,160)});}
 }
 const anchors=[];
 for(const a of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)){
  try{
   let href=decode(a[1]);if(!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:'))continue;
   let other=new URL(href,res.url);other.hash='';
   if(allowed(other.href))anchors.push(other.href);
  }catch{}
 }
 const img=tags(html,'img');
 const imageMissingAlt=img.filter(t=>!/\balt\s*=/.test(t)).length;
 const issues=[];
 const robots=[...metas(html,'robots'),...metas(html,'googlebot'),res.xRobots].join(' | ');
 if(res.status!==200)issues.push('http_'+res.status);
 if(res.url!==url)issues.push('redirected');
 if(!res.type.includes('text/html'))issues.push('non_html');
 if(cans.length!==1||cans[0]!==url)issues.push('canonical');
 if(/noindex/i.test(robots))issues.push('noindex_in_sitemap');
 if(!title)issues.push('missing_title');
 if(h1.length!==1)issues.push('h1_count_'+h1.length);
 if(!description)issues.push('missing_description');
 if(!metas(html,'viewport').length)issues.push('missing_viewport');
 if(!/<html\b[^>]*\blang\s*=/.test(html))issues.push('missing_lang');
 if(jsonLd.some(x=>!x.valid))issues.push('invalid_json_ld');
 if(imageMissingAlt)issues.push('img_alt_attr_missing');
 const w=strip(html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]||html).length;
 if(w<300 && /\/(life|guide|insight|brand-daesang)\//.test(new URL(url).pathname) && !/\/(terms|privacy|contact|editorial-standards)\//.test(url))issues.push('short_visible_main');
 return {url,map,status:res.status,finalUrl:res.url,title,descriptionLength:description.length,h1Count:h1.length,h1:h1[0]||'',canonical:cans[0]||'',robots,mainChars:w,viewport:metas(html,'viewport')[0]||'',jsonLd,imageCount:img.length,imageMissingAlt,ogTitle:metas(html,'og:title',true)[0]||'',ogDescription:metas(html,'og:description',true)[0]||'',ogImage:metas(html,'og:image',true)[0]||'',anchors:[...new Set(anchors)],issues};
}
const all=[...paths.entries()];
const pages=[];
for(let i=0;i<all.length;i+=10){
 const batch=await Promise.all(all.slice(i,i+10).map(async([url,map])=>{
  try{return parsePage(url,map,await get(url));}
  catch(e){return {url,map,status:0,issues:['fetch_error'],error:String(e),anchors:[]};}
 }));
 pages.push(...batch);
}
const inbound=new Map(pages.map(x=>[x.url,new Set()]));
for(const p of pages)for(const to of p.anchors||[])if(inbound.has(to)&&to!==p.url)inbound.get(to).add(p.url);
for(const p of pages){
 p.incomingFromSitemapPages=inbound.get(p.url)?.size||0;
 if(p.incomingFromSitemapPages===0 && new URL(p.url).pathname!=='/' && !/\/(privacy|terms|contact|refund|editorial-standards|about)\/?$/.test(p.url))p.issues.push('no_static_incoming_from_sitemap_pages');
}
const byHost={};
for(const p of pages){const host=new URL(p.url).hostname;const site=byHost[host]??={total:0,http200:0,canonicalCorrect:0,issues:0,withStructuredData:0,orphans:0};
 site.total++;site.http200+=(p.status===200?1:0);site.canonicalCorrect+=(p.canonical===p.url?1:0);site.issues+=(p.issues.length>0?1:0);site.withStructuredData+=(p.jsonLd?.length>0?1:0);site.orphans+=(p.issues.includes('no_static_incoming_from_sitemap_pages')?1:0);
}
const issueCounts={};for(const p of pages)for(const problem of p.issues||[])issueCounts[problem]=(issueCounts[problem]||0)+1;
const report={checkedAt:new Date().toISOString(),limitations:'Public initial HTML only; Google ranking and index coverage require GSC; no rendering/core web vitals; news releases not verified for factual correctness.',sitemapStatus,pagesChecked:pages.length,byHost,issueCounts,flagged:pages.filter(p=>p.issues.length).map(({url,title,mainChars,issues,incomingFromSitemapPages})=>({url,title,mainChars,issues,incomingFromSitemapPages})),pages:pages.map(({anchors,...p})=>({...p,internalOutgoing:anchors?.length||0}))};
fs.mkdirSync('artifacts',{recursive:true});
fs.writeFileSync('artifacts/seo-fullsite-20261026.json',JSON.stringify(report,null,2)+'\n');
console.log('FULLSITE_SEO_SUMMARY',JSON.stringify({checkedAt:report.checkedAt,sitemaps:sitemapStatus,byHost,issueCounts},null,2));
console.log('FULLSITE_SEO_FLAGGED',JSON.stringify(report.flagged.slice(0,100),null,2));
if(pages.length<100||pages.some(p=>p.status!==200))process.exitCode=1;
