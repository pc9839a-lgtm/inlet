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
  };
  const mapped = routes[clean];
  if (!mapped) return context.next();
  const assetUrl = new URL(context.request.url);
  assetUrl.pathname = mapped;
  assetUrl.search = '';
  return context.env.ASSETS.fetch(assetUrl);
}
