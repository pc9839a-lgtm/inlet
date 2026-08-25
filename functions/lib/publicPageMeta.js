import { injectPageroRootSeo } from './pageroRootSeo.js';

const OG_IMAGE_PATH_PREFIX = '/__pagero_og/';
const PUBLIC_SLUG_PATTERN = /^[a-zA-Z0-9_-]+$/;

function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanSlug(value = '') {
  const slug = String(value || '').trim().replace(/^\/+|\/+$/g, '');
  return PUBLIC_SLUG_PATTERN.test(slug) ? slug : '';
}

function slugFromPublicPath(pathname = '') {
  const clean = String(pathname || '/').replace(/^\/+|\/+$/g, '');
  if (!clean || clean.includes('/')) return '';
  return cleanSlug(clean);
}

function pageFromRow(row = {}) {
  try {
    const page = JSON.parse(String(row.page_json || '{}'));
    return page && typeof page === 'object' ? page : {};
  } catch {
    return {};
  }
}

async function loadPublicPage(env = {}, slug = '') {
  const safeSlug = cleanSlug(slug);
  if (!safeSlug || !env.DB || typeof env.DB.prepare !== 'function') return null;
  try {
    const row = await env.DB.prepare(`
      SELECT pages.page_json, pages.title, pages.slug, pages.revision, pages.updated_at, pages.published_at
      FROM pages
      LEFT JOIN projects ON projects.id = pages.project_id
      WHERE pages.slug = ?
        AND COALESCE(projects.status, 'active') <> 'archived'
      ORDER BY pages.updated_at DESC, pages.revision DESC, pages.id DESC
      LIMIT 1
    `).bind(safeSlug).first();
    if (!row) return null;
    return { row, page: pageFromRow(row) };
  } catch (error) {
    console.warn('Public page metadata lookup failed:', safeSlug, String(error?.message || error));
    return null;
  }
}

function parseImageDataUrl(value = '') {
  const match = String(value || '').trim().match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,([a-zA-Z0-9+/=\s]+)$/i);
  if (!match) return null;
  return {
    contentType: match[1].toLowerCase().replace('image/jpg', 'image/jpeg'),
    base64: match[2].replace(/\s/g, ''),
  };
}

function decodeBase64Bytes(base64 = '') {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function safeAbsoluteHttpUrl(value = '', baseUrl = '') {
  const raw = String(value || '').trim();
  if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return '';
  try {
    const resolved = new URL(raw, baseUrl);
    if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') return '';
    return resolved.toString();
  } catch {
    return '';
  }
}

function canonicalPageUrl(url, slug) {
  const host = String(url.hostname || '').toLowerCase();
  if (host === 'pagero.kr' || host.endsWith('.pagero.kr') || host.endsWith('.pages.dev') || host === 'localhost' || host.endsWith('.localhost')) {
    return `https://pagero.kr/${encodeURIComponent(slug)}`;
  }
  const clean = new URL(url.toString());
  clean.search = '';
  clean.hash = '';
  return clean.toString();
}

function shareImageUrl(meta = {}, row = {}, url, slug) {
  const raw = String(meta.og || '').trim();
  if (!raw) return '';
  const direct = safeAbsoluteHttpUrl(raw, url.toString());
  if (direct) return direct;
  if (!parseImageDataUrl(raw)) return '';
  const version = encodeURIComponent(String(row.revision || row.updated_at || '1'));
  return `${url.origin}${OG_IMAGE_PATH_PREFIX}${encodeURIComponent(slug)}?v=${version}`;
}

function shareImageType(meta = {}) {
  const parsed = parseImageDataUrl(meta.og || '');
  return parsed?.contentType || '';
}

function replaceDocumentTitle(html = '', title = '') {
  const nextTitle = `<title>${escapeHtml(title)}</title>`;
  if (/<title\b[^>]*>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, nextTitle);
  }
  return html.replace(/<\/head>/i, `${nextTitle}\n</head>`);
}

function injectHeadTags(html = '', tags = '') {
  if (!tags || !/<\/head>/i.test(html)) return html;
  return html.replace(/<\/head>/i, `${tags}\n</head>`);
}

function metadataTags({ title, description, canonical, image, imageType, favicon, naver, google }) {
  const tags = [
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="페이지로">',
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
  ];

  if (image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(image)}">`);
    tags.push(`<meta property="og:image:secure_url" content="${escapeHtml(image)}">`);
    if (imageType) tags.push(`<meta property="og:image:type" content="${escapeHtml(imageType)}">`);
    tags.push(`<meta name="twitter:image" content="${escapeHtml(image)}">`);
  }

  const faviconUrl = safeAbsoluteHttpUrl(favicon, canonical);
  if (faviconUrl) tags.push(`<link rel="icon" href="${escapeHtml(faviconUrl)}">`);
  else if (String(favicon || '').trim().startsWith('data:image/')) tags.push(`<link rel="icon" href="${escapeHtml(favicon)}">`);
  if (naver) tags.push(`<meta name="naver-site-verification" content="${escapeHtml(naver)}">`);
  if (google) tags.push(`<meta name="google-site-verification" content="${escapeHtml(google)}">`);
  return tags.join('\n');
}

export async function handlePublicOgImageRequest(context, url) {
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') return null;
  if (!String(url.pathname || '').startsWith(OG_IMAGE_PATH_PREFIX)) return null;

  let decodedSlug = '';
  try {
    decodedSlug = decodeURIComponent(String(url.pathname || '').slice(OG_IMAGE_PATH_PREFIX.length));
  } catch {
    return new Response('Not Found', { status: 404 });
  }
  const slug = cleanSlug(decodedSlug);
  if (!slug) return new Response('Not Found', { status: 404 });

  const record = await loadPublicPage(context.env, slug);
  const meta = record?.page?.meta || {};
  const parsed = parseImageDataUrl(meta.og || '');
  if (!parsed) return new Response('Not Found', { status: 404 });

  try {
    const bytes = decodeBase64Bytes(parsed.base64);
    const headers = new Headers({
      'Content-Type': parsed.contentType,
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
      'Access-Control-Allow-Origin': '*',
      'X-Pagero-Og-Image': 'd1-data-url-v1',
    });
    return new Response(context.request.method === 'HEAD' ? null : bytes, { status: 200, headers });
  } catch (error) {
    console.warn('Public OG image decode failed:', slug, String(error?.message || error));
    return new Response('Not Found', { status: 404 });
  }
}

export async function injectPublicPageMeta(context, url, response) {
  if (context.request.method !== 'GET') return response;
  if (!response?.ok) return response;
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('text/html')) return response;

  const rootSeoResponse = await injectPageroRootSeo(url, response);
  if (rootSeoResponse.headers.get('X-Pagero-Root-SEO')) return rootSeoResponse;

  const slug = slugFromPublicPath(url.pathname);
  if (!slug) return response;
  const record = await loadPublicPage(context.env, slug);
  if (!record) return response;

  const { row, page } = record;
  const meta = page.meta || {};
  const title = String(meta.title || page.title || row.title || '페이지로').trim() || '페이지로';
  const description = String(meta.desc || page.title || row.title || '').trim();
  const canonical = canonicalPageUrl(url, slug);
  const image = shareImageUrl(meta, row, url, slug);
  const imageType = shareImageType(meta);

  let html = await response.text();
  html = replaceDocumentTitle(html, title);
  html = injectHeadTags(html, metadataTags({
    title,
    description,
    canonical,
    image,
    imageType,
    favicon: meta.favicon || '',
    naver: meta.naverWebmaster || '',
    google: meta.console || '',
  }));

  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  headers.set('X-Pagero-Public-Meta', 'edge-og-v1');
  headers.delete('Content-Length');
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Files inside /functions participate in Pages file-based routing. This module
// is primarily imported by root middleware, but a pass-through handler keeps
// its own route valid and side-effect free if requested directly.
export async function onRequest(context) {
  return context.next();
}
