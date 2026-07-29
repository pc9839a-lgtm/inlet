export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname !== 'call.pagero.kr' || url.pathname.startsWith('/api/')) {
    return context.next();
  }

  const clean = url.pathname.replace(/\/+$/, '') || '/';
  const routes = {
    '/': '/call/home/index.html',
    '/home': '/call/home/index.html',
    '/home-v4': '/call/home/index.html',
    '/login': '/call/index.html',
    '/signup': '/call/index.html',
    '/privacy': '/call/privacy/index.html',
    '/terms': '/call/terms/index.html',
    '/subscribe': '/call/subscribe/index.html',
    '/preview': '/call/preview/index.html',
    '/call/preview': '/call/preview/index.html',
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
  };
  const mapped = routes[clean];
  if (!mapped) return context.next();

  const isHome = clean === '/' || clean === '/home' || clean === '/home-v4';
  const assetUrl = new URL(context.request.url);
  assetUrl.pathname = mapped;
  assetUrl.search = isHome ? '?v=20260729-visual-motion-v4' : '';
  const response = await context.env.ASSETS.fetch(assetUrl);

  if (isHome) {
    const homeHeaders = new Headers(response.headers);
    homeHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    homeHeaders.set('CDN-Cache-Control', 'no-store');
    homeHeaders.set('Cloudflare-CDN-Cache-Control', 'no-store');
    homeHeaders.set('Pragma', 'no-cache');
    homeHeaders.set('Expires', '0');
    homeHeaders.set('X-CallLink-Home-Version', 'visual-motion-v4');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: homeHeaders,
    });
  }

  if (!clean.includes('preview')) return response;

  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  headers.set('X-CallLink-Preview-Version', '1.0.8');

  if (mapped === '/call/preview-v106/index.html'
          || mapped === '/call/preview-v108/index.html') {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  let html = await response.text();
  html = html
    .replace(/페이지로\s+(?!콜링크)[가-힣]{2,4}(?=입니다|`|'|"|\n)/g, '페이지로')
    .replace('</head>', '<link rel="stylesheet" href="/call/preview/v106.css?v=108"></head>')
    .replace('</body>', '<script src="/call/preview/v106.js?v=108"></script></body>');

  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.delete('Content-Length');
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
