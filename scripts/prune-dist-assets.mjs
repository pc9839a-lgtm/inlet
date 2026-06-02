import { readdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
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

const outDirArg = readArgValue(['--outDir', '--out-dir']);
const distDir = path.resolve(root, outDirArg || 'dist');
const assetsDir = path.join(distDir, 'assets');
const indexFile = path.join(distDir, 'index.html');
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.map', '.svg', '.txt', '.xml']);

function isInsideRoot(file) {
  const relative = path.relative(root, file);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(file));
    } else if (entry.isFile()) {
      files.push(file);
    }
  }

  return files;
}

async function readTextIfPossible(file) {
  if (!textExtensions.has(path.extname(file))) return '';
  try {
    return await readFile(file, 'utf8');
  } catch {
    return '';
  }
}

async function removeWithRetry(file, attempts = 1) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await rm(file, { force: true, maxRetries: 0 });
      return true;
    } catch (error) {
      if (attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 180));
    }
  }
  return false;
}

if (!isInsideRoot(distDir) || !isInsideRoot(assetsDir)) {
  throw new Error(`Refusing to prune unsafe path: ${distDir}`);
}

if (!await exists(indexFile) || !await exists(assetsDir)) {
  console.log('prune-dist-assets: dist assets not found');
  process.exit(0);
}

const assetFiles = await listFiles(assetsDir);
const assetNames = new Map(assetFiles.map((file) => [path.basename(file), file]));
const reachable = new Set();
const queue = [];

function markAsset(name) {
  const file = assetNames.get(name);
  if (!file || reachable.has(file)) return;
  reachable.add(file);
  queue.push(file);
}

function scanForAssetNames(content) {
  for (const name of assetNames.keys()) {
    if (content.includes(name)) markAsset(name);
  }
}

scanForAssetNames(await readFile(indexFile, 'utf8'));

while (queue.length) {
  const file = queue.shift();
  scanForAssetNames(await readTextIfPossible(file));
}

const stale = assetFiles.filter((file) => !reachable.has(file));
const failures = [];

for (const file of stale) {
  try {
    await removeWithRetry(file);
  } catch (error) {
    failures.push({ file, error });
  }
}

if (stale.length && !failures.length) {
  console.log(`prune-dist-assets: removed ${stale.length} stale asset(s)`);
} else if (!stale.length) {
  console.log('prune-dist-assets: no stale assets');
}

if (failures.length) {
  console.warn(`prune-dist-assets: ${failures.length} stale asset(s) could not be removed`);
  for (const failure of failures.slice(0, 5)) {
    console.warn(`prune-dist-assets: locked ${path.relative(root, failure.file)} (${failure.error.code || failure.error.message})`);
  }
}
