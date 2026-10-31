import assert from 'node:assert/strict';
import fs from 'node:fs';
import { injectPageroRootSeo } from '../functions/lib/pageroRootSeo.js';
import { onRequest as servePublicHome } from '../functions/index.js';
import { PUBLIC_HOME_MARKUP } from '../src/screens/publicHomeMarkup.js';

const app=fs.readFileSync('src/App.jsx','utf8');
const home=fs.readFileSync('src/screens/PageroCanonicalHome.jsx','utf8');
const publicPages=fs.readFileSync('functions/lib/publicPageMeta.js','utf8');
const domain='https://calltag.pagero.kr/';

// Public marketing replaced the legacy frozen C63 home, not the customer app.
assert(app.includes('<PublicHomeScreen />'),'Unauthenticated SPA root must show product information');
assert(app.includes('const requestedAuthView = authRouteMode || authView;'),'Auth screens must retain explicit routes');
assert(app.includes("pathname === '/login'")&&app.includes("pathname === '/signup'"));
assert(app.includes("['생활비서', '/life/']"));
assert(app.includes("['콜태그(CallTag)', 'https://calltag.pagero.kr/']"));
assert(home.includes('id="life"')&&home.includes('id="calltag"'),'Legacy React home module must retain its existing service links');
assert(publicPages.includes('stripPlatformAdsFromCustomerPage(await response.text())'),'Customer pages must remain isolated from platform ads');
const served=servePublicHome();
const raw=await served.text();
assert(raw.includes(PUBLIC_HOME_MARKUP),'Actual root must serve exactly the canonical public marketing copy');
assert(raw.includes('href="/life/"')&&raw.includes(domain),'Actual root retains LIFE and CallTag discovery');
assert(raw.includes('href="/guide/"')&&raw.includes('href="/tools/lead-calculator/"'),'Root must expose real publisher tools');
assert(raw.includes('name="google-adsense-account"'),'Publisher verification remains');
assert(!raw.includes('pagead2.googlesyndication.com'),'Global Auto Ads must not leak into app or login');
const transformed=await injectPageroRootSeo(new URL('https://pagero.kr/'),new Response(raw,{headers:{'content-type':'text/html; charset=utf-8'}}));
const enriched=await transformed.text();
assert(enriched.includes(PUBLIC_HOME_MARKUP),'SEO middleware must retain identical public marketing content');
assert(enriched.includes('PAGERO_ROOT_SEO_V1'));
assert(enriched.includes('<link rel="canonical" href="https://pagero.kr/">'));
assert(!enriched.includes('https://life.pagero.kr/'));
console.log('PASS PageRo public home: same HTML with/without JS, LIFE/CallTag preserved, auth and tenant ads isolated.');
