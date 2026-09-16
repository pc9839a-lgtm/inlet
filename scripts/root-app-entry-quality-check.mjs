import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function readArgValue(names) {
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    for (const name of names) {
      if (arg === name) return args[index + 1] || '';
      if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
    }
  }
  return '';
}

const main = await readFile('src/main.jsx', 'utf8');
const boundary = await readFile('src/components/AppErrorBoundary.jsx', 'utf8');
const rootFunction = await readFile('functions/index.js', 'utf8');
const publicHomeRoute = await readFile('src/screens/PublicHomeRoute.jsx', 'utf8');
const exactHome = await readFile('src/screens/PageroExactHome.jsx', 'utf8');
const exactEntryPath = 'public/c63-assets/index-pagero-main-fix-20260615.js';
const exactCssPath = 'public/c63-assets/index-B0Q5rFVf.css';
const legacyHomePath = 'src/screens/PageroCanonicalHome.jsx';
const legacyChunkNames = ['App-DrlN22f5.js', 'App-CoeQq7xJ.js'];

assert(main.includes("import App from './App.jsx';"), 'Root App must be statically imported by main.jsx');
assert(!main.includes("lazy(() => import('./App.jsx'))"), 'Root App must never return to a deployment-sensitive dynamic import');
assert(!main.includes('<Suspense') && !main.includes('Suspense fallback'), 'Root App entry must not wait behind a Suspense boundary');
assert(main.includes('root.render(<AppErrorBoundary><App /></AppErrorBoundary>)'), 'Static root App must remain protected by AppErrorBoundary');

assert(rootFunction.includes('const PAGERO_HOME_HTML'), 'Public root Pages Function must own the exact landing shell');
assert(rootFunction.includes('<div id="root"></div>'), 'Public root shell must start with an empty React root so no fallback landing can flash');
assert(rootFunction.includes('/c63-assets/index-pagero-main-fix-20260615.js'), 'Public root shell must boot the exact landing entry');
assert(rootFunction.includes('/c63-assets/index-B0Q5rFVf.css'), 'Public root shell must load the exact landing stylesheet');
assert(rootFunction.includes("'Cache-Control': 'no-store, max-age=0'"), 'Public root HTML must not be cached across landing releases');
assert(!rootFunction.includes('pagerol-home'), 'Public root shell must never contain the retired pagerol landing');
assert(!rootFunction.includes('pagero-ssr-fallback'), 'Public root shell must never paint the old SSR fallback before the exact landing');
assert(!rootFunction.includes('c63-life-bridge'), 'Public root shell must not depend on the removed legacy life bridge');

assert(publicHomeRoute.includes("import PageroExactHome from './PageroExactHome.jsx';"), 'Source public route must use PageroExactHome');
assert(!publicHomeRoute.includes('PageroCanonicalHome'), 'Source public route must not reference the retired canonical/pagerol landing');
assert(exactHome.includes('className="pagero-exact-home"'), 'Exact landing source must keep the pagero-exact-home root marker');
assert(!exactHome.includes('className="pagerol-home'), 'Exact landing source must never use the retired pagerol-home marker');
assert(!(await exists(legacyHomePath)), 'Retired PageroCanonicalHome.jsx must remain deleted');
assert(await exists(exactEntryPath), 'Exact landing C63 entry must exist');
assert(await exists(exactCssPath), 'Exact landing C63 stylesheet must exist');

assert(boundary.includes('const chunkError = isLazyChunkLoadError(this.state.error);'), 'Chunk errors must use a dedicated non-destructive screen');
assert(boundary.includes('페이지 데이터는 삭제하지 않습니다.'), 'Chunk recovery must explicitly preserve page data');
const chunkBranch = boundary.match(/if \(chunkError\) \{([\s\S]*?)\n    \}/)?.[1] || '';
assert(chunkBranch.includes('최신 화면 다시 열기'), 'Chunk recovery screen must expose a fresh reload action');
assert(!chunkBranch.includes('STORAGE_KEY') && !chunkBranch.includes('LEADS_KEY') && !chunkBranch.includes('전체 초기화'), 'Chunk recovery screen must never expose destructive resets');

for (const fileName of legacyChunkNames) {
  const source = await readFile(path.join('public', 'assets', fileName), 'utf8');
  assert(source.includes('window.location.replace'), `${fileName} must redirect stale sessions to the latest runtime`);
  assert(source.includes('export default function StalePageroAppChunk'), `${fileName} must remain a valid React.lazy module`);
}

const outDirArg = readArgValue(['--outDir', '--out-dir']);
if (outDirArg) {
  const outDir = path.resolve(process.cwd(), outDirArg);
  const assetsDir = path.join(outDir, 'assets');
  await access(assetsDir);
  const appChunks = (await readdir(assetsDir)).filter((name) => /^App-[A-Za-z0-9_-]+\.js$/.test(name));
  const unexpected = appChunks.filter((name) => !legacyChunkNames.includes(name));
  assert(unexpected.length === 0, `Build must not emit a deployment-sensitive root App chunk: ${unexpected.join(', ')}`);
  for (const fileName of legacyChunkNames) {
    assert(appChunks.includes(fileName), `Deployment artifact must retain stale-session rescue module ${fileName}`);
  }
  assert(await exists(path.join(outDir, 'c63-assets', 'index-pagero-main-fix-20260615.js')), 'Deployment artifact must contain the exact landing entry');
  assert(await exists(path.join(outDir, 'c63-assets', 'index-B0Q5rFVf.css')), 'Deployment artifact must contain the exact landing stylesheet');
}

console.log(JSON.stringify({
  ok: true,
  check: 'root-app-entry',
  staticRootApp: true,
  exactLandingShell: true,
  emptyInitialRoot: true,
  retiredPagerolLandingRemoved: true,
  destructiveChunkReset: false,
  legacyRescueModules: legacyChunkNames,
  artifactChecked: Boolean(outDirArg),
}, null, 2));
