import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'https://pagero.kr';
const LIFE = ROOT + '/life';
const SOURCE = process.env.LIFE_SOURCE_DIR || 'life-source';
const TIMEOUT = 18000;
const PROBLEMS = [];
const DETAILS = [];
const warn = (code, detail) => { PROBLEMS.push({ code, detail: String(detail) }); };
const got = (code, detail) => { DETAILS.push({ code, detail: String(detail) }); };
const plain = (value) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

async function get(url) {
  let error;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PageRoPublicReadOnlyQA/1.0)', 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(TIMEOUT),
      });
      return { status: res.status, final: res.url, html: await res.text(), headers: res.headers };
    } catch (e) {
      error = e;
      await new Promise(resolve => setTimeout(resolve, 900 * (attempt + 1)));
    }
  }
  throw Error(url + ': ' + (error?.message || 'network error'));
}
function manifest() {
  const dir = path.join(SOURCE, 'content/posts');
  const walk = p => fs.readdirSync(p, { withFileTypes: true }).flatMap(e => {
    const full = path.join(p, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
  return walk(dir).filter(x => x.endsWith('.json'))
    .map(file => JSON.parse(fs.readFileSync(file, 'utf8')))
    .filter(post => !post.noindex)
    .map(post => ({ pathname: '/life/' + post.category + '/' + post.slug + '/', title: post.title, category: post.category }))
    .sort((a,b) => a.pathname.localeCompare(b.pathname));
}
const articles = manifest();
if (articles.length !== 45) warn('manifest_count', 'Expected 45 published articles, found ' + articles.length);

const [root, index, rootSitemap, lifeSitemap, robots, lifeRobots, adsTxt, privacy, standards, continuation] = await Promise.all([
  get(ROOT + '/'), get(LIFE + '/'), get(ROOT + '/sitemap.xml'),
  get(LIFE + '/sitemap.xml'), get(ROOT + '/robots.txt'), get(LIFE + '/robots.txt'),
  get(ROOT + '/ads.txt'), get(LIFE + '/privacy-policy/'),
  get(LIFE + '/editorial-standards/'),
  get(LIFE + '/car/car-inspection-period/2/'),
]);
// Phase 3: verify live AdSense identity, privacy disclosures,
// canonical/legacy host consolidation and non-indexed continuation pages.
const expectedPublisher = 'pub-1906196934401001';
if (adsTxt.status !== 200 || !adsTxt.html.includes(`google.com, ${expectedPublisher}, DIRECT, f08c47fec0942fa0`)) {
  warn('root_ads_txt', 'Live ads.txt is missing or does not match the published AdSense client');
}
if (!root.html.includes('ca-' + expectedPublisher)) {
  warn('root_publisher_mismatch', 'Root publisher identity does not match ads.txt');
}
if (privacy.status !== 200 || !privacy.html.includes('Google AdSense') ||
    !privacy.html.includes('https://adssettings.google.com/') ||
    !privacy.html.includes('https://policies.google.com/technologies/partner-sites')) {
  warn('life_privacy_disclosures', 'Google advertising cookie and opt-out disclosures missing from live privacy policy');
}
if (standards.status !== 200 || !standards.html.includes('광고와 편집의 분리')) {
  warn('life_editorial_standards', 'Published editorial standards could not be verified');
}
const continuationUrl = LIFE + '/car/car-inspection-period/2/';
if (continuation.status !== 200 ||
    !/<meta\s+name="robots"\s+content="noindex,follow/i.test(continuation.html) ||
    !continuation.html.includes(`<link rel="canonical" href="${continuationUrl}">`)) {
  warn('life_continuation_indexing', 'Continued guide must be noindex with self-canonical');
}
try {
  const oldUrl = 'https://life.pagero.kr/car/car-inspection-period/';
  const redirectResponse = await fetch(oldUrl, {
    redirect: 'manual',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PageRoPhase3QA/1.0)' },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const location = redirectResponse.headers.get('location') || '';
  if (redirectResponse.status !== 301 || location !== ROOT + '/life/car/car-inspection-period/') {
    warn('legacy_life_redirect', `expected 301 to canonical; received ${redirectResponse.status} location=${location}`);
  }
} catch (error) {
  warn('legacy_life_redirect_network', String(error));
}
got('phase3', 'Checked ads.txt, root publisher, privacy, editorial policy, legacy redirect and noindex continuation');

if (root.status !== 200) warn('root_status', root.status);
if (index.status !== 200) warn('life_index_status', index.status);
if (!root.html.includes('c63-assets/index-pagero-main-fix-20260615.js')) warn('root_not_actual_c63', 'Frozen production bundle not loaded');
if (!root.html.includes('name="google-adsense-account"')) warn('root_adsense_verification', 'Publisher verification missing');
if (!root.html.includes('<link rel="canonical" href="https://pagero.kr/"')) warn('root_canonical', 'Main canonical is missing');
if (!root.html.includes('href="/life/"')) warn('root_life_discovery', 'LIFE publisher hub not discoverable in initial HTML');
if (/noindex/i.test(root.headers.get('x-robots-tag') || '')) warn('root_noindex', 'Root response blocks indexing');
if (robots.status !== 200 || !robots.html.includes('Sitemap: https://pagero.kr/life/sitemap.xml')) warn('robots_life_sitemap', 'Root robots missing LIFE sitemap');
if (lifeRobots.status !== 200 || !lifeRobots.html.includes('Sitemap: https://pagero.kr/life/sitemap.xml')) warn('life_robots_status', 'Expected LIFE sitemap declaration; HTTP '+lifeRobots.status);
if (rootSitemap.status !== 200 || !rootSitemap.html.includes('<urlset')) warn('root_sitemap', 'Invalid root sitemap response');

const guideHub = await get(ROOT + '/guide/');
const hubCanonical = ROOT + '/guide/';
const guideResources = [
  '/guide/landing-page-prelaunch/',
  '/guide/form-submission-debug/',
  '/guide/lead-funnel-metrics/',
  '/tools/lead-calculator/',
];
if (guideHub.status !== 200 || !guideHub.headers.get('content-type')?.includes('text/html')) {
  warn('pagero_guide_hub_http', 'Guide hub should serve HTTP 200 HTML on canonical pagero.kr');
}
if (!guideHub.html.includes('<link rel="canonical" href="' + hubCanonical + '">')) {
  warn('pagero_guide_hub_canonical', 'Guide hub canonical missing or incorrect');
}
if (!guideHub.html.includes('name="description"') || !guideHub.html.includes('<h1>')) {
  warn('pagero_guide_hub_html', 'Guide hub missing crawlable title/description/H1');
}
if (!root.html.includes('href="/guide/"')) {
  warn('pagero_guide_hub_discovery', 'Main PageRo HTML must have a static link to the editorial hub');
}
if (!rootSitemap.html.includes('<loc>' + hubCanonical + '</loc>')) {
  warn('pagero_guide_hub_sitemap', 'Main sitemap does not include canonical editorial guide hub');
}
for (const resource of guideResources) {
  if (!guideHub.html.includes('href="' + resource + '"')) {
    warn('pagero_guide_resource', 'Guide hub did not link the existing resource: '+resource);
  }
}
got('pagero_guide_hub', 'Checked canonical crawlable guide hub and its four verified practical resources on public main site');

if (lifeSitemap.status !== 200 || !lifeSitemap.html.includes('<urlset')) warn('life_sitemap', 'Invalid LIFE sitemap response');
if (!index.html.includes('LIFE EDITORIAL ARCHIVE')) warn('life_home_archive', '45-article editorial index missing');

const decisionPaths = [
  ['/life/car/car-inspection-period/','검사기간 확인'],
  ['/life/car/car-inspection-reservation/','검사 예약'],
  ['/life/car/used-car-transfer-documents/','명의이전 서류'],
  ['/life/car/used-car-transfer-cost/','이전비용'],
  ['/life/support/child-allowance-2026/','아동수당'],
  ['/life/support/parental-benefit-2026/','부모급여'],
  ['/life/support/basic-pension-2026/','기초연금'],
  ['/life/support/livelihood-benefit-2026/','생계급여'],
];
if (!index.html.includes('id="life-pathways-title"')) warn('life_decision_hub', 'Situation-first editorial navigation is missing from public homepage');
for (const [url, label] of decisionPaths) {
  if (!index.html.includes('href="'+url+'"')) warn('life_decision_link_missing', label+': '+url);
}
got('life_reader_pathways','Checked practical reading paths for car administration and household support in real production HTML');

if (!index.html.includes('href="/life/editorial-standards/"')) warn('editorial_policy_discovery', 'Editorial standards link not directly discoverable');

const listed = new Set([...lifeSitemap.html.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map(m => m[1].replace(/&amp;/g, '&')));
const missingIndex = [];
const missingSitemap = [];
for (const post of articles) {
  const canonical = ROOT + post.pathname;
  if (!listed.has(canonical)) missingSitemap.push(post.pathname);
  if (!index.html.includes('href="' + post.pathname + '"')) missingIndex.push(post.pathname);
}
if (missingIndex.length) warn('home_to_articles', missingIndex.slice(0,12).join(', ') + ' total=' + missingIndex.length);
if (missingSitemap.length) warn('sitemap_to_articles', missingSitemap.slice(0,12).join(', ') + ' total=' + missingSitemap.length);
got('discovery', 'LIFE listed article URLs=' + listed.size + ', publisher source articles=' + articles.length);

const decisionArticles = new Set([
  '/life/car/car-inspection-period/',
  '/life/car/car-inspection-reservation/',
  '/life/car/used-car-transfer-documents/',
  '/life/car/used-car-transfer-cost/',
  '/life/support/child-allowance-2026/',
  '/life/support/parental-benefit-2026/',
  '/life/support/livelihood-benefit-2026/',
  '/life/support/housing-benefit-2026/',
]);
if (!standards.html.includes('작성·검수 기준 확인일: 2026-10-23')) {
  warn('life_editorial_date', 'Editorial policy review date was replaced by build date or is missing');
}
got('reader_decisions', 'Eight canonical LIFE guides must contain a situation-based comparison section');

const batches = [];
for (let i = 0; i < articles.length; i += 8) batches.push(articles.slice(i,i+8));
let goodArticles = 0;
const failing = [];
for (const batch of batches) {
  const results = await Promise.all(batch.map(async post => {
    try { return { post, response: await get(ROOT + post.pathname) }; }
    catch (error) { return { post, error: String(error) }; }
  }));
  for (const {post,response,error} of results) {
    const problems = [];
    const url = ROOT + post.pathname;
    if (error) problems.push('network: ' + error);
    else {
      const html = response.html;
      const meta = html.match(/<meta\s+name="robots"[^>]*>/i)?.[0] || '';
      const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1] || '';
      const heading = plain(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
      if (response.status !== 200) problems.push('HTTP ' + response.status);
      if (!response.headers.get('content-type')?.includes('text/html')) problems.push('not_html');
      if (!meta.includes('index,follow') || meta.includes('noindex')) problems.push('not_indexable');
      if (/noindex/i.test(response.headers.get('x-robots-tag') || '')) problems.push('x_robots_noindex');
      if (canonical !== url) problems.push('canonical=' + canonical);
      if (!heading || !heading.includes(post.title)) problems.push('h1=' + heading.slice(0,90));
      if (!html.includes('href="/life/"') && !html.includes('href="/life/car/"')) problems.push('missing_life_navigation');
      if (!html.includes('href="https://') && !html.includes('href="http://')) problems.push('no_external_citations');
      if (html.includes('생활비서 연결 오류')) problems.push('proxy_fallback');
      if (decisionArticles.has(post.pathname) && !html.includes('<section class="reader-decision"')) problems.push('missing_practical_comparison');
    }
    if (problems.length) failing.push({ page: post.pathname, problems });
    else goodArticles++;
  }
  console.log('LIVE_CRAWL_PROGRESS', goodArticles, '/', articles.length, 'failed', failing.length);
}
if (failing.length) warn('live_article_failures', JSON.stringify(failing.slice(0,15)) + ' total=' + failing.length);

const summary = {
  checked_at: new Date().toISOString(),
  scope: 'Read-only public SEO/renderability check; NOT a Google AdSense approval verdict',
  dashboard_access: false,
  production_modified: false,
  root_status: root.status,
  ads_txt_status: adsTxt.status,
  privacy_status: privacy.status,
  editorial_standards_status: standards.status,
  continuation_status: continuation.status,
  life_index_status: index.status,
  published_articles: articles.length,
  valid_public_articles: goodArticles,
  sitemap_urls: listed.size,
  homepage_linked_articles: articles.length - missingIndex.length,
  critical_errors: PROBLEMS.length,
  errors: PROBLEMS,
  notes: DETAILS,
};
fs.mkdirSync('artifacts', {recursive:true});
fs.writeFileSync('artifacts/adsense-public-crawl.json', JSON.stringify(summary,null,2)+'\n');
console.log('ADSENSE_PUBLIC_CRAWL_REPORT', JSON.stringify(summary,null,2));
if (PROBLEMS.length) process.exitCode = 1;
