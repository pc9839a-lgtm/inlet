import { decodeD1Page } from '../server/storage/d1Adapter.mjs';

export function safePublicSlug(value = '') {
  return String(value || '').replace(/[^a-zA-Z0-9-_]/g, '');
}

export async function findPublicPageBySlug(env = {}, slug = '') {
  const safeSlug = safePublicSlug(slug);
  if (!safeSlug || !env.DB?.prepare) return null;
  const row = await env.DB.prepare(`
    SELECT pages.*
    FROM pages
    LEFT JOIN projects ON projects.id = pages.project_id
    WHERE pages.slug = ?
      AND COALESCE(projects.status, 'active') <> 'archived'
    ORDER BY pages.updated_at DESC, pages.revision DESC, projects.updated_at DESC, pages.id DESC
    LIMIT 1
  `).bind(safeSlug).first();
  return row ? decodeD1Page(row) : null;
}

export function pageHeadMeta(page = {}, requestUrl = '') {
  const meta = page.meta || {};
  const canonical = new URL(`/${encodeURIComponent(page.slug || '')}`, requestUrl).toString();
  const rawImage = String(meta.og || '').trim();
  const ogImage = rawImage.startsWith('data:image/')
    ? new URL(`/api/pages/${encodeURIComponent(page.slug || '')}/og-image`, requestUrl).toString()
    : absoluteUrl(rawImage, requestUrl);
  return {
    title: String(meta.title || page.title || '').trim(),
    description: String(meta.desc || meta.description || '').trim(),
    canonical,
    ogImage,
    favicon: String(meta.favicon || '').trim(),
    googleVerification: verificationValue(meta.console || meta.googleConsole || '', 'google-site-verification'),
    naverVerification: verificationValue(meta.naverWebmaster || '', 'naver-site-verification'),
  };
}

export function injectPublicPageHead(html = '', page = {}, requestUrl = '') {
  const meta = pageHeadMeta(page, requestUrl);
  let output = String(html || '');
  output = removeTag(output, /<title\b[^>]*>[\s\S]*?<\/title\s*>/gi);
  output = removeTag(output, /<meta\b[^>]*(?:name=["'](?:description|google-site-verification|naver-site-verification)["']|property=["']og:(?:title|description|image|url|type)["'])[^>]*>/gi);
  output = removeTag(output, /<link\b[^>]*rel=["']canonical["'][^>]*>/gi);
  if (meta.favicon) output = removeTag(output, /<link\b[^>]*rel=["'](?:shortcut )?icon["'][^>]*>/gi);

  const tags = [
    meta.title && `<title>${escapeHtml(meta.title)}</title>`,
    meta.description && `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    '<meta property="og:type" content="website" />',
    meta.title && `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    meta.description && `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    meta.ogImage && `<meta property="og:image" content="${escapeHtml(meta.ogImage)}" />`,
    `<meta property="og:url" content="${escapeHtml(meta.canonical)}" />`,
    `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`,
    meta.googleVerification && `<meta name="google-site-verification" content="${escapeHtml(meta.googleVerification)}" />`,
    meta.naverVerification && `<meta name="naver-site-verification" content="${escapeHtml(meta.naverVerification)}" />`,
    meta.favicon && `<link rel="icon" href="${escapeHtml(absoluteUrl(meta.favicon, requestUrl))}" />`,
  ].filter(Boolean).join('\n  ');

  return output.replace(/<\/head\s*>/i, `  ${tags}\n</head>`);
}

export function decodeDataImage(value = '') {
  const match = String(value || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\s]+)$/);
  if (!match) return null;
  const binary = atob(match[2].replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { contentType: match[1], bytes };
}

function absoluteUrl(value = '', requestUrl = '') {
  if (!value) return '';
  try {
    return new URL(value, requestUrl).toString();
  } catch {
    return '';
  }
}

function verificationValue(value = '', name = '') {
  const raw = String(value || '').trim();
  return raw.match(new RegExp(`${name}["']?\\s+content=["']([^"']+)["']`, 'i'))?.[1]
    || raw.match(new RegExp(`content=["']([^"']+)["'][^>]*${name}`, 'i'))?.[1]
    || raw.replace(/<[^>]+>/g, '').trim();
}

function removeTag(html, pattern) {
  return html.replace(pattern, '');
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}