// Public, read-only launch preflight. Do not add authentication, POST requests,
// mutable query parameters, customer identifiers, or production database writes.
const origin = 'https://pagero.kr';
const endpoints = [
  { name: 'public-home', path: '/', contentType: /text\/html/i, content: /c63-assets\/index-pagero-main-fix-20260615\.js/, note: 'frozen public main entry' },
  { name: 'root-lifestyle-bridge', path: '/c63-life-bridge.js', contentType: /(?:javascript|text\/plain)/i, content: /(?:life|bridge|pagero)/i, note: 'protected lifestyle bridge' },
  { name: 'auth-login-route', path: '/login', contentType: /text\/html/i, content: /<html[\s>]/i, note: 'login SPA entry' },
  { name: 'editor-app-route', path: '/app', contentType: /text\/html/i, content: /<html[\s>]/i, note: 'authenticated editor route shell, no login' },
  { name: 'crawler-robots', path: '/robots.txt', contentType: /text\/plain/i, content: /User-agent:/i, note: 'crawler rules are text, not SPA fallback' },
  { name: 'crawler-sitemap', path: '/sitemap.xml', contentType: /(?:xml|text\/plain)/i, content: /<(?:urlset|sitemapindex)(?:\s|>)/i, note: 'sitemap XML is not SPA fallback' },
  { name: 'hosted-api-health', path: '/api/health', contentType: /json/i, json: (v) => v?.ok === true && v?.service === 'pagero-api' && v?.auth?.sourceOfTruth === 'signed-session' && v?.storage?.active === 'd1', note: 'real production API, signed session, D1' },
  { name: 'operator-readiness', path: '/api/readiness', contentType: /json/i, json: (v) => v && typeof v === 'object' && v?.ok === true, note: 'health/readiness JSON endpoint' },
  { name: 'anonymous-admin-denied', path: '/api/admin/summary', expectedStatuses: [401, 403], contentType: /json/i, json: (v) => v?.ok === false, note: 'anonymous access cannot read platform master data' },
  { name: 'anonymous-account-page-denied', path: '/api/account-page', expectedStatuses: [401, 403], contentType: /json/i, json: (v) => v?.ok === false, note: 'anonymous access cannot read account-owned pages' },
];
async function probe(item) {
  try {
    const url = origin + item.path;
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
      headers: { Accept: item.json ? 'application/json' : '*/*' },
    });
    const contentType = response.headers.get('content-type') || '';
    const raw = (await response.text()).slice(0, 500000);
    let parsed = null;
    if (item.json) { try { parsed = JSON.parse(raw); } catch {} }
    const statusOk = item.expectedStatuses ? item.expectedStatuses.includes(response.status) : response.status === 200;
    const contentTypeOk = item.contentType.test(contentType);
    const contentOk = item.json ? item.json(parsed) : item.content.test(raw);
    return {
      name: item.name,
      status: statusOk && contentTypeOk && contentOk ? 'ready' : 'failed-live',
      httpStatus: response.status,
      contentType,
      statusOk,
      contentTypeOk,
      contentOk,
      note: item.note,
    };
  } catch (error) {
    return { name: item.name, status: 'failed-live', note: item.note, error: error?.message || String(error) };
  }
}
const results = await Promise.all(endpoints.map(probe));
const failed = results.filter((result) => result.status !== 'ready');
console.log(JSON.stringify({
  ok: failed.length === 0,
  scope: 'pagero-production-readonly-launch-preflight',
  origin,
  checked: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  readOnly: true,
  productionWrites: false,
  authenticatedSmoke: 'not-run',
  d1RestoreDrill: 'not-run',
  results,
}, null, 2));
if (failed.length) process.exitCode = 1;
