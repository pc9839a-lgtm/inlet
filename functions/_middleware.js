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
  };
  const mapped = routes[clean];
  if (!mapped) return context.next();

  const assetUrl = new URL(context.request.url);
  assetUrl.pathname = mapped;
  assetUrl.search = '';
  const response = await context.env.ASSETS.fetch(assetUrl);

  if (!clean.includes('preview')) return response;

  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  headers.set('X-CallLink-Preview-Version', '1.0.4');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
