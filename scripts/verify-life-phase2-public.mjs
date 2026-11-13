import fs from 'node:fs';
import path from 'node:path';

// Verify the current, actually published LIFE source rather than phrases and
// editorial dates hard-coded in October. This script is READ-ONLY for production.
const BASE = 'https://pagero.kr/life/';
const SOURCE = path.resolve('life-source/content/posts');
const POSTS = [
  'car/car-inspection-period',
  'car/used-car-transfer-cost',
  'support/heating-energy-support-2026',
  'support/basic-pension-2026',
  'support/year-end-tax-precheck-2026',
];
const esc = value => String(value).replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function get(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; PageRoLifeSourceParityQA/1.0)',
      'Cache-Control': 'no-cache',
    },
    signal: AbortSignal.timeout(18000),
  });
  return { status: response.status, html: await response.text(), headers: response.headers };
}
async function checkPost(relative) {
  const sourcePath = path.join(SOURCE, relative + '.json');
  if (!fs.existsSync(sourcePath)) throw Error('Published post missing from current source: ' + relative);
  const post = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  if (post.noindex) throw Error('Selected indexable post is now noindex: ' + relative);
  const url = BASE + relative + '/';
  const failures = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    failures.length = 0;
    try {
      const { status, html, headers } = await get(url);
      if (status !== 200) failures.push('HTTP=' + status);
      if (!/text\/html/i.test(headers.get('content-type') || '')) failures.push('not_html');
      if (/noindex/i.test(headers.get('x-robots-tag') || '')) failures.push('x_robots_noindex');
      if (!html.includes('<link rel="canonical" href="' + url + '">')) failures.push('canonical');
      if (!html.includes('<meta name="robots" content="index,follow')) failures.push('robots');
      if (!html.includes('<h1>' + esc(post.title) + '</h1>')) failures.push('current_source_title');
      if (!html.includes('"dateModified":"' + post.updatedAt + '"')) failures.push('source_updatedAt');
      if (!html.includes('class="article-content"')) failures.push('article_body');
      if (!html.includes('class="source-box"')) failures.push('official_sources');
      if (html.includes('생활비서 연결 오류')) failures.push('proxy_error');
    } catch (error) {
      failures.push(String(error?.message || error));
    }
    console.log('SOURCE_PARITY', relative, 'attempt', attempt,
      failures.length ? failures.join(',') : 'PASS');
    if (!failures.length) return;
    if (attempt < 3) await sleep(5000);
  }
  throw Error('Live article does not match current source: ' + relative + ' [' + failures.join(',') + ']');
}
for (const relative of POSTS) await checkPost(relative);

const sitemap = await get(BASE + 'sitemap.xml');
if (sitemap.status !== 200 || !sitemap.html.includes('<urlset')) throw Error('LIFE sitemap unavailable');
for (const relative of POSTS) {
  const post = JSON.parse(fs.readFileSync(path.join(SOURCE, relative + '.json'), 'utf8'));
  const entry = '<loc>' + BASE + relative + '/</loc><lastmod>' + post.updatedAt + '</lastmod>';
  if (!sitemap.html.includes(entry)) throw Error('Live sitemap revision mismatch: ' + relative + ' updatedAt=' + post.updatedAt);
}
const home = await get(BASE);
if (home.status !== 200 || !home.html.includes('class="modern-all-articles"')
    || !home.html.includes('class="life-home-service-grid"')) {
  throw Error('Current LIFE homepage is not publicly discoverable');
}
for (const relative of POSTS) {
  if (!home.html.includes('href="/life/' + relative + '/"')) {
    throw Error('Current LIFE editorial homepage does not link published article: ' + relative);
  }
}
console.log('PASS: Five current canonical LIFE articles, source revision dates, official citations, sitemap, and homepage navigation are public.');
