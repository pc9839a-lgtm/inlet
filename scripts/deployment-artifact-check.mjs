import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const targetDir = path.resolve(process.env.INLET_DEPLOY_QA_DIR || path.join(root, 'dist'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function addAssetRef(refs, currentRel, rawRef) {
  const cleanRef = rawRef.split('?')[0].split('#')[0];
  let rel = cleanRef.replace(/^\/+/, '').replace(/^\.\//, '');
  if (cleanRef.startsWith('./') || cleanRef.startsWith('../')) {
    rel = path.posix.normalize(path.posix.join(path.posix.dirname(currentRel), cleanRef));
  }
  if (rel.startsWith('assets/') && /\.(?:js|css)$/.test(rel)) refs.add(rel);
}

async function collectReferencedAssets() {
  const refs = new Set();
  const queue = [];
  const seenJs = new Set();
  const indexPath = path.join(targetDir, 'index.html');

  assert(await exists(indexPath), `deployment artifact missing index.html: ${targetDir}`);
  const redirectsPath = path.join(targetDir, '_redirects');
  assert(await exists(redirectsPath), `deployment artifact missing SPA fallback _redirects: ${targetDir}`);
  const redirects = await readFile(redirectsPath, 'utf8');
  assert(/^\s*\/\*\s+\/index\.html\s+200\s*$/m.test(redirects), 'deployment artifact must route direct landing URLs to index.html');
  const html = await readFile(indexPath, 'utf8');

  for (const match of html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:[?#][^"']*)?)["']/g)) {
    const before = refs.size;
    addAssetRef(refs, 'index.html', match[1]);
    if (refs.size > before) {
      const rel = [...refs].at(-1);
      if (rel?.endsWith('.js')) queue.push(rel);
    }
  }

  while (queue.length) {
    const currentRel = queue.shift();
    if (seenJs.has(currentRel)) continue;
    seenJs.add(currentRel);
    const sourcePath = path.join(targetDir, ...currentRel.split('/'));
    if (!await exists(sourcePath)) continue;
    const source = await readFile(sourcePath, 'utf8');
    for (const match of source.matchAll(/["']((?:\.{1,2}\/|\/?assets\/)[^"']+\.(?:js|css)(?:[?#][^"']*)?)["']/g)) {
      const before = refs.size;
      addAssetRef(refs, currentRel, match[1]);
      if (refs.size > before) {
        const rel = [...refs].at(-1);
        if (rel?.endsWith('.js')) queue.push(rel);
      }
    }
  }

  return refs;
}

async function inspectAssets() {
  assert(await exists(targetDir), `deployment artifact directory does not exist: ${targetDir}`);
  const referenced = await collectReferencedAssets();
  const assetsDir = path.join(targetDir, 'assets');
  assert(await exists(assetsDir), `deployment artifact missing assets directory: ${assetsDir}`);

  const files = (await walk(assetsDir)).filter((file) => ['.js', '.css'].includes(path.extname(file)));
  const assets = [];
  for (const file of files) {
    const relative = path.relative(targetDir, file).replaceAll(path.sep, '/');
    const info = await stat(file);
    assets.push({
      file: file.replaceAll(path.sep, '/'),
      relative,
      ext: path.extname(file),
      bytes: info.size,
      referenced: referenced.has(relative),
    });
  }

  const stale = assets.filter((asset) => !asset.referenced);
  const jsAssets = assets.filter((asset) => asset.ext === '.js' && asset.referenced);
  const cssAssets = assets.filter((asset) => asset.ext === '.css' && asset.referenced);

  return {
    assets,
    stale,
    largestJs: jsAssets.toSorted((a, b) => b.bytes - a.bytes)[0] || null,
    largestCss: cssAssets.toSorted((a, b) => b.bytes - a.bytes)[0] || null,
  };
}

async function inspectSeoFiles() {
  const robotsPath = path.join(targetDir, 'robots.txt');
  const sitemapPath = path.join(targetDir, 'sitemap.xml');

  assert(await exists(robotsPath), `deployment artifact missing robots.txt: ${targetDir}`);
  assert(await exists(sitemapPath), `deployment artifact missing sitemap.xml: ${targetDir}`);

  const robots = await readFile(robotsPath, 'utf8');
  const sitemap = await readFile(sitemapPath, 'utf8');

  assert(!/<(?:!doctype|html|head|body)\b/i.test(robots), 'robots.txt must not contain SPA HTML');
  assert(/^\s*User-agent:\s*\*/m.test(robots), 'robots.txt must define the public crawler policy');
  assert(/^\s*Sitemap:\s*https:\/\/pagero\.kr\/sitemap\.xml\s*$/m.test(robots), 'robots.txt must advertise the Pagero sitemap');
  assert(/^<\?xml\s+version="1\.0"\s+encoding="UTF-8"\?>/.test(sitemap.trim()), 'sitemap.xml must be XML, not the SPA fallback');
  assert(/<urlset\s+xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/.test(sitemap), 'sitemap.xml must use the sitemap protocol namespace');
  assert(!/<(?:!doctype|html|head|body)\b/i.test(sitemap), 'sitemap.xml must not contain SPA HTML');

  return {
    robotsBytes: Buffer.byteLength(robots),
    sitemapBytes: Buffer.byteLength(sitemap),
  };
}

const report = await inspectAssets();
const seoFiles = await inspectSeoFiles();

assert(report.assets.length > 0, 'deployment artifact has no JS/CSS assets');
assert(report.stale.length === 0, `deployment artifact has stale assets: ${report.stale.map((asset) => asset.relative).join(', ')}`);
assert(report.largestJs?.bytes <= 430000, `deployment JS budget exceeded: ${report.largestJs?.bytes || 0}`);
assert(report.largestCss?.bytes <= 430000, `deployment CSS budget exceeded: ${report.largestCss?.bytes || 0}`);

console.log(JSON.stringify({
  ok: true,
  targetDir: targetDir.replaceAll(path.sep, '/'),
  staleAssetCount: report.stale.length,
  assetCount: report.assets.length,
  largestJs: report.largestJs?.bytes || 0,
  largestCss: report.largestCss?.bytes || 0,
  robotsBytes: seoFiles.robotsBytes,
  sitemapBytes: seoFiles.sitemapBytes,
}, null, 2));
