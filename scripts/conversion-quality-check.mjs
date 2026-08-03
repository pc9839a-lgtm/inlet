import { headMetaConfig, installConversionTracking, installPageHeadMeta, trackingConfig } from '../src/lib/conversionTracking.js';
import { conversionEventPayload, sendConversionIntegrations } from '../src/lib/leadIntegrations.js';

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

const consultationPayload = conversionEventPayload({
  id: 'private-lead-raw-id',
  type: '상담 신청',
  phone: '010-1111-2222',
  email: 'private@example.com',
}, page);
assert(consultationPayload.event === 'lead_submit', 'consultation event should use lead_submit');
assert(!Object.prototype.hasOwnProperty.call(consultationPayload, 'lead_id'), 'conversion payload must not expose raw lead id');
assert(!JSON.stringify(consultationPayload).includes('010-1111-2222'), 'conversion payload must not expose phone');
assert(!JSON.stringify(consultationPayload).includes('private@example.com'), 'conversion payload must not expose email');

const eventWindow = {
  dataLayer: [],
  fbq: (...args) => eventWindow.fbqCalls.push(args),
  fbqCalls: [],
  gtag: (...args) => eventWindow.gtagCalls.push(args),
  gtagCalls: [],
  kakaoPixel: () => ({ completeRegistration: () => { eventWindow.kakaoComplete = (eventWindow.kakaoComplete || 0) + 1; } }),
  kakaoPixelId: '987654321',
  wcs: true,
  wcs_add: {},
  wcs_do: () => { eventWindow.naverDone = (eventWindow.naverDone || 0) + 1; },
};

const consultationLead = {
  id: 'lead-conversion-private-1',
  type: '상담 신청',
  name: '개인정보 테스트',
  phone: '010-3333-4444',
  email: 'secret@example.com',
};
const consultationResult = sendConversionIntegrations(consultationLead, page, eventWindow);
assert(consultationResult.sent, 'consultation conversion should be sent');
assert(consultationResult.eventName === 'lead_submit', 'consultation result event mismatch');
assert(eventWindow.dataLayer.some((item) => item.event === 'lead_submit'), 'dataLayer lead_submit event should be pushed');
assert(eventWindow.fbqCalls.some((call) => call[0] === 'track' && call[1] === 'Lead'), 'Meta Lead event should be sent');
assert(eventWindow.gtagCalls.some((call) => call[0] === 'event' && call[1] === 'lead_submit'), 'GA4 direct lead_submit event should be sent');
assert(eventWindow.gtagCalls.some((call) => call[0] === 'event' && call[1] === 'conversion'), 'Google Ads conversion event should be sent');
const consultationCapture = JSON.stringify({
  dataLayer: eventWindow.dataLayer,
  fbqCalls: eventWindow.fbqCalls,
  gtagCalls: eventWindow.gtagCalls,
});
for (const secret of ['lead-conversion-private-1', '개인정보 테스트', '010-3333-4444', 'secret@example.com']) {
  assert(!consultationCapture.includes(secret), `conversion capture must not expose ${secret}`);
}

const callCountBeforeDuplicate = eventWindow.fbqCalls.length + eventWindow.gtagCalls.length + eventWindow.dataLayer.length;
const duplicateResult = sendConversionIntegrations(consultationLead, page, eventWindow);
const callCountAfterDuplicate = eventWindow.fbqCalls.length + eventWindow.gtagCalls.length + eventWindow.dataLayer.length;
assert(duplicateResult.duplicate === true, 'same lead conversion should be deduplicated');
assert(callCountAfterDuplicate === callCountBeforeDuplicate, 'duplicate conversion must not emit additional calls');

const reservationLead = { id: 'reservation-private-1', type: '방문 예약', phone: '010-5555-6666' };
const reservationResult = sendConversionIntegrations(reservationLead, page, eventWindow);
assert(reservationResult.eventName === 'reservation_submit', 'reservation should use reservation_submit');
assert(eventWindow.dataLayer.some((item) => item.event === 'reservation_submit'), 'reservation dataLayer event should be pushed');
assert(eventWindow.fbqCalls.some((call) => call[0] === 'track' && call[1] === 'Schedule'), 'Meta Schedule event should be sent');
assert(eventWindow.gtagCalls.some((call) => call[0] === 'event' && call[1] === 'reservation_submit'), 'GA4 reservation_submit event should be sent');
assert(!JSON.stringify(eventWindow).includes('reservation-private-1'), 'reservation raw id must not be exposed');

const noWindowResult = sendConversionIntegrations({ id: 'no-window', type: '상담 신청' }, page, null);
assert(noWindowResult.sent === false && noWindowResult.reason === 'browser-unavailable', 'server-side conversion dispatch must fail safely');

const disabledResult = sendConversionIntegrations({ id: 'disabled', type: '상담 신청' }, { ...page, integrations: { conversion: { enabled: false } } }, eventWindow);
assert(disabledResult.sent === false && disabledResult.reason === 'disabled', 'disabled conversion must not dispatch');

const liveChecks = [
  {
    name: 'Production conversion fixture',
    status: 'skipped-live',
    displayStatus: '설정 필요',
    reason: 'Requires a public qa-conversion- page and the manual production verification workflow',
  },
  {
    name: 'External platform receipt',
    status: 'skipped-live',
    displayStatus: '설정 필요',
    reason: 'Requires operator access to GTM, GA4, Meta, Google Ads, Naver, or Kakao diagnostics',
  },
];

function summarizeStatuses(items = []) {
  return items.reduce((summary, item) => {
    const status = item.status || 'unknown';
    summary[status] = (summary[status] || 0) + 1;
    return summary;
  }, {});
}

console.log(JSON.stringify({
  ok: true,
  checks: 49,
  privacySafePayload: true,
  ga4DirectEvents: true,
  duplicateSuppression: true,
  reservationSemantics: true,
  liveChecks,
  liveSummary: summarizeStatuses(liveChecks),
}, null, 2));
