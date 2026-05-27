import { headMetaConfig, installConversionTracking, installPageHeadMeta, trackingConfig } from '../src/lib/conversionTracking.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const page = {
  slug: 'qa',
  meta: {
    gtm: 'GTM-ABC123',
    ga4: 'G-QATEST1234',
    googleAdsTag: 'AW-222333444',
    pixel: '123456789012345',
    ads: 'AW-123456789/AbCdEfGh',
    naver: 's_abcdef1234',
    kakao: '987654321',
    title: 'QA 랜딩',
    desc: 'QA 설명',
    favicon: 'data:image/svg+xml,<svg></svg>',
    og: 'https://example.com/og.png',
    console: '<meta name="google-site-verification" content="google-verify-token" />',
    naverWebmaster: '<meta name="naver-site-verification" content="naver-verify-token" />',
  },
  integrations: {
    conversion: {
      enabled: true,
      dataLayer: true,
      metaPixel: true,
      googleAds: true,
      naver: true,
      kakao: true,
    },
  },
};

const config = trackingConfig(page);
assert(config.enabled, 'conversion should be enabled');
assert(config.dataLayer, 'dataLayer should be enabled');
assert(config.gtmId === 'GTM-ABC123', `gtm mismatch: ${config.gtmId}`);
assert(config.ga4Id === 'G-QATEST1234', `ga4 mismatch: ${config.ga4Id}`);
assert(config.googleAdsTagId === 'AW-222333444', `google ads tag mismatch: ${config.googleAdsTagId}`);
assert(config.metaPixelId === '123456789012345', `meta pixel mismatch: ${config.metaPixelId}`);
assert(config.googleAdsId === 'AW-123456789', `google ads id mismatch: ${config.googleAdsId}`);
assert(config.googleAdsSendTo === 'AW-123456789/AbCdEfGh', `google ads send_to mismatch: ${config.googleAdsSendTo}`);
assert(config.naverId === 's_abcdef1234', `naver id mismatch: ${config.naverId}`);
assert(config.kakaoPixelId === '987654321', `kakao id mismatch: ${config.kakaoPixelId}`);

const disabled = trackingConfig({ ...page, integrations: { conversion: { enabled: false } } });
assert(!disabled.enabled && !disabled.gtmId && !disabled.metaPixelId, 'disabled config should not install trackers');

const partial = trackingConfig({
  ...page,
  integrations: {
    conversion: {
      enabled: true,
      dataLayer: false,
      metaPixel: false,
      googleAds: false,
      naver: false,
      kakao: false,
    },
  },
});
assert(partial.enabled, 'partial config should stay enabled');
assert(!partial.dataLayer && partial.ga4Id && partial.googleAdsTagId && !partial.metaPixelId && !partial.googleAdsId && !partial.naverId && !partial.kakaoPixelId, 'disabled channel toggles should suppress conversion-channel ids only');

const looseInput = trackingConfig({
  meta: {
    gtm: '<script>GTM-LOOSE1</script>',
    ga4: '<script async src="https://www.googletagmanager.com/gtag/js?id=G-LOOSE1234"></script>',
    googleAdsTag: '<script async src="https://www.googletagmanager.com/gtag/js?id=AW-555666777"></script>',
    ads: 'send_to=AW-987654321/XYZ_123',
    naver: '_nasa["cnv"] = "s_loose";',
  },
  integrations: { conversion: { enabled: true, googleAds: true, naver: true } },
});
assert(looseInput.gtmId === 'GTM-LOOSE1', 'gtm id should be extracted from pasted code');
assert(looseInput.ga4Id === 'G-LOOSE1234', 'ga4 id should be extracted from pasted code');
assert(looseInput.googleAdsTagId === 'AW-555666777', 'google ads tag id should be extracted from pasted code');
assert(looseInput.googleAdsId === 'AW-987654321', 'google ads id should be extracted from pasted code');
assert(looseInput.googleAdsSendTo === 'AW-987654321/XYZ_123', 'google ads send_to should be extracted from pasted code');
assert(looseInput.naverId === 's_loose', 'naver id should be extracted from pasted code');

function fakeDocument() {
  const nodes = new Map();
  const selectorNodes = new Map();
  return {
    title: '',
    head: {
      appendChild(node) {
        if (node.id) nodes.set(node.id, node);
        if (node.selectorKey) selectorNodes.set(node.selectorKey, node);
      },
    },
    createElement(tag) {
      return {
        tag,
        id: '',
        async: false,
        src: '',
        attrs: {},
        setAttribute(name, value) {
          this.attrs[name] = value;
          if (tag === 'meta' && (name === 'name' || name === 'property')) this.selectorKey = `meta[${name}="${value}"]`;
          if (tag === 'link' && name === 'rel') this.selectorKey = `link[rel="${value}"]`;
        },
        remove() {
          if (this.id) nodes.delete(this.id);
          if (this.selectorKey) selectorNodes.delete(this.selectorKey);
        },
      };
    },
    getElementById(id) {
      return nodes.get(id) || null;
    },
    querySelector(selector) {
      return selectorNodes.get(selector) || null;
    },
    nodes,
    selectorNodes,
  };
}

const headMeta = headMetaConfig(page);
assert(headMeta.title === 'QA 랜딩', 'head title should be parsed');
assert(headMeta.description === 'QA 설명', 'head description should be parsed');
assert(headMeta.googleSiteVerification === 'google-verify-token', 'google console verification should be extracted from pasted meta tag');
assert(headMeta.naverSiteVerification === 'naver-verify-token', 'naver webmaster verification should be extracted from pasted meta tag');

const headDoc = fakeDocument();
const installedHead = installPageHeadMeta(page, headDoc);
assert(installedHead.googleSiteVerification === 'google-verify-token', 'head install should return parsed google verification');
assert(installedHead.naverSiteVerification === 'naver-verify-token', 'head install should return parsed naver verification');
assert(headDoc.title === 'QA 랜딩', 'document title should be updated');
assert(headDoc.querySelector('meta[name="description"]')?.attrs.content === 'QA 설명', 'description meta should be inserted');
assert(headDoc.querySelector('meta[property="og:title"]')?.attrs.content === 'QA 랜딩', 'og title meta should be inserted');
assert(headDoc.querySelector('meta[property="og:image"]')?.attrs.content === 'https://example.com/og.png', 'og image meta should be inserted');
assert(headDoc.querySelector('meta[name="google-site-verification"]')?.attrs.content === 'google-verify-token', 'google verification meta should be inserted');
assert(headDoc.querySelector('meta[name="naver-site-verification"]')?.attrs.content === 'naver-verify-token', 'naver verification meta should be inserted');
assert(headDoc.querySelector('link[rel="icon"]')?.attrs.href === 'data:image/svg+xml,<svg></svg>', 'favicon link should be inserted');

const doc = fakeDocument();
const win = {};
const installed = installConversionTracking(page, win, doc);
assert(installed.gtmId === 'GTM-ABC123', 'install should return tracking config');
assert(Array.isArray(win.dataLayer), 'dataLayer should be initialized');
assert(doc.nodes.has('inlet-gtm-GTM-ABC123'), 'gtm script should be inserted');
assert(doc.nodes.has('inlet-ga4-G-QATEST1234'), 'ga4 script should be inserted');
assert(doc.nodes.has('inlet-meta-pixel'), 'meta pixel script should be inserted');
assert(doc.nodes.has('inlet-google-ads-AW-123456789'), 'google ads script should be inserted');
assert(doc.nodes.has('inlet-naver-wcs'), 'naver script should be inserted');
assert(doc.nodes.has('inlet-kakao-pixel'), 'kakao script should be inserted');
const beforeCount = doc.nodes.size;
installConversionTracking(page, win, doc);
assert(doc.nodes.size === beforeCount, 'tracking scripts should not duplicate');

const adminDoc = fakeDocument();
installConversionTracking({ ...page, integrations: { conversion: { enabled: false } } }, {}, adminDoc);
assert(adminDoc.nodes.size === 0, 'disabled/admin config should not insert scripts');

const noDomConfig = installConversionTracking(page, null, null);
assert(noDomConfig.gtmId === 'GTM-ABC123', 'no-dom install should return parsed config without throwing');

const liveChecks = [
  {
    name: 'GTM preview/debug',
    status: 'skipped-live',
    reason: 'Requires a public preview page and GTM preview account access',
  },
  {
    name: 'Meta Pixel test events',
    status: 'skipped-live',
    reason: 'Requires Meta business account access and a configured pixel',
  },
  {
    name: 'Google Ads conversion ping',
    status: 'skipped-live',
    reason: 'Requires Google Ads account access and a configured conversion label',
  },
  {
    name: 'Naver/Kakao pixel diagnostics',
    status: 'skipped-live',
    reason: 'Requires platform account access and public-page diagnostics',
  },
];

function summarizeStatuses(items = []) {
  return items.reduce((summary, item) => {
    const status = item.status || 'unknown';
    summary[status] = (summary[status] || 0) + 1;
    return summary;
  }, {});
}

console.log(JSON.stringify({ ok: true, checks: 37, liveChecks, liveSummary: summarizeStatuses(liveChecks) }, null, 2));
