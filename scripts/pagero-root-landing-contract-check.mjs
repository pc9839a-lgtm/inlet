import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const rootFunction = await readFile('functions/index.js', 'utf8');
const route = await readFile('src/screens/PublicHomeRoute.jsx', 'utf8');
const exactHome = await readFile('src/screens/PageroExactHome.jsx', 'utf8');

assert(rootFunction.includes('<div id="root"></div>'), 'root response must begin with an empty app root');
assert(!rootFunction.includes('pagerol-home'), 'root response must never embed the retired pagerol landing');
assert(!rootFunction.includes('pagero-ssr-fallback'), 'root response must never embed a fallback landing');
assert(rootFunction.includes('/c63-assets/index-pagero-main-fix-20260615.js'), 'root response must boot the exact C63 landing');
assert(route.includes('PageroExactHome'), 'source root route must target PageroExactHome');
assert(!route.includes('PageroCanonicalHome'), 'source root route must not target the retired landing');
assert(exactHome.includes('className="pagero-exact-home"'), 'exact landing identity must remain pagero-exact-home');
assert(!exactHome.includes('pagerol-home'), 'exact landing must not contain the retired pagerol marker');

console.log(JSON.stringify({
  ok: true,
  check: 'pagero-root-landing-contract',
  initialLegacyDom: false,
  sourceLanding: 'pagero-exact-home',
}, null, 2));
