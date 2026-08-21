import { handlePublicOgImageRequest, injectPublicPageMeta } from './lib/publicPageMeta.js';

const RUNTIME_RECOVERY_QUERY_KEYS = ['__fresh', '__runtime', '__runtimefix', '__hardreset'];
const RUNTIME_RESET_PATH = '/__pagero_runtime_reset';

function isPageroPlatformHost(hostname = '') {
  const host = String(hostname || '').trim().toLowerCase();
  return host === 'pagero.kr'
    || host.endsWith('.pagero.kr')
    || host.endsWith('.pages.dev')
    || host === 'localhost'
    || host.endsWith('.localhost');
}

function isProtectedPageroSpaRoute(pathname = '') {
  const clean = String(pathname || '/').replace(/\/+$/, '') || '/';
  return /^\/(?:app|dashboard|account|login|signup|admin|invite)(?:\/|$)/.test(clean)
    || /^\/[^/?#]+\/admin(?:\/|$)/.test(clean);
}

function isRuntimeAssetPath(pathname = '') {
  return /^\/assets\/.+\.(?:js|css)$/i.test(String(pathname || ''));
}

function hasRuntimeRecoveryQuery(url) {
  return RUNTIME_RECOVERY_QUERY_KEYS.some((key) => url.searchParams.has(key));
}

function applyNoStoreHeaders(headers, { clearSiteCache = false } = {}) {
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  if (clearSiteCache) headers.set('Clear-Site-Data', '"cache"');
  return headers;
}

function noStoreHtmlResponse(response, { clearSiteCache = false, runtimeVersion = 'edge-reset-v2' } = {}) {
  const headers = applyNoStoreHeaders(new Headers(response.headers), { clearSiteCache });
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('X-Pagero-Runtime-Shell', runtimeVersion);
  headers.delete('Content-Length');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function safeRuntimeNext(rawNext = '') {
  const value = String(rawNext || '').trim();
  if (!value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  if (value.startsWith('/assets/') || value.startsWith(RUNTIME_RESET_PATH)) return '/dashboard';
  return value;
}

function runtimeResetHtml(nextPath = '/dashboard') {
  const encodedNext = JSON.stringify(safeRuntimeNext(nextPath));
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>페이지로</title>
<style>
html,body{margin:0;min-height:100%;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#fff;color:#111827}body{display:grid;place-items:center;min-height:100vh}.runtime-reset{padding:28px;text-align:center}.runtime-reset strong{display:block;font-size:18px;margin-bottom:8px}.runtime-reset span{font-size:13px;color:#6b7280}
</style>
</head>
<body>
<div class="runtime-reset"><strong>최신 화면으로 연결 중입니다.</strong><span>페이지 데이터와 로그인 정보는 유지됩니다.</span></div>
<script>
(() => {
  const next = ${encodedNext};
  const finish = () => {
    try {
      const target = new URL(next, location.origin);
      ['__fresh','__runtime','__runtimefix','__hardreset'].forEach((key) => target.searchParams.delete(key));
      target.searchParams.set('__hardreset', String(Date.now()));
      location.replace(target.pathname + target.search + target.hash);
    } catch {
      location.replace('/dashboard?__hardreset=' + Date.now());
    }
  };
  try {
    const storage = sessionStorage;
    for (let i = storage.length - 1; i >= 0; i -= 1) {
      const key = storage.key(i) || '';
      if (key.startsWith('pagero-root-chunk-reload') || key.startsWith('pagero-chunk-reload') || key.startsWith('pagero-runtime-recovery')) storage.removeItem(key);
    }
  } catch {}
  const jobs = [];
  if ('caches' in window) jobs.push(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).catch(() => undefined));
  if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) jobs.push(navigator.serviceWorker.getRegistrations().then((items) => Promise.all(items.map((item) => item.unregister().catch(() => false)))).catch(() => undefined));
  Promise.all(jobs).catch(() => undefined).finally(finish);
  setTimeout(finish, 1200);
})();
</script>
</body>
</html>`;
}

function runtimeResetResponse(url) {
  const next = safeRuntimeNext(url.searchParams.get('next') || '/dashboard');
  const headers = applyNoStoreHeaders(new Headers(), { clearSiteCache: true });
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('X-Pagero-Runtime-Shell', 'edge-reset-page-v2');
  return new Response(runtimeResetHtml(next), { status: 200, headers });
}

function staleJavaScriptRecoveryResponse() {
  const source = `const __pageroStaleRuntime=()=>{try{const next=location.pathname+location.search+location.hash;location.replace('${RUNTIME_RESET_PATH}?next='+encodeURIComponent(next)+'&t='+Date.now())}catch{location.replace('/dashboard?__hardreset='+Date.now())}};__pageroStaleRuntime();export default function PageroStaleRuntimeRecovery(){return null}`;
  const headers = applyNoStoreHeaders(new Headers(), { clearSiteCache: true });
  headers.set('Content-Type', 'application/javascript; charset=utf-8');
  headers.set('X-Pagero-Stale-Asset-Recovery', '1');
  return new Response(source, { status: 200, headers });
}

function staleCssRecoveryResponse() {
  const headers = applyNoStoreHeaders(new Headers(), { clearSiteCache: true });
  headers.set('Content-Type', 'text/css; charset=utf-8');
  headers.set('X-Pagero-Stale-Asset-Recovery', '1');
  return new Response('/* stale Pagero CSS chunk intentionally replaced; JS recovery will refresh the runtime */', { status: 200, headers });
}

async function handleRuntimeAsset(context, url) {
  if (!isPageroPlatformHost(url.hostname) || !isRuntimeAssetPath(url.pathname)) return null;

  const assetUrl = new URL(context.request.url);
  const response = await context.env.ASSETS.fetch(assetUrl);
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const expectsJs = /\.js$/i.test(url.pathname);
  const expectsCss = /\.css$/i.test(url.pathname);
  const validType = expectsJs
    ? /(?:javascript|ecmascript)/i.test(contentType)
    : expectsCss
      ? /text\/css/i.test(contentType)
      : true;

  if (response.ok && validType) return response;

  // Cloudflare Pages' SPA fallback can answer a deleted hashed JS/CSS URL with
  // index.html. An old open tab then receives HTML for a module request and lands
  // on the legacy "Loading screen failed" UI. Return a same-origin rescue asset
  // instead so even that stale tab can escape to a server-owned reset page.
  return expectsJs ? staleJavaScriptRecoveryResponse() : staleCssRecoveryResponse();
}

async function handlePageroSpaShell(context, url) {
  if (!isPageroPlatformHost(url.hostname)) return null;
  if (url.pathname.startsWith('/api/')) return null;

  if (url.pathname === RUNTIME_RESET_PATH) return runtimeResetResponse(url);

  const recovery = hasRuntimeRecoveryQuery(url);
  const protectedRoute = isProtectedPageroSpaRoute(url.pathname);
  if (!recovery && !protectedRoute) return null;

  const assetUrl = new URL(context.request.url);
  assetUrl.pathname = '/index.html';
  assetUrl.search = '';
  const response = await context.env.ASSETS.fetch(assetUrl);
  return noStoreHtmlResponse(response, {
    clearSiteCache: recovery,
    runtimeVersion: recovery ? 'edge-hard-reset-v2' : 'edge-shell-v2',
  });
}

async function customDomainPageSlug(env = {}, hostname = '') {
  const host = String(hostname || '').trim().toLowerCase().replace(/:\d+$/, '');
  if (!host || !env.DB || typeof env.DB.prepare !== 'function') return '';
  const alternate = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
  try {
    const row = await env.DB.prepare(`
      SELECT pages.slug
      FROM pages
      LEFT JOIN projects ON projects.id = pages.project_id
      WHERE lower(json_extract(pages.page_json, '$.integrations.domain.hostname')) IN (?, ?)
        AND COALESCE(projects.status, 'active') <> 'archived'
      ORDER BY pages.updated_at DESC, pages.revision DESC
      LIMIT 1
    `).bind(host, alternate).first();
    return String(row?.slug || '').replace(/[^a-zA-Z0-9-_]/g, '');
  } catch (error) {
    console.warn('Custom domain lookup failed:', String(error?.message || error));
    return '';
  }
}

async function handleCustomDomain(context, url) {
  if (isPageroPlatformHost(url.hostname) || url.pathname.startsWith('/api/')) return null;
  const slug = await customDomainPageSlug(context.env, url.hostname);
  if (!slug) return null;
  const clean = url.pathname.replace(/\/+$/, '') || '/';
  if (clean !== '/') return null;
  const redirectUrl = new URL(context.request.url);
  redirectUrl.pathname = `/${slug}`;
  return Response.redirect(redirectUrl.toString(), 302);
}

async function handleCalltagRequest(context, url) {
  const clean = url.pathname.replace(/\/+$/, '') || '/';
  const routes = {
    '/': '/call/home/index.html',
    '/home': '/call/home/index.html',
    '/home-v4': '/call/home/index.html',
    '/home-v5': '/call/home/index.html',
    '/home-v6': '/call/home/index.html',
    '/home-v7': '/call/home/index.html',
    '/login': '/call/index.html',
    '/signup': '/call/index.html',
    '/privacy': '/call/privacy/index.html',
    '/terms': '/call/terms/index.html',
    '/subscribe': '/call/subscribe/index.html',
    '/preview': '/call/preview-v110/index.html',
    '/call/preview': '/call/preview-v110/index.html',
    '/preview-v104': '/call/preview/index.html',
    '/call/preview-v104': '/call/preview/index.html',
    '/preview-v105': '/call/preview/index.html',
    '/call/preview-v105': '/call/preview/index.html',
    '/preview-v106': '/call/preview-v106/index.html',
    '/call/preview-v106': '/call/preview-v106/index.html',
    '/preview-v107': '/call/preview-v106/index.html',
    '/call/preview-v107': '/call/preview-v106/index.html',
    '/preview-v108': '/call/preview-v108/index.html',
    '/call/preview-v108': '/call/preview-v108/index.html',
    '/preview-v109': '/call/preview-v110/index.html',
    '/call/preview-v109': '/call/preview-v110/index.html',
    '/preview-v110': '/call/preview-v110/index.html',
    '/call/preview-v110': '/call/preview-v110/index.html',
  };
  const mapped = routes[clean];
  if (!mapped) return context.next();

  const isHome = clean === '/' || clean === '/home' || clean === '/home-v4' || clean === '/home-v5' || clean === '/home-v6' || clean === '/home-v7';
  const assetUrl = new URL(context.request.url);
  assetUrl.pathname = mapped;
  assetUrl.search = isHome ? '?v=20260729-inline-layout-v7' : '';
  const response = await context.env.ASSETS.fetch(assetUrl);

  if (isHome) {
    const homeHeaders = new Headers(response.headers);
    homeHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    homeHeaders.set('CDN-Cache-Control', 'no-store');
    homeHeaders.set('Cloudflare-CDN-Cache-Control', 'no-store');
    homeHeaders.set('Pragma', 'no-cache');
    homeHeaders.set('Expires', '0');
    homeHeaders.set('X-CallTag-Home-Version', 'inline-layout-v7');

    let html = await response.text();
    html = html.replace('</body>', '<script src="/call/home/v7.js?v=20260729-2"></script></body>');

    homeHeaders.set('Content-Type', 'text/html; charset=utf-8');
    homeHeaders.delete('Content-Length');
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: homeHeaders,
    });
  }

  if (!clean.includes('preview')) return response;

  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  headers.set('X-CallTag-Preview-Version', '1.0.10');

  if (mapped === '/call/preview-v106/index.html'
          || mapped === '/call/preview-v108/index.html'
          || mapped === '/call/preview-v110/index.html') {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  let html = await response.text();
  html = html
    .replace(/페이지로\s+(?!콜링크)[가-힣]{2,4}(?=입니다|`|'|"|\n)/g, '페이지로')
    .replace('</head>', '<link rel="stylesheet" href="/call/preview/v106.css?v=110"><link rel="stylesheet" href="/call/preview/v110.css?v=110"></head>')
    .replace('</body>', '<script src="/call/preview/v106.js?v=110"></script><script src="/call/preview/v110.js?v=110"></script></body>');

  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.delete('Content-Length');
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname.startsWith('/api/')) return context.next();

  if (url.hostname === 'call.pagero.kr' || url.hostname === 'calltag.pagero.kr') {
    return handleCalltagRequest(context, url);
  }

  const publicOgImageResponse = await handlePublicOgImageRequest(context, url);
  if (publicOgImageResponse) return publicOgImageResponse;

  const runtimeAssetResponse = await handleRuntimeAsset(context, url);
  if (runtimeAssetResponse) return runtimeAssetResponse;

  const pageroSpaResponse = await handlePageroSpaShell(context, url);
  if (pageroSpaResponse) return pageroSpaResponse;

  const customDomainResponse = await handleCustomDomain(context, url);
  if (customDomainResponse) return customDomainResponse;

  const response = await context.next();
  return injectPublicPageMeta(context, url, response);
}
