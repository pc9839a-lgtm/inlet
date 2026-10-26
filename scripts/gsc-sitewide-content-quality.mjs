import fs from 'node:fs';
// 2026-10-26: read-only full-site recrawl; reports must not be confused with live Google index verdicts.
const maps=['https://pagero.kr/sitemap.xml','https://pagero.kr/life/sitemap.xml','https://awards.pagero.kr/sitemap.xml','https://calltag.pagero.kr/sitemap.xml','https://peopleent.pagero.kr/sitemap.xml','https://vowday.pagero.kr/sitemap.xml'];
const HOSTS=new Set(['pagero.kr','awards.pagero.kr','calltag.pagero.kr','peopleent.pagero.kr','vowday.pagero.kr']);
const allowed=u=>{try{const x=new URL(u);return x.protocol==='https:'&&HOSTS.has(x.hostname);}catch{return false;}};
async function get(url) {
  if(!allowed(url))throw Error('Disallowed URL '+url);
  let last;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const response=await fetch(url,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 (PageRo read-only content audit)','Cache-Control':'no-cache'},signal:AbortSignal.timeout(16000)});
      return {status:response.status,url:response.url,html:await response.text(),type:response.headers.get('content-type')||'',xRobots:response.headers.get('x-robots-tag')||''};
    }catch(e){last=e;if(attempt===0)await new Promise(r=>setTimeout(r,600));}
  }
  throw Error(String(last));
}
const plain=s=>String(s||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
const part=(html,tag)=>html.match(new RegExp('<'+tag+'\\b[^>]*>([\\s\\S]*?)<\\/'+tag+'>','i'))?.[1]||'';
function metas(html,name){
  return (html.match(/<meta\b[^>]*>/gi)||[]).filter(t=>{let n=t.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1];return n?.toLowerCase()===name;}).map(t=>t.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1]||'');
}
const canonical=html=>(html.match(/<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*>/gi)||[]).map(s=>s.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]||'').filter(Boolean);
function grams(text){const s=text.normalize('NFC').toLowerCase().replace(/[^가-힣a-z0-9]/g,'');const out=new Set();for(let i=0;i<s.length-6;i++)out.add(s.slice(i,i+7));return out;}
function overlap(a,b){if(!a.size||!b.size)return 0;let count=0;for(const x of a.size<b.size?a:b)if((a.size<b.size?b:a).has(x))count++;return count/(a.size+b.size-count);}
const errors=[],sitemaps=[],allUrls=new Map(),rows=[];
await Promise.all(maps.map(async map=>{
 try {
  const v=await get(map);
  const urls=[...v.html.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(m=>m[1].trim().replaceAll('&amp;','&')).filter(u=>allowed(u)&&new URL(u).hostname===new URL(map).hostname);
  if(v.status!==200||!v.html.includes('<urlset'))errors.push({map,status:v.status,reason:'invalid_sitemap'});
  sitemaps.push({url:map,status:v.status,count:urls.length});
  for(const url of urls)allUrls.set(url,map);
 }catch(e){errors.push({map,error:String(e)});}
}));
const urls=[...allUrls].sort((a,b)=>a[0].localeCompare(b[0]));
async function inspect(url,map) {
 const item={url,sitemap:map,status:0,title:'',description:'',h1:'',canonical:'',robots:'',mainLength:0,problems:[]};
 try {
  const v=await get(url);item.status=v.status;item.finalUrl=v.url;
  item.title=plain(part(v.html,'title'));
  item.description=metas(v.html,'description')[0]||'';
  item.h1=plain(part(v.html,'h1'));
  item.canonical=canonical(v.html)[0]||'';
  item.robots=[...metas(v.html,'robots'),...metas(v.html,'googlebot'),v.xRobots].filter(Boolean).join(' | ');
  const content=part(v.html,'main')||part(v.html,'article')||part(v.html,'body');
  // A listing <main> can contain many <article> cards: extracting the first
  // <article> only produces false 'thin content' alerts. Read the entire main.
  const text=plain(content);
  item.mainLength=text.length;
  item._grams=grams(text);
  if(v.status!==200)item.problems.push('http_not_200');
  if(v.url!==url)item.problems.push('redirected');
  if(!v.type.includes('text/html'))item.problems.push('not_html');
  if(item.canonical!==url)item.problems.push('canonical_mismatch');
  if(/noindex/i.test(item.robots))item.problems.push('noindex_in_sitemap');
  if(!item.title)item.problems.push('no_title');
  if(!item.h1)item.problems.push('no_h1');
  if(item.description.length<40)item.problems.push('short_description');
  // Only substantive article pages receive a length advisory. Category hubs,
  // policy pages and trust/contact pages are intentionally shorter.
  const pathname=new URL(url).pathname;
  const bits=pathname.split('/').filter(Boolean);
  const host=new URL(url).hostname;
  const article=(host==='pagero.kr'&&bits[0]==='life'&&bits.length===3)
    ||(host==='pagero.kr'&&bits[0]==='guide'&&bits.length===2)
    ||(host==='awards.pagero.kr'&&bits[0]==='brand-daesang'&&bits.length===3)
    ||(host==='calltag.pagero.kr'&&bits[0]==='guide'&&bits.length===2)
    ||(host==='peopleent.pagero.kr'&&bits[0]==='insight'&&bits.length===2)
    ||(host==='vowday.pagero.kr'&&bits[0]==='guide'&&bits.length===2);
  if(article&&text.length<550)item.problems.push('short_article_html');
 }catch(e){item.problems.push('network_error');item.error=String(e);}
 return item;
}
for(let i=0;i<urls.length;i+=10){
 const current=await Promise.all(urls.slice(i,i+10).map(([url,map])=>inspect(url,map)));
 rows.push(...current);
}
const issues=rows.filter(r=>r.problems.length).map(({url,status,problems,title,h1,description,robots,canonical,mainLength,error})=>({url,status,problems,title,h1,description,robots,canonical,mainLength,error}));
const duplicateTitles=[],nearDuplicate=[];
const seen=new Map();
for(const r of rows){const key=new URL(r.url).hostname+'|'+r.title.toLowerCase();if(!r.title)continue;seen.set(key,[...(seen.get(key)||[]),r.url]);}
for(const [key,urls] of seen)if(urls.length>1)duplicateTitles.push({key,urls});
for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
 const a=rows[i],b=rows[j];
 if(new URL(a.url).hostname!==new URL(b.url).hostname||a.mainLength<550||b.mainLength<550)continue;
 const score=overlap(a._grams||new Set(),b._grams||new Set());
 if(score>=0.65)nearDuplicate.push({similarity:+score.toFixed(3),urls:[a.url,b.url],lengths:[a.mainLength,b.mainLength]});
}
nearDuplicate.sort((a,b)=>b.similarity-a.similarity);
const summary={scope:'Published sitemap URLs only. Google did NOT disclose its 18 crawled-not-indexed URL examples in the provided CSV.',checkedAt:new Date().toISOString(),sitemaps,total:rows.length,http200:rows.filter(r=>r.status===200).length,canonicalCorrect:rows.filter(r=>r.canonical===r.url).length,noindex:rows.filter(r=>r.problems.includes('noindex_in_sitemap')).length,issueRows:issues.length,duplicateTitleGroups:duplicateTitles.length,nearDuplicatePairs:nearDuplicate.length};
const report={summary,issues,duplicateTitles,nearDuplicate,errors,pages:rows.map(({_grams,...rest})=>rest)};
fs.mkdirSync('artifacts',{recursive:true});
fs.writeFileSync('artifacts/gsc-content-audit.json',JSON.stringify(report,null,2)+'\n');
console.log('GSC_CONTENT_SUMMARY',JSON.stringify(summary,null,2));
console.log('GSC_CONTENT_ISSUES',JSON.stringify(issues.slice(0,80),null,2));
console.log('GSC_CONTENT_DUPLICATE_TITLES',JSON.stringify(duplicateTitles.slice(0,30),null,2));
console.log('GSC_CONTENT_SIMILAR',JSON.stringify(nearDuplicate.slice(0,30),null,2));
console.log('GSC_CONTENT_ERRORS',JSON.stringify(errors,null,2));
if(errors.length||rows.length<100||rows.some(r=>r.status!==200))process.exitCode=1;
