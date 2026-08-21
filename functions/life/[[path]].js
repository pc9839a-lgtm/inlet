const LIFE_UPSTREAM_ORIGIN = 'https://life.pagero.kr';
const LIFE_PUBLIC_ORIGIN = 'https://pagero.kr/life';
const LIFE_PREFIX = '/life';

function isPreviewOrPageroHost(hostname = '') {
  const host = String(hostname || '').trim().toLowerCase();
  return host === 'pagero.kr'
    || host === 'www.pagero.kr'
    || host.endsWith('.pages.dev');
}

export function upstreamUrlFor(requestUrl) {
  const incoming = requestUrl instanceof URL ? requestUrl : new URL(requestUrl);
  const upstream = new URL(LIFE_UPSTREAM_ORIGIN);
  const pathname = incoming.pathname === LIFE_PREFIX
    ? '/'
    : incoming.pathname.startsWith(`${LIFE_PREFIX}/`)
      ? incoming.pathname.slice(LIFE_PREFIX.length) || '/'
      : incoming.pathname;
  upstream.pathname = pathname || '/';
  upstream.search = incoming.search;
  return upstream;
}

function rewriteAbsoluteOrigin(value = '') {
  return String(value).split(LIFE_UPSTREAM_ORIGIN).join(LIFE_PUBLIC_ORIGIN);
}

function prefixRootRelativeQuotedPaths(value = '') {
  return String(value).replace(/(["'])\/(?!\/|life(?:\/|["']))/g, `$1${LIFE_PREFIX}/`);
}

function prefixRootRelativeCssUrls(value = '') {
  return String(value)
    .replace(/url\(\s*\/(?!\/|life\/)/gi, `url(${LIFE_PREFIX}/`)
    .replace(/@import\s+\/((?!\/|life\/)[^;\s]+)/gi, `@import ${LIFE_PREFIX}/$1`);
}

export function rewriteLifeText(value = '', contentType = '') {
  const type = String(contentType || '').toLowerCase();
  let output = rewriteAbsoluteOrigin(value);

  if (type.includes('text/html')
      || type.includes('application/xhtml+xml')
      || type.includes('application/manifest+json')
      || type.includes('application/json')) {
    output = prefixRootRelativeQuotedPaths(output);
  }

  if (type.includes('text/css')) {
    output = prefixRootRelativeQuotedPaths(output);
    output = prefixRootRelativeCssUrls(output);
  }

  return output;
}

export function rewriteLifeLocation(location = '') {
  const value = String(location || '').trim();
  if (!value) return value;
  if (value.startsWith(LIFE_UPSTREAM_ORIGIN)) {
    return `${LIFE_PUBLIC_ORIGIN}${value.slice(LIFE_UPSTREAM_ORIGIN.length)}`;
  }
  if (value.startsWith('/') && !value.startsWith('//')) {
    if (value === LIFE_PREFIX || value.startsWith(`${LIFE_PREFIX}/`)) return value;
    return `${LIFE_PREFIX}${value}`;
  }
  return value;
}

function isRewritableText(contentType = '') {
  const type = String(contentType || '').toLowerCase();
  return type.includes('text/html')
    || type.includes('application/xhtml+xml')
    || type.includes('text/css')
    || type.includes('text/plain')
    || type.includes('application/xml')
    || type.includes('text/xml')
    || type.includes('application/rss+xml')
    || type.includes('application/atom+xml')
    || type.includes('application/manifest+json')
    || type.includes('application/json');
}

function prepareHeaders(sourceHeaders) {
  const headers = new Headers(sourceHeaders);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('etag');
  headers.set('X-Pagero-Life-Proxy', '1');
  headers.set('X-Pagero-Life-Upstream', 'life.pagero.kr');
  return headers;
}

function proxyErrorHtml() {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>생활비서 연결 오류</title></head><body><main><h1>생활비서 페이지를 불러오지 못했습니다.</h1><p>잠시 후 다시 시도해 주세요.</p></main></body></html>`;
}

export async function onRequest(context) {
  const incoming = new URL(context.request.url);
  if (!isPreviewOrPageroHost(incoming.hostname)) return context.next();
  if (!(incoming.pathname === LIFE_PREFIX || incoming.pathname.startsWith(`${LIFE_PREFIX}/`))) return context.next();

  const method = String(context.request.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' },
    });
  }

  const upstreamUrl = upstreamUrlFor(incoming);
  const requestHeaders = new Headers(context.request.headers);
  requestHeaders.delete('host');
  requestHeaders.set('X-Pagero-Life-Proxy-Request', '1');

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(new Request(upstreamUrl.toString(), {
      method,
      headers: requestHeaders,
      redirect: 'manual',
    }));
  } catch (error) {
    console.error('Pagero life proxy fetch failed:', String(error?.message || error));
    return new Response(method === 'HEAD' ? null : proxyErrorHtml(), {
      status: 502,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Pagero-Life-Proxy': 'error',
      },
    });
  }

  const headers = prepareHeaders(upstreamResponse.headers);
  const location = headers.get('location');
  if (location) headers.set('location', rewriteLifeLocation(location));
  const link = headers.get('link');
  if (link) headers.set('link', rewriteAbsoluteOrigin(link));

  if (method === 'HEAD' || [204, 304].includes(upstreamResponse.status)) {
    return new Response(null, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });
  }

  const contentType = headers.get('content-type') || '';
  if (!isRewritableText(contentType)) {
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });
  }

  let text = await upstreamResponse.text();
  text = rewriteLifeText(text, contentType);

  return new Response(text, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers,
  });
}
