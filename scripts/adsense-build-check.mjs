import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--outDir');
const output = outIndex >= 0 ? args[outIndex + 1] : 'dist';
if (!output) throw new Error('Missing --outDir argument');
const dist = path.resolve(process.cwd(), output);
const publisher = '1906196934401001';
const load = (relative) => {
  const file = path.join(dist, relative);
  if (!fs.existsSync(file)) throw new Error(`AdSense check: missing ${relative} in ${dist}`);
  return fs.readFileSync(file, 'utf8');
};

const html = load('index.html');
const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
if (!new RegExp(`<meta\\s+name=["']google-adsense-account["']\\s+content=["']ca-pub-${publisher}["']`, 'i').test(head)) {
  throw new Error('AdSense check: publisher account meta missing from root <head>');
}
if (head.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js')) {
  throw new Error('AdSense check: global automatic ad loader must not be present on login or editor SPA');
}
if (!html.includes('class="pagero-public-home"') || !html.includes('href="/guide/"')) {
  throw new Error('AdSense check: public homepage must provide real, server-readable product content');
}

const ads = load('ads.txt');
const entry = `google.com, pub-${publisher}, DIRECT, f08c47fec0942fa0`;
if (!ads.split(/\r?\n/).some((line) => line.trim() === entry)) {
  throw new Error('AdSense check: root ads.txt does not authorize the account');
}

const robots = load('robots.txt');
if (/^Disallow:\s*\/\s*$/im.test(robots)) {
  throw new Error('AdSense check: robots.txt blocks the root site');
}
if (!load('sitemap.xml').includes('https://pagero.kr/')) {
  throw new Error('AdSense check: root sitemap is missing pagero.kr');
}

console.log('AdSense build checks passed: root publisher metadata, public content, ad isolation, ads.txt, robots and sitemap');
