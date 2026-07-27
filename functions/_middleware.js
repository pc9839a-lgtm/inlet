export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname !== 'call.pagero.kr' || url.pathname.startsWith('/api/')) {
    return context.next();
  }

  const clean = url.pathname.replace(/\/+$/, '') || '/';
  const routes = {
    '/': '/call/index.html',
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
  };
  const mapped = routes[clean];
  if (!mapped) return context.next();

  const assetUrl = new URL(context.request.url);
  assetUrl.pathname = mapped;
  assetUrl.search = '';
  const response = await context.env.ASSETS.fetch(assetUrl);

  if (!clean.includes('preview')) return response;

  let html = await response.text();
  html = html
    .replace(/페이지로\s+(?!콜링크)[가-힣]{2,4}(?=입니다|`|'|"|\n)/g, '페이지로')
    .replace('</head>', '<link rel="stylesheet" href="/call/preview/v105.css?v=105"></head>')
    .replace('</body>', '<script src="/call/preview/v105.js?v=105"></script></body>');

  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  headers.set('X-CallLink-Preview-Version', '1.0.5');
  headers.delete('Content-Length');
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}