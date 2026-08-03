const PAGER0_HOST_SUFFIXES = ['pagero.kr', 'pages.dev', 'localhost'];

function normalizeHostname(value = '') {
  return String(value || '').trim().toLowerCase().replace(/\.$/, '');
}

function isPageroOwnedHostname(hostname = '') {
  const safe = normalizeHostname(hostname);
  return PAGER0_HOST_SUFFIXES.some((suffix) => safe === suffix || safe.endsWith(`.${suffix}`));
}

async function activeCustomDomainPage(db, hostname = '') {
  if (!db?.prepare) return null;
  return db.prepare(`
    SELECT pages.slug, pages.id AS page_id, pages.project_id
    FROM page_domains
    INNER JOIN pages ON pages.id = page_domains.page_id
    INNER JOIN projects ON projects.id = page_domains.project_id
    WHERE page_domains.hostname = ?
      AND page_domains.status = 'active'
      AND page_domains.ssl_status = 'active'
      AND COALESCE(projects.status, 'active') <> 'archived'
    LIMIT 1
  `).bind(normalizeHostname(hostname)).first();
}

function customDomainNotFound(hostname = '') {
  const safeHostname = normalizeHostname(hostname);
  return new Response(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>도메인 연결 확인</title></head><body style="margin:0;font-family:Pretendard,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f8fafc;color:#0f172a"><main style="max-width:560px;margin:0 auto;padding:80px 24px"><h1 style="font-size:28px">도메인 연결을 확인해주세요.</h1><p style="line-height:1.7;color:#64748b">${safeHostname}에 연결된 공개 페이지가 아직 활성화되지 않았습니다. 페이지로 설정에서 DNS와 SSL 상태를 다시 확인해주세요.</p></main></body></html>`, {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function customDomainLandingResponse(context, url) {
  const hostname = normalizeHostname(url.hostname);
  if (isPageroOwnedHostname(hostname) || hostname === 'call.pagero.kr') return null;
  if (url.pathname.startsWith('/api/')) return null;
  if (url.pathname !== '/') return null;

  const mapping = await activeCustomDomainPage(context.env.DB, hostname);
  if (!mapping?.slug) return customDomainNotFound(hostname);

  const assetUrl = new URL(context.request.url);
  assetUrl.pathname = '/index.html';
  assetUrl.search = '';
  const assetResponse = await context.env.ASSETS.fetch(assetUrl);
  let html = await assetResponse.text();
  const slug = String(mapping.slug || '').replace(/[^a-zA-Z0-9-_]/g, '');
  const bootScript = `<script>window.__INLET_CUSTOM_DOMAIN_SLUG__=${JSON.stringify(slug)};window.__INLET_CUSTOM_DOMAIN_HOST__=${JSON.stringify(hostname)};if(location.pathname==='/'){history.replaceState({...history.state,__inletCustomDomain:true},'','/'+${JSON.stringify(slug)}+location.search+location.hash);}</script>`;
  const restoreScript = `<script>(()=>{const restore=()=>{if(!document.querySelector('.public-landing-shell'))return false;History.prototype.replaceState.call(window.history,window.history.state,'/'+window.location.search+window.location.hash);return true;};if(!restore()){const observer=new MutationObserver(()=>{if(restore())observer.disconnect();});observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),15000);}})();</script>`;
  html = html.includes('<head>')
    ? html.replace('<head>', `<head>${bootScript}`)
    : `${bootScript}${html}`;
  html = html.includes('</body>')
    ? html.replace('</body>', `${restoreScript}</body>`)
    : `${html}${restoreScript}`;

  const headers = new Headers(assetResponse.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  headers.set('X-Inlet-Custom-Domain', hostname);
  headers.set('X-Inlet-Custom-Page', slug);
  headers.delete('Content-Length');
  return new Response(html, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers,
  });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const customDomainResponse = await customDomainLandingResponse(context, url);
  if (customDomainResponse) return customDomainResponse;

  if (url.hostname !== 'call.pagero.kr' || url.pathname.startsWith('/api/')) {
    return context.next();
  }

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
    homeHeaders.set('X-CallLink-Home-Version', 'inline-layout-v7');

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
  headers.set('X-CallLink-Preview-Version', '1.0.10');

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
