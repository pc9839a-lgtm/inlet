export function trackingConfig(page = {}) {
  const meta = page.meta || {};
  const conversion = page.integrations?.conversion || {};
  const enabled = conversion.enabled !== false;
  const google = parseGoogleAds(meta.ads);
  const googleAdsTagId = extractId(meta.googleAdsTag || '', /AW-\d+/i);
  return {
    enabled,
    dataLayer: enabled && conversion.dataLayer !== false,
    gtmId: enabled ? extractId(meta.gtm, /GTM-[A-Z0-9]+/i) : '',
    ga4Id: enabled ? extractId(meta.ga4 || meta.analytics, /G-[A-Z0-9]+/i) : '',
    metaPixelId: enabled && conversion.metaPixel ? extractId(meta.pixel, /\d{6,}/) : '',
    googleAdsTagId: enabled ? googleAdsTagId : '',
    googleAdsId: enabled && conversion.googleAds ? (google.id || googleAdsTagId) : '',
    googleAdsSendTo: enabled && conversion.googleAds ? google.sendTo : '',
    naverId: enabled && conversion.naver ? extractNaverId(meta.naver) : '',
    kakaoPixelId: enabled && conversion.kakao ? extractId(meta.kakao || meta.kakaoPixel, /\d{4,}/) : '',
  };
}

export function installPageHeadMeta(page = {}, doc = safeDocument()) {
  if (!doc) return headMetaConfig(page);
  const config = headMetaConfig(page);
  if (config.title) doc.title = config.title;
  upsertMeta(doc, 'name', 'description', config.description);
  upsertMeta(doc, 'property', 'og:title', config.title);
  upsertMeta(doc, 'property', 'og:description', config.description);
  upsertMeta(doc, 'property', 'og:image', config.ogImage);
  upsertMeta(doc, 'name', 'google-site-verification', config.googleSiteVerification);
  upsertMeta(doc, 'name', 'naver-site-verification', config.naverSiteVerification);
  upsertLink(doc, 'icon', config.favicon);
  return config;
}

export function headMetaConfig(page = {}) {
  const meta = page.meta || {};
  const title = cleanMetaValue(meta.title || page.title || '');
  const description = cleanMetaValue(meta.desc || meta.description || '');
  return {
    title,
    description,
    favicon: cleanMetaValue(meta.favicon || ''),
    ogImage: cleanMetaValue(meta.og || ''),
    googleSiteVerification: extractGoogleSiteVerification(meta.console || meta.googleConsole || ''),
    naverSiteVerification: extractNaverSiteVerification(meta.naverWebmaster || ''),
  };
}

export function installConversionTracking(page = {}, win = safeWindow(), doc = safeDocument()) {
  if (!win || !doc) return trackingConfig(page);
  const config = trackingConfig(page);
  if (!config.enabled) return config;

  if (config.dataLayer || config.gtmId || config.ga4Id || config.googleAdsTagId || config.googleAdsId) {
    win.dataLayer = win.dataLayer || [];
  }

  if (config.gtmId) {
    win.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    appendScriptOnce(doc, `inlet-gtm-${config.gtmId}`, `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(config.gtmId)}`);
  }

  if (config.metaPixelId) {
    win.fbq = win.fbq || function fbq() { (win.fbq.q = win.fbq.q || []).push(arguments); };
    win.fbq('init', config.metaPixelId);
    win.fbq('track', 'PageView');
    appendScriptOnce(doc, 'inlet-meta-pixel', 'https://connect.facebook.net/en_US/fbevents.js');
  }

  if (config.ga4Id) {
    win.gtag = win.gtag || function gtag() { win.dataLayer.push(arguments); };
    win.gtag('js', new Date());
    win.gtag('config', config.ga4Id);
    appendScriptOnce(doc, `inlet-ga4-${config.ga4Id}`, `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.ga4Id)}`);
  }

  const googleTagId = config.googleAdsId || config.googleAdsTagId;
  if (googleTagId) {
    win.gtag = win.gtag || function gtag() { win.dataLayer.push(arguments); };
    win.gtag('js', new Date());
    win.gtag('config', googleTagId);
    if (config.googleAdsSendTo) win.inletGoogleAdsSendTo = config.googleAdsSendTo;
    appendScriptOnce(doc, `inlet-google-ads-${googleTagId}`, `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleTagId)}`);
  }

  if (config.naverId) {
    win.wcs_add = win.wcs_add || {};
    win.wcs_add.wa = config.naverId;
    appendScriptOnce(doc, 'inlet-naver-wcs', 'https://wcs.naver.net/wcslog.js');
  }

  if (config.kakaoPixelId) {
    win.kakaoPixelId = config.kakaoPixelId;
    appendScriptOnce(doc, 'inlet-kakao-pixel', 'https://t1.daumcdn.net/kas/static/kp.js');
  }

  return config;
}

function parseGoogleAds(value = '') {
  const raw = String(value || '');
  const id = extractId(raw, /AW-\d+/i);
  const sendTo = raw.match(/AW-\d+\/[A-Za-z0-9_-]+/)?.[0] || '';
  return { id, sendTo };
}

function extractNaverId(value = '') {
  const raw = String(value || '');
  return raw.match(/_nasa\["cnv"\]|wcs_add/i) ? extractId(raw, /[a-f0-9]{8,}|s_[A-Za-z0-9_-]+/i) : raw.trim();
}

function extractId(value = '', pattern) {
  return String(value || '').match(pattern)?.[0] || '';
}

function extractGoogleSiteVerification(value = '') {
  const raw = String(value || '').trim();
  return raw.match(/google-site-verification["']?\s+content=["']([^"']+)["']/i)?.[1]
    || raw.match(/content=["']([^"']+)["'][^>]*google-site-verification/i)?.[1]
    || raw.replace(/<[^>]+>/g, '').trim();
}

function extractNaverSiteVerification(value = '') {
  const raw = String(value || '').trim();
  return raw.match(/naver-site-verification["']?\s+content=["']([^"']+)["']/i)?.[1]
    || raw.match(/content=["']([^"']+)["'][^>]*naver-site-verification/i)?.[1]
    || raw.replace(/<[^>]+>/g, '').trim();
}

function cleanMetaValue(value = '') {
  return String(value || '').trim();
}

function upsertMeta(doc, attr, key, content) {
  const selector = `meta[${attr}="${key}"]`;
  const existing = doc.querySelector?.(selector);
  if (!content) {
    existing?.remove?.();
    return;
  }
  const node = existing || doc.createElement('meta');
  node.setAttribute?.(attr, key);
  node.setAttribute?.('content', content);
  if (!existing) doc.head.appendChild(node);
}

function upsertLink(doc, rel, href) {
  const selector = `link[rel="${rel}"]`;
  const existing = doc.querySelector?.(selector);
  if (!href) {
    existing?.remove?.();
    return;
  }
  const node = existing || doc.createElement('link');
  node.setAttribute?.('rel', rel);
  node.setAttribute?.('href', href);
  if (!existing) doc.head.appendChild(node);
}

function appendScriptOnce(doc, id, src) {
  if (!src || doc.getElementById(id)) return;
  const script = doc.createElement('script');
  script.id = id;
  script.async = true;
  script.src = src;
  doc.head.appendChild(script);
}

function safeWindow() {
  try {
    return typeof window !== 'undefined' ? window : null;
  } catch {
    return null;
  }
}

function safeDocument() {
  try {
    return typeof document !== 'undefined' ? document : null;
  } catch {
    return null;
  }
}
