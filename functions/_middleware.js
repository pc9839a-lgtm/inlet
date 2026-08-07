const RUNTIME_RECOVERY_QUERY_KEYS = ['__fresh', '__runtime', '__runtimefix', '__hardreset'];

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

function hasRuntimeRecoveryQuery(url) {
  return RUNTIME_RECOVERY_QUERY_KEYS.some((key) => url.searchParams.has(key));
}

function noStoreHtmlResponse(response, { clearSiteCache = false, runtimeVersion = 'edge-reset-v1' } = {}) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('X-Pagero-Runtime-Shell', runtimeVersion);
  headers.delete('Content-Length');
  if (clearSiteCache) {
    // CacheStorage cleanup in JavaScript cannot remove the browser HTTP cache.
    // Clear-Site-Data is intentionally limited to cache so auth/storage survive.
    headers.set('Clear-Site-Data', '"cache"');
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handlePageroSpaShell(context, url) {
  if (!isPageroPlatformHost(url.hostname)) return null;
  if (url.pathname.startsWith('/api/')) return null;

  const recovery = hasRuntimeRecoveryQuery(url);
  const protectedRoute = isProtectedPageroSpaRoute(url.pathname);
  if (!recovery && !protectedRoute) return null;

  // Bypass the SPA fallback/cache path completely and fetch the index asset from
  // the current deployment. This guarantees that /app and /dashboard always get
  // the current deployment's hashed entrypoint after a deploy.
  const assetUrl = new URL(context.request.url);
  assetUrl.pathname = '/index.html';
  assetUrl.search = '';
  const response = await context.env.ASSETS.fetch(assetUrl);
  return noStoreHtmlResponse(response, {
    clearSiteCache: recovery,
    runtimeVersion: recovery ? 'edge-hard-reset-v1' : 'edge-shell-v1',
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

  const pageroSpaResponse = await handlePageroSpaShell(context, url);
  if (pageroSpaResponse) return pageroSpaResponse;

  const customDomainResponse = await handleCustomDomain(context, url);
  if (customDomainResponse) return customDomainResponse;
  return context.next();
}
