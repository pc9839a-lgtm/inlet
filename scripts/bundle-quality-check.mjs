import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);

function readArgValue(names) {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    for (const name of names) {
      if (arg === name) return args[i + 1] || '';
      if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
    }
  }
  return '';
}

const targetDir = process.env.INLET_BUNDLE_QA_DIR || readArgValue(['--outDir', '--out-dir']) || 'dist';
const maxJsBytes = Number(process.env.INLET_BUNDLE_MAX_JS_BYTES || 430000);
const maxCssBytes = Number(process.env.INLET_BUNDLE_MAX_CSS_BYTES || 430000);
const maxTotalAssetBytes = Number(process.env.INLET_BUNDLE_MAX_TOTAL_ASSET_BYTES || 2200000);
const warnRatio = Number(process.env.INLET_BUNDLE_WARN_RATIO || 0.9);
const intentionalPublicScripts = new Set([
  'embed/form.js',
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

async function exists(dir) {
  try {
    await stat(dir);
    return true;
  } catch {
    return false;
  }
}

function normalizeRel(file) {
  return path.relative(targetDir, file).replaceAll(path.sep, '/');
}

function addAssetRef(refs, currentRel, rawRef) {
  const cleanRef = rawRef.split('?')[0].split('#')[0];
  let rel = cleanRef.replace(/^\/+/, '').replace(/^\.\//, '');
  if (cleanRef.startsWith('./') || cleanRef.startsWith('../')) {
    rel = path.posix.normalize(path.posix.join(path.posix.dirname(currentRel), cleanRef));
  }
  if (rel.startsWith('assets/') && /\.(?:js|css)$/.test(rel)) refs.add(rel);
}

async function collectReferencedAssets(dir) {
  const indexPath = path.join(dir, 'index.html');
  if (!await exists(indexPath)) return { referenced: new Set(), initial: new Set() };

  const refs = new Set();
  const initialRefs = new Set();
  const queue = [];
  const seenJs = new Set();
  const html = await readFile(indexPath, 'utf8');
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:[?#][^"']*)?)["']/g)) {
    const before = refs.size;
    addAssetRef(refs, 'index.html', match[1]);
    if (refs.size > before) initialRefs.add([...refs].at(-1));
  }
  for (const rel of refs) {
    if (rel.endsWith('.js')) queue.push(rel);
  }

  while (queue.length) {
    const currentRel = queue.shift();
    if (seenJs.has(currentRel)) continue;
    seenJs.add(currentRel);

    const currentPath = path.join(dir, ...currentRel.split('/'));
    if (!await exists(currentPath)) continue;
    const source = await readFile(currentPath, 'utf8');
    for (const match of source.matchAll(/["']((?:\.{1,2}\/|\/?assets\/)[^"']+\.(?:js|css)(?:[?#][^"']*)?)["']/g)) {
      const before = refs.size;
      addAssetRef(refs, currentRel, match[1]);
      if (refs.size > before) {
        const rel = [...refs].at(-1);
        if (rel?.endsWith('.js')) queue.push(rel);
      }
    }
  }

  return { referenced: refs, initial: initialRefs };
}

if (!await exists(targetDir)) {
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    reason: `${targetDir} does not exist`,
  }, null, 2));
} else {
  const assetRefs = await collectReferencedAssets(targetDir);
  const referencedAssets = assetRefs.referenced;
  const initialAssetRefs = assetRefs.initial;
  const files = await walk(targetDir);
  const assets = [];
  for (const file of files) {
    const info = await stat(file);
    const ext = path.extname(file);
    if (!['.js', '.css'].includes(ext)) continue;
    const relative = normalizeRel(file);
    assets.push({
      file: file.replaceAll(path.sep, '/'),
      relative,
      ext,
      bytes: info.size,
      referenced: referencedAssets.size ? referencedAssets.has(relative) : true,
      initial: initialAssetRefs.size ? initialAssetRefs.has(relative) : true,
    });
  }

  const checkedAssets = referencedAssets.size
    ? assets.filter((asset) => asset.referenced || intentionalPublicScripts.has(asset.relative))
    : assets;
  const initialAssets = initialAssetRefs.size ? assets.filter((asset) => asset.initial) : checkedAssets;
  const staleAssets = referencedAssets.size
    ? assets.filter((asset) => !asset.referenced && !intentionalPublicScripts.has(asset.relative))
    : [];
  const jsAssets = checkedAssets.filter((asset) => asset.ext === '.js');
  const cssAssets = checkedAssets.filter((asset) => asset.ext === '.css');
  const largestJs = jsAssets.toSorted((a, b) => b.bytes - a.bytes)[0] || null;
  const largestCss = cssAssets.toSorted((a, b) => b.bytes - a.bytes)[0] || null;
  const totalAssetBytes = initialAssets.reduce((sum, asset) => sum + asset.bytes, 0);
  const lazyTotalAssetBytes = checkedAssets.reduce((sum, asset) => sum + asset.bytes, 0);
  const jsNames = jsAssets.map((asset) => path.basename(asset.file));
  const initialJsNames = initialAssets.filter((asset) => asset.ext === '.js').map((asset) => path.basename(asset.file));
  const templateChunks = jsNames.filter((name) => name.startsWith('landingTemplates-'));
  const blockEditorChunks = jsNames.filter((name) => /(?:Editor|Editors)-/.test(name));

  assert(jsAssets.length > 0, `${targetDir} has no JS assets`);
  assert(cssAssets.length > 0, `${targetDir} has no CSS assets`);
  assert(!largestJs || largestJs.bytes <= maxJsBytes, `largest JS bundle exceeded: ${largestJs.bytes} > ${maxJsBytes} (${largestJs.file})`);
  assert(!largestCss || largestCss.bytes <= maxCssBytes, `largest CSS bundle exceeded: ${largestCss.bytes} > ${maxCssBytes} (${largestCss.file})`);
  assert(totalAssetBytes <= maxTotalAssetBytes, `total JS/CSS assets exceeded: ${totalAssetBytes} > ${maxTotalAssetBytes}`);
  assert(templateChunks.length > 0, 'landing templates must stay in a separate lazy JS chunk');
  assert(blockEditorChunks.length >= 6, `block editors must stay lazy-split into separate JS chunks (${blockEditorChunks.length} found)`);
  assert(!initialJsNames.some((name) => name.startsWith('landingTemplates-')), 'landing templates must not be referenced as an initial JS asset');
  assert(!initialJsNames.some((name) => /(?:Editor|Editors)-/.test(name)), 'block editor chunks must not be referenced as initial JS assets');

  const warnings = [
    ...(largestJs?.bytes >= maxJsBytes * warnRatio ? [`largest JS budget usage ${largestJs.bytes}/${maxJsBytes} (${largestJs.file})`] : []),
    ...(largestCss?.bytes >= maxCssBytes * warnRatio ? [`largest CSS budget usage ${largestCss.bytes}/${maxCssBytes} (${largestCss.file})`] : []),
    ...(totalAssetBytes >= maxTotalAssetBytes * warnRatio ? [`total asset budget usage ${totalAssetBytes}/${maxTotalAssetBytes}`] : []),
  ];

  console.log(JSON.stringify({
    ok: true,
    targetDir,
    budgets: { maxJsBytes, maxCssBytes, maxTotalAssetBytes },
    usage: {
      js: largestJs ? Number((largestJs.bytes / maxJsBytes).toFixed(3)) : 0,
      css: largestCss ? Number((largestCss.bytes / maxCssBytes).toFixed(3)) : 0,
      total: Number((totalAssetBytes / maxTotalAssetBytes).toFixed(3)),
    },
    warnings,
    totalAssetBytes,
    lazyTotalAssetBytes,
    largestJs,
    largestCss,
    templateChunks,
    blockEditorChunks: blockEditorChunks.length,
    initialJsAssets: initialJsNames,
    assetCount: checkedAssets.length,
    initialAssetCount: initialAssets.length,
    scannedAssetCount: assets.length,
    referencedAssetCount: referencedAssets.size,
    staleAssetCount: staleAssets.length,
    staleAssets: staleAssets.slice(0, 10).map((asset) => ({
      file: asset.file,
      bytes: asset.bytes,
    })),
  }, null, 2));
}
