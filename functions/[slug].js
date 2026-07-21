import { findPublicPageBySlug, injectPublicPageHead, safePublicSlug } from './_publicPageMeta.js';

const APP_ROUTES = new Set([
  'account', 'admin', 'app', 'dashboard', 'embed', 'invite', 'login', 'signup',
]);

export async function onRequest(context) {
  const { env, params, request } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') return context.next();

  const slug = safePublicSlug(params?.slug);
  if (!slug || APP_ROUTES.has(slug) || String(params?.slug || '').includes('.')) return context.next();

  const page = await findPublicPageBySlug(env, slug).catch(() => null);
  if (!page) return context.next();

  const shellUrl = new URL('/index.html', request.url);
  const shellRequest = new Request(shellUrl, request);
  const response = env.ASSETS?.fetch
    ? await env.ASSETS.fetch(shellRequest)
    : await context.next();
  if (!response.ok) return response;

  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  headers.set('X-Robots-Tag', 'index, follow');
  return new Response(injectPublicPageHead(html, page, request.url), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}