const baseInput = String(process.argv[2] || process.env.INLET_DEPLOY_URL || '').trim();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBaseUrl(value) {
  assert(value, 'deployment live asset check requires a deployment URL');
  const url = new URL(value);
  assert(url.protocol === 'https:' || url.hostname === 'localhost', `unsupported deployment URL: ${value}`);
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url;
}

function isAssetUrl(url, origin) {
  return url.origin === origin && url.pathname.startsWith('/assets/') && /\.(?:js|css)$/.test(url.pathname);
}

function addAssetRef(refs, queue, currentUrl, rawRef, origin) {
  try {
    const cleanRef = String(rawRef || '').replace(/&amp;/g, '&');
    const resolved = new URL(cleanRef, currentUrl);
    resolved.hash = '';
    if (!isAssetUrl(resolved, origin)) return;
    const key = resolved.toString();
    if (refs.has(key)) return;
    refs.add(key);
    queue.push(resolved);
  } catch {}
}

async function fetchWithRetry(url, options = {}, attempts = 5) {
  const { acceptStatuses = [], ...fetchOptions } = options;
  const accepted = new Set(acceptStatuses.map(Number));
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        cache: 'no-store',
        signal: fetchOptions.signal || AbortSignal.timeout(15000),
        ...fetchOptions,
        headers: {
          'cache-control': 'no-cache',
          pragma: 'no-cache',
          ...(fetchOptions.headers || {}),
        },
      });
      if (response.ok || accepted.has(response.status)) return response;
      lastError = new Error(`${url} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await sleep(900 * attempt);
  }
  throw lastError || new Error(`failed to fetch ${url}`);
}

function smokeUrl(baseUrl, pathname, params = {}) {
  const url = new URL(pathname, baseUrl);
  url.searchParams.set('__deploy_smoke', String(Date.now()));
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  return url;
}

function htmlCacheIsSafe(value = '') {
  const cache = String(value || '').toLowerCase();
  return cache.includes('no-store') || cache.includes('no-cache');
}

async function checkHtmlRoute(baseUrl, pathname, label) {
  const url = smokeUrl(baseUrl, pathname);
  const response = await fetchWithRetry(url);
  const type = String(response.headers.get('content-type') || '').toLowerCase();
  const cache = String(response.headers.get('cache-control') || '').toLowerCase();
  const html = await response.text();

  assert(type.includes('text/html'), `${label} must return HTML, received ${type || 'unknown content type'}`);
  assert(htmlCacheIsSafe(cache), `${label} HTML cache policy is unsafe: ${cache || 'missing'}`);
  assert(/<div\s+id=["']root["']/i.test(html), `${label} HTML is missing the React root`);

  return {
    label,
    path: pathname,
    status: response.status,
    type,
    cache,
    finalUrl: response.url,
    html,
  };
}

async function checkJsonRoute(baseUrl, pathname, label, expectedStatuses, params = {}) {
  const url = smokeUrl(baseUrl, pathname, params);
  const response = await fetchWithRetry(url, { acceptStatuses: expectedStatuses });
  const type = String(response.headers.get('content-type') || '').toLowerCase();
  const text = await response.text();

  assert(expectedStatuses.includes(response.status), `${label} returned HTTP ${response.status}; expected ${expectedStatuses.join(' or ')}`);
  assert(type.includes('application/json') || type.includes('+json'), `${label} must return JSON, received ${type || 'unknown content type'}`);
  assert(text.trim(), `${label} returned an empty JSON response`);
  assert(!/<(?:!doctype|html|body)\b/i.test(text), `${label} returned the SPA HTML fallback instead of a Functions response`);

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
  assert(data && typeof data === 'object', `${label} returned an invalid JSON payload`);

  return {
    label,
    path: `${url.pathname}${url.search}`,
    status: response.status,
    type,
    code: String(data.code || data.errorCode || ''),
  };
}

const baseUrl = normalizeBaseUrl(baseInput);
const routeChecks = [];
const root = await checkHtmlRoute(baseUrl, '/', 'Deployment root');
routeChecks.push({ label: root.label, path: root.path, status: root.status, type: root.type, cache: root.cache });

for (const [pathname, label] of [
  ['/login', 'Login route'],
  ['/about', 'Static information route'],
]) {
  const result = await checkHtmlRoute(baseUrl, pathname, label);
  routeChecks.push({ label: result.label, path: result.path, status: result.status, type: result.type, cache: result.cache });
}

routeChecks.push(await checkJsonRoute(
  baseUrl,
  '/api/admin/summary',
  'Protected admin Functions route',
  [401, 403],
));

const missingPublicSlug = `deploy-smoke-missing-${Date.now()}`;
routeChecks.push(await checkJsonRoute(
  baseUrl,
  `/api/pages/${missingPublicSlug}`,
  'Public page Functions route',
  [404],
  { public: 1, fresh: Date.now() },
));

const html = root.html;
const refs = new Set();
const queue = [];
for (const match of html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:[?#][^"']*)?)["']/g)) {
  addAssetRef(refs, queue, root.finalUrl || baseUrl, match[1], baseUrl.origin);
}
assert(queue.length > 0, 'deployment HTML does not reference any JS/CSS assets');

const checked = [];
const maxAssets = 250;
while (queue.length) {
  assert(checked.length < maxAssets, `deployment asset graph exceeded ${maxAssets} files`);
  const assetUrl = queue.shift();
  const response = await fetchWithRetry(assetUrl);
  const type = String(response.headers.get('content-type') || '').toLowerCase();
  const cache = String(response.headers.get('cache-control') || '').toLowerCase();
  const isJs = assetUrl.pathname.endsWith('.js');
  const expectedType = isJs ? ['javascript', 'ecmascript'] : ['text/css'];

  assert(expectedType.some((token) => type.includes(token)), `${assetUrl.pathname} returned an invalid content type: ${type || 'missing'}`);
  assert(cache.includes('immutable') && /max-age=(?:31536000|[4-9]\d{7,})/.test(cache), `${assetUrl.pathname} is not immutable for one year: ${cache || 'missing'}`);

  const source = await response.text();
  assert(source.length > 0, `${assetUrl.pathname} returned an empty response`);
  checked.push({
    path: assetUrl.pathname,
    type,
    bytes: Buffer.byteLength(source),
  });

  if (!isJs) continue;
  for (const match of source.matchAll(/["']((?:\.{1,2}\/|\/?assets\/)[^"']+\.(?:js|css)(?:[?#][^"']*)?)["']/g)) {
    addAssetRef(refs, queue, assetUrl, match[1], baseUrl.origin);
  }
}

console.log(JSON.stringify({
  ok: true,
  deploymentUrl: baseUrl.toString(),
  routeChecks,
  indexCache: root.cache,
  checkedAssetCount: checked.length,
  checkedAssetBytes: checked.reduce((sum, asset) => sum + asset.bytes, 0),
  assets: checked.map((asset) => asset.path),
}, null, 2));
