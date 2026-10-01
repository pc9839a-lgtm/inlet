import { normalizeIntegrations } from '../../lib/pageModel.js';
import { isTestTraffic } from '../../lib/trafficAttribution.js';

const INQUIRY_TYPES = new Set(['form', 'reservation']);

export function visibleInquiryBlocks(page = {}) {
  return (Array.isArray(page?.blocks) ? page.blocks : [])
    .filter((block) => block?.visible !== false && INQUIRY_TYPES.has(block?.type));
}

function sheetsConnected(sheets = {}, google = {}) {
  if (google?.enabled && google?.connected) return true;
  if (!sheets?.enabled) return false;
  if (sheets.mode === 'webhook') return !!(sheets.webhookUrl || sheets.url);
  return sheets.status === 'connected' || !!(sheets.connectedEmail && sheets.spreadsheetId);
}

export function activeLeadDestinations(page = {}) {
  const integrations = normalizeIntegrations(page?.integrations || {});
  const destinations = ['접수함'];
  if (sheetsConnected(integrations.sheets, integrations.google)) destinations.push('Google Sheets');
  if (integrations.email?.enabled && integrations.email?.to) destinations.push('이메일');
  if (integrations.webhook?.enabled && integrations.webhook?.url) destinations.push('Webhook');
  if (integrations.automation?.enabled && integrations.automation?.url) destinations.push('자동화');
  return [...new Set(destinations)];
}

export function configuredTrackingChannels(page = {}) {
  const meta = page?.meta || {};
  const conversion = normalizeIntegrations(page?.integrations || {}).conversion || {};
  if (conversion.enabled === false) return [];

  const channels = [];
  if (String(meta.gtm || '').trim()) channels.push('GTM');
  if (String(meta.ga4 || meta.analytics || '').trim()) channels.push('GA4');
  if (String(meta.googleAdsTag || meta.ads || '').trim()) channels.push('Google Ads');
  if (conversion.metaPixel && String(meta.pixel || '').trim()) channels.push('Meta');
  if (conversion.naver && String(meta.naver || '').trim()) channels.push('Naver');
  if (conversion.kakao && String(meta.kakao || meta.kakaoPixel || '').trim()) channels.push('Kakao');
  return [...new Set(channels)];
}

export function buildEditorTestInquiryUrl(previewUrl = '', page = {}) {
  const raw = String(previewUrl || '').trim();
  if (!raw) return '';
  const fallbackOrigin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://pagero.kr';

  let url;
  try {
    url = new URL(raw, fallbackOrigin);
  } catch {
    return '';
  }

  url.searchParams.set('pagero_test', '1');
  url.searchParams.set('utm_source', 'pagero_test');
  url.searchParams.set('utm_medium', 'editor');
  url.searchParams.set('utm_campaign', 'conversion_test');

  const firstInquiry = visibleInquiryBlocks(page)[0];
  if (firstInquiry?.id) url.hash = `block-${firstInquiry.id}`;
  return url.toString();
}

export function conversionCockpitModel({ page = {}, leads = [], previewUrl = '' } = {}) {
  const inquiries = visibleInquiryBlocks(page);
  const destinations = activeLeadDestinations(page);
  const tracking = configuredTrackingChannels(page);
  const pageSlug = String(page?.slug || '');
  const relevantLeads = (Array.isArray(leads) ? leads : []).filter((lead) => {
    const leadSlug = String(lead?.pageSlug || lead?.page?.slug || lead?.project?.slug || '');
    return !pageSlug || !leadSlug || leadSlug === pageSlug;
  });
  const testLeads = relevantLeads.filter(isTestTraffic);
  const liveLeads = relevantLeads.filter((lead) => !isTestTraffic(lead));

  return {
    inquiryCount: inquiries.length,
    destinationCount: destinations.length,
    destinations,
    trackingCount: tracking.length,
    tracking,
    liveLeadCount: liveLeads.length,
    testLeadCount: testLeads.length,
    testUrl: buildEditorTestInquiryUrl(previewUrl, page),
    canTest: inquiries.length > 0 && !!previewUrl,
  };
}
