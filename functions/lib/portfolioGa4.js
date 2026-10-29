// Shared GA4 for PageRo-operated properties. This deliberately excludes
// customer-published /slug pages from platform analytics.
const GA4_ID = 'G-501Z526B8H';
const MARKER = 'data-pagero-portfolio-ga4';
const PLATFORM_HOSTS = new Set(['pagero.kr', 'www.pagero.kr']);
const CALL_HOSTS = new Set(['calltag.pagero.kr', 'call.pagero.kr']);

function isIncluded(url) {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (PLATFORM_HOSTS.has(host)) {
    return path === '/' || /^\/(?:about|contact|guide|tools|life|privacy|terms|login|signup)(?:\/|$)/i.test(path);
  }
  if (CALL_HOSTS.has(host)) return !/^\/(?:api|admin|dashboard|account)(?:\/|$)/i.test(path);
  return false;
}

export async function injectPortfolioGa4(context, url, response) {
  if (context.request.method !== 'GET' || !response?.ok || !isIncluded(url)) return response;
  if (!String(response.headers.get('content-type') || '').toLowerCase().includes('text/html')) return response;
  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  // The platform SPA shell already contains the same measurement ID.
  if (!/<\/head>/i.test(html) || html.includes(MARKER) || html.includes('PAGERO_GA4_FIRST_PARTY_ONLY')) {
    return new Response(html, { status: response.status, statusText: response.statusText, headers });
  }
  const tag = `<script ${MARKER}>(function(){if(!/^(?:pagero\\.kr|www\\.pagero\\.kr|calltag\\.pagero\\.kr|call\\.pagero\\.kr)$/i.test(location.hostname))return;window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};window.gtag('js',new Date());window.gtag('config','${GA4_ID}');var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=${GA4_ID}';document.head.appendChild(s)})();</script>`;
  const modified = html.replace(/<\/head>/i, tag + '\n</head>');
  headers.delete('etag');
  return new Response(modified, { status: response.status, statusText: response.statusText, headers });
}

export async function onRequest(context) { return context.next(); }
