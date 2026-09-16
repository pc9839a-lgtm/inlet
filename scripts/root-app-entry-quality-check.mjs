import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
const legacyChunkNames = ['App-DrlN22f5.js', 'App-CoeQq7xJ.js'];

assert(main.includes("import App from './App.jsx';"), 'Root App must be statically imported by main.jsx');
assert(!main.includes("lazy(() => import('./App.jsx'))"), 'Root App must never return to a deployment-sensitive dynamic import');
assert(!main.includes('<Suspense') && !main.includes('Suspense fallback'), 'Root App entry must not wait behind a Suspense boundary');
assert(main.includes('root.render(<AppErrorBoundary><App /></AppErrorBoundary>)'), 'Static root App must remain protected by AppErrorBoundary');

assert(rootFunction.includes('return context.next();'), 'Public root Pages Function must pass through to the current Vite index');
assert(!rootFunction.includes('C63_HOME_HTML'), 'Public root Pages Function must not embed the legacy C63 landing document');
assert(!rootFunction.includes('pagero-exact-home'), 'Public root Pages Function must not contain the legacy landing markup');
assert(!rootFunction.includes('/c63-assets/') && !rootFunction.includes('c63-life-bridge'), 'Public root Pages Function must not load legacy landing assets');

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
}

console.log(JSON.stringify({
  ok: true,
  check: 'root-app-entry',
  staticRootApp: true,
  legacyRootHtmlRemoved: true,
  rootFunctionPassThrough: true,
  destructiveChunkReset: false,
  legacyRescueModules: legacyChunkNames,
  artifactChecked: Boolean(outDirArg),
}, null, 2));
