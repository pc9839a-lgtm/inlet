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
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        cache: 'no-store',
        ...options,
        headers: {
          'cache-control': 'no-cache',
          pragma: 'no-cache',
          ...(options.headers || {}),
        },
      });
      if (response.ok) return response;
      lastError = new Error(`${url} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await sleep(900 * attempt);
  }
  throw lastError || new Error(`failed to fetch ${url}`);
}

const baseUrl = normalizeBaseUrl(baseInput);
const indexUrl = new URL(baseUrl);
indexUrl.searchParams.set('__deploy_smoke', String(Date.now()));
const indexResponse = await fetchWithRetry(indexUrl);
const indexType = String(indexResponse.headers.get('content-type') || '').toLowerCase();
const indexCache = String(indexResponse.headers.get('cache-control') || '').toLowerCase();
assert(indexType.includes('text/html'), `deployment root must return HTML, received ${indexType || 'unknown content type'}`);
assert(indexCache.includes('no-store') || indexCache.includes('no-cache'), `deployment HTML cache policy is unsafe: ${indexCache || 'missing'}`);

const html = await indexResponse.text();
assert(/<div\s+id=["']root["']/i.test(html), 'deployment root HTML is missing the React root');

const refs = new Set();
const queue = [];
for (const match of html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:[?#][^"']*)?)["']/g)) {
  addAssetRef(refs, queue, indexResponse.url || indexUrl, match[1], baseUrl.origin);
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
  indexCache,
  checkedAssetCount: checked.length,
  checkedAssetBytes: checked.reduce((sum, asset) => sum + asset.bytes, 0),
  assets: checked.map((asset) => asset.path),
}, null, 2));
