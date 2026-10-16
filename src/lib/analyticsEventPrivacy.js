import { normalizeUtmValue, trafficAttributionFromUrl } from './trafficAttribution.js';

// Analytics-only, schema-first: an event is never a second storage location for leads.
// The event and D1 adapter must not serialize arbitrary client keys or raw URLs.
const LABELS = new Set(['home', 'call', 'consult', 'reservation', 'booking', 'form', 'cta', 'hero', 'button', 'submit', 'contact', 'success', 'other']);
const DEVICE_TYPES = new Set(['desktop', 'mobile', 'tablet', 'unknown']);

function analyticsToken(value, max = 80) {
  const text = String(value || '').trim().toLowerCase();
  if (!text || text.includes('@') || /\d{8,}/.test(text)) return '';
  return /^[a-z0-9_.-]+$/.test(text) ? text.slice(0, max) : '';
}

function opaqueId(value, max = 120) {
  const text = String(value || '').trim();
  if (text.length > max || !/^[a-zA-Z0-9_-]+$/.test(text) || /\d{9,}/.test(text)) return '';
  return text;
}

function timeStamp(value) {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(text)) return new Date().toISOString();
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

export function sanitizeAnalyticsEvent(input = {}) {
  const event = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const urlTraffic = trafficAttributionFromUrl(event.sourceUrl || event.source_url || event.url || '');
  const utmSource = analyticsToken(event.utmSource || event.utm_source || urlTraffic.utmSource);
  const utmMedium = analyticsToken(event.utmMedium || event.utm_medium || urlTraffic.utmMedium);
  const utmCampaign = analyticsToken(event.utmCampaign || event.utm_campaign || urlTraffic.utmCampaign);
  const declaredChannel = analyticsToken(event.channel || event.sourceChannel || (typeof event.source === 'string' ? event.source : ''));
  const device = analyticsToken(event.device || event.deviceType);
  const label = analyticsToken(event.label, 48);
  const eventType = analyticsToken(event.eventType || event.type, 60);
  const id = opaqueId(event.id);
  const visitorId = opaqueId(event.visitorId || event.visitor_id, 96);
  const sessionId = opaqueId(event.sessionId || event.session_id, 96);
  const dedupeKey = opaqueId(event.dedupeKey || event.dedupe_key, 120);
  const pageId = opaqueId(event.pageId, 120);
  const pageSlug = analyticsToken(event.pageSlug, 120);
  const createdMonth = /^\d{4}-\d{2}$/.test(String(event.createdMonth || '')) ? String(event.createdMonth) : '';
  return {
    ...(id ? { id } : {}),
    type: eventType || 'unknown',
    ...(LABELS.has(label) ? { label } : {}),
    ...(visitorId ? { visitorId } : {}),
    ...(sessionId ? { sessionId } : {}),
    ...(dedupeKey ? { dedupeKey } : {}),
    ...(pageId ? { pageId } : {}),
    ...(pageSlug ? { pageSlug } : {}),
    channel: utmSource || declaredChannel || 'direct',
    utmSource,
    utmMedium,
    utmCampaign,
    device: DEVICE_TYPES.has(device) ? device : 'unknown',
    isTest: event.isTest === true || urlTraffic.isTest,
    createdAt: timeStamp(event.createdAt || event.created_at),
    ...(createdMonth ? { createdMonth } : {}),
  };
}
