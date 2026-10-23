import fs from 'node:fs';

// Exact 94 URLs reported as 'Discovered - currently not indexed' by the site owner.
// This is a read-only HTTP and HTML diagnostic, NOT a Google indexing verdict.
const groups = {
  "awards.pagero.kr": [
    "/brand-daesang/guide/brand-awards-article-requirements/",
    "/brand-daesang/guide/brand-awards-benefits/",
    "/brand-daesang/guide/brand-awards-email-signature-phrase/",
    "/brand-daesang/guide/brand-awards-emblem-usage-period/",
    "/brand-daesang/guide/brand-awards-quotation-phrase/",
    "/brand-daesang/guide/brand-awards-website-popup-phrase/",
    "/brand-daesang/guide/brand-awards-winning-verification/",
    "/brand-daesang/guide/forbes-korea-premium-brand-application-guide/",
    "/brand-daesang/guide/kbsn-brand-awards-application-guide/",
    "/brand-daesang/guide/smartstore-award-phrase/",
    "/brand-daesang/qna/academy-education-brand-daesang/",
    "/brand-daesang/qna/consumer-choice-brand-awards/",
    "/brand-daesang/qna/customer-impression-brand-awards/",
    "/brand-daesang/qna/customer-recommendation-brand-awards/",
    "/brand-daesang/qna/food-brand-awards/",
    "/brand-daesang/qna/healthcare-brand-awards/",
    "/brand-daesang/qna/innovation-brand-awards/",
    "/brand-daesang/qna/it-solution-brand-awards/",
    "/brand-daesang/qna/korean-brand-awards/",
    "/brand-daesang/qna/pet-brand-awards/",
    "/brand-daesang/qna/sustainable-brand-awards/"
  ],
  "calltag.pagero.kr": [
    "/guide/",
    "/guide/academy-consultation-customer-management/",
    "/guide/after-call-customer-management/",
    "/guide/car-sales-customer-management/",
    "/guide/customer-management-app/",
    "/guide/external-inquiry-integration/",
    "/guide/follow-up-schedule-management/",
    "/guide/google-forms-customer-management/",
    "/guide/insurance-agent-customer-management/",
    "/guide/interior-consultation-customer-management/",
    "/guide/meta-lead-ads-customer-management/",
    "/guide/pagero-inquiry-customer-management/",
    "/guide/phone-consultation-record/",
    "/guide/real-estate-customer-management/",
    "/guide/sales-customer-management/",
    "/guide/webhook-customer-inquiry-integration/",
    "/privacy/",
    "/refund/",
    "/terms/"
  ],
  "pagero.kr": [
    "/life/car/",
    "/life/car/car-inspection-late-penalty/",
    "/life/car/car-inspection-reservation/",
    "/life/car/car-registration-certificate-reissue/",
    "/life/car/car-registration-ledger-lien-mortgage-check/",
    "/life/car/car-scrap-deregistration-tax-refund/",
    "/life/car/car-tax-annual-payment-2026/",
    "/life/car/car-tax-second-half-2026/",
    "/life/car/used-car-transfer-documents/",
    "/life/contact/",
    "/life/editorial-standards/",
    "/life/privacy-policy/",
    "/life/support/",
    "/life/support/2026-september-parental-leave-changes/",
    "/life/support/basic-pension-2026/",
    "/life/support/child-allowance-2026/",
    "/life/support/child-support-advance-payment-2026/",
    "/life/support/disability-allowance-2026/",
    "/life/support/disabled-child-allowance-2026/",
    "/life/support/earned-income-tax-credit-late-2026/",
    "/life/support/energy-voucher-2026/",
    "/life/support/female-youth-hygiene-voucher-2026/",
    "/life/support/flu-vaccination-children-2026/",
    "/life/support/heating-energy-support-2026/",
    "/life/support/infertility-leave-benefit-2026/",
    "/life/support/livelihood-benefit-2026/",
    "/life/support/low-income-diaper-formula-support-2026/",
    "/life/support/parental-benefit-2026/",
    "/life/support/unemployment-benefit-eligibility-2026/"
  ],
  "peopleent.pagero.kr": [
    "/academic-event/",
    "/conference/",
    "/corporate-event/",
    "/insight/",
    "/insight/conference-operation-checklist/",
    "/insight/corporate-seminar-checklist/",
    "/insight/corporate-workshop-planning/",
    "/insight/event-agency-checklist/",
    "/insight/event-agency-cost/",
    "/insight/event-photography-cost/",
    "/insight/event-print-production-guide/",
    "/insight/live-streaming-cost/",
    "/insight/pco-vs-event-agency/",
    "/insight/public-event-practical-guide/",
    "/live-streaming/",
    "/public-event/",
    "/seminar/"
  ],
  "vowday.pagero.kr": [
    "/",
    "/guide/",
    "/guide/wedding-desk-checklist/",
    "/guide/wedding-desk-cost/",
    "/guide/wedding-desk-friend-vs-service/",
    "/guide/wedding-desk/",
    "/guide/wedding-gift-live-ledger/",
    "/guide/wedding-gift-settlement/"
  ]
};

const hubs = {
  'awards.pagero.kr': ['/','/brand-daesang/'],
  'calltag.pagero.kr': ['/','/guide/'],
  'pagero.kr': ['/','/life/','/life/car/','/life/support/'],
  'peopleent.pagero.kr': ['/','/insight/'],
  'vowday.pagero.kr': ['/','/guide/'],
};
const snapshotAt = new Date().toISOString();
const findings = [];
const errors = [];
const notes = [];
const TIMEOUT_MS = 16000;
function note(host,code,message){notes.push({host,code,message:String(message)});}
async function fetchPage(url) {
  let last;
  for (let i=0;i<3;i++) {
    try{
      const res=await fetch(url,{
        redirect:'follow',
        headers:{'User-Agent':'Mozilla/5.0 (compatible; PageRoGscDiscovered94ReadOnlyAudit/1.0)','Cache-Control':'no-cache'},
        signal:AbortSignal.timeout(TIMEOUT_MS),
      });
      return {status:res.status,finalUrl:res.url,body:await res.text(),headers:res.headers};
    }catch(err){last=err;if(i<2)await new Promise(r=>setTimeout(r,500*(i+1)));}
  }
  throw Error(String(last?.message||last));
}
function matchCanonical(body) {
  const tags=body.match(/<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*>/gi)||[];
  return tags.map(tag=>tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]||'').filter(Boolean);
}
function metaNoindex(body) {
  return /<meta\b(?=[^>]*\bname\s*=\s*["'](?:robots|googlebot)["'])(?=[^>]*\bcontent\s*=\s*["'][^"']*\bnoindex\b)[^>]*>/i.test(body);
}
const sitemapCache=new Map();
async function getSitemap(host,pathname) {
  const key=host+(pathname.startsWith('/life/')?'/life':'');
  if(sitemapCache.has(key))return sitemapCache.get(key);
  const url='https://'+host+(pathname.startsWith('/life/')?'/life/sitemap.xml':'/sitemap.xml');
  try{
    const res=await fetchPage(url);
    const urls=new Set([...res.body.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map(x=>x[1].replaceAll('&amp;','&').trim()));
    const value={status:res.status,urls,at:url};
    sitemapCache.set(key,value);
    return value;
  }catch(err){
    const value={status:0,urls:new Set(),at:url,error:String(err)};
    sitemapCache.set(key,value);
    return value;
  }
}
async function checkHost(host,paths){
  const hubContent=[];
  for (const hub of hubs[host]) {
    try {
      const res=await fetchPage('https://'+host+hub);
      hubContent.push({hub,body:res.body,status:res.status});
    } catch(error){note(host,'hub_network',hub+': '+String(error));}
  }
  const robots=await fetchPage('https://'+host+'/robots.txt').catch(err=>({status:0,body:String(err)}));
  note(host,'robots_status',robots.status);
  const results=[];
  for(let i=0;i<paths.length;i+=6){
    const batch=paths.slice(i,i+6);
    const checked=await Promise.all(batch.map(async pathname=>{
      const url='https://'+host+pathname;
      const item={url,status:0,canonical:'',inSitemap:false,hasSourceLink:false,noindex:false,hasH1:false,bodyChars:0,issues:[]};
      try{
        const res=await fetchPage(url);
        item.status=res.status;
        item.finalUrl=res.finalUrl;
        item.noindex=metaNoindex(res.body)||/noindex/i.test(res.headers.get('x-robots-tag')||'');
        const canonicals=matchCanonical(res.body);
        item.canonical=canonicals[0]||'';
        item.hasH1=/<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(res.body);
        item.bodyChars=res.body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().length;
        if(res.status!==200)item.issues.push('http_'+res.status);
        if(!res.headers.get('content-type')?.includes('text/html'))item.issues.push('not_html');
        if(item.noindex)item.issues.push('noindex');
        if(canonicals.length!==1||item.canonical!==url)item.issues.push('canonical');
        if(!item.hasH1)item.issues.push('no_ssr_h1');
        if(item.bodyChars<500)item.issues.push('thin_initial_html');
        const sitemap=await getSitemap(host,pathname);
        item.sitemapStatus=sitemap.status;
        item.inSitemap=sitemap.urls.has(url);
        if(sitemap.status!==200)item.issues.push('sitemap_unavailable');
        if(!item.inSitemap && !['/privacy/','/refund/','/terms/','/contact/','/privacy-policy/','/editorial-standards/'].includes(pathname))item.issues.push('missing_sitemap');
        item.hasSourceLink=hubContent.some(h=>h.status===200 && (h.body.includes('href="'+pathname+'"')||h.body.includes("href='"+pathname+"'")||h.body.includes('href="'+url+'"')));
        if(!item.hasSourceLink)item.issues.push('not_linked_from_hubs_initial_html');
      }catch(error){item.issues.push('network: '+String(error));}
      return item;
    }));
    results.push(...checked);
  }
  return results;
}
for(const [host,paths] of Object.entries(groups)){
  const items=await checkHost(host,paths);
  findings.push(...items);
  console.log('DISCOVERED94_HOST',JSON.stringify({host,count:items.length,http200:items.filter(x=>x.status===200).length,noindex:items.filter(x=>x.noindex).length,canonicalMismatch:items.filter(x=>x.issues.includes('canonical')).length,hubLinked:items.filter(x=>x.hasSourceLink).length,sitemapListed:items.filter(x=>x.inSitemap).length}));
}
// Distinct from the 94 discovered URLs: historical 'Excluded by noindex' first article.
const businessVoucherUrl='https://pagero.kr/life/support/small-business-management-voucher-2026/';
let businessVoucher={url:businessVoucherUrl};
try{
  const res=await fetchPage(businessVoucherUrl);
  const can=matchCanonical(res.body);
  businessVoucher={url:businessVoucherUrl,status:res.status,robotsMetaNoindex:metaNoindex(res.body),xRobots:res.headers.get('x-robots-tag'),canonical:can[0]||'',inSitemap:(await getSitemap('pagero.kr','/life/support/small-business-management-voucher-2026/')).urls.has(businessVoucherUrl)};
}catch(e){businessVoucher.error=String(e);}
if(businessVoucher.status!==200||businessVoucher.robotsMetaNoindex||/noindex/i.test(businessVoucher.xRobots||'')||businessVoucher.canonical!==businessVoucherUrl)errors.push({reason:'voucher_not_indexable',businessVoucher});
const totals={
 urls:findings.length,
 byHost:Object.fromEntries(Object.keys(groups).map(host=>[host,{total:findings.filter(f=>f.url.startsWith('https://'+host+'/')).length,http200:findings.filter(f=>f.url.startsWith('https://'+host+'/')&&f.status===200).length}])),
 http200:findings.filter(f=>f.status===200).length,
 canonicalCorrect:findings.filter(f=>f.canonical===f.url).length,
 noindex:findings.filter(f=>f.noindex).length,
 listedSitemap:findings.filter(f=>f.inSitemap).length,
 linkedFromInitialHubHtml:findings.filter(f=>f.hasSourceLink).length,
};
if(findings.length!==94)errors.push({reason:'count_mismatch',got:findings.length});
for(const f of findings){if(f.status!==200||f.noindex||!f.canonical||f.canonical!==f.url||f.issues.some(x=>x.startsWith('network:')))errors.push({url:f.url,issues:f.issues});}
const report={checkedAt:snapshotAt,scope:'Read-only HTTP/HTML probe of exact 94 GSC-discovered URLs; never asserts Google crawl/index status',totals,businessVoucher,errors,findings,notes};
fs.mkdirSync('artifacts',{recursive:true});
fs.writeFileSync('artifacts/gsc-discovered94-public-audit.json',JSON.stringify(report,null,2)+'\n');
console.log('DISCOVERED94_SUMMARY',JSON.stringify({totals,businessVoucher,criticalErrors:errors.length,sampleErrors:errors.slice(0,12)},null,2));
if(errors.length)process.exitCode=1;
