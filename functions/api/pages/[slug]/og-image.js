import { decodeDataImage, findPublicPageBySlug, safePublicSlug } from '../../../_publicPageMeta.js';

export async function onRequest({ env, params, request }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const slug = safePublicSlug(params?.slug);
  const page = await findPublicPageBySlug(env, slug).catch(() => null);
  if (!page) return new Response('Not Found', { status: 404 });

  const source = String(page.meta?.og || '').trim();
  const image = decodeDataImage(source);
  if (image) {
    return new Response(request.method === 'HEAD' ? null : image.bytes, {
      headers: {
        'Content-Type': image.contentType,
        'Cache-Control': 'public, max-age=300, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  if (/^https?:\/\//i.test(source)) return Response.redirect(source, 302);
  return new Response('Not Found', { status: 404 });
}