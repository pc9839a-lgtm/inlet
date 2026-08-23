import { injectPageroStaticSeo } from './pageroStaticSeo.js';

export async function servePageroStaticPage(context) {
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' },
    });
  }

  const url = new URL(context.request.url);
  const assetUrl = new URL(context.request.url);
  assetUrl.pathname = '/index.html';
  assetUrl.search = '';

  const assetResponse = await context.env.ASSETS.fetch(assetUrl);
  if (context.request.method === 'HEAD') {
    return new Response(null, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers: assetResponse.headers,
    });
  }

  return (await injectPageroStaticSeo(context, url, assetResponse)) || assetResponse;
}
