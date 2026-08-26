function isCallTagHost(hostname = '') {
  const host = String(hostname || '').trim().toLowerCase();
  return host === 'calltag.pagero.kr' || host === 'call.pagero.kr' || host === 'localhost' || host.endsWith('.localhost');
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (!isCallTagHost(url.hostname)) return context.next();
  if (!['GET', 'HEAD'].includes(context.request.method)) {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const assetUrl = new URL(context.request.url);
  assetUrl.pathname = '/call/connect/index.html';
  assetUrl.search = '';
  const response = await context.env.ASSETS.fetch(assetUrl);
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.delete('Content-Length');
  return new Response(context.request.method === 'HEAD' ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
