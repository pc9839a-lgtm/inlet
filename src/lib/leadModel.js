import { uid } from './pageModel.js';

export const LEAD_STATUS = ['신규', '확인중', '연락완료', '예약완료', '보류', '종료'];

const CONSULT_TYPES = new Set(['상담신청', '상담', 'lead', 'consult']);
const RESERVATION_TYPES = new Set(['방문예약', '예약', 'reservation', 'booking']);

function text(value) {
  return String(value || '').trim();
}

function normalizedText(value) {
  return text(value).toLowerCase().replace(/\s+/g, '');
}

export function normalizeLeadStatus(status) {
  const value = text(status);
  if (LEAD_STATUS.includes(value)) return value;
  const lower = normalizedText(value);
  if (['new', 'fresh'].includes(lower)) return '신규';
  if (['pending', 'hold', 'checking'].includes(lower)) return '확인중';
  if (['done', 'contacted'].includes(lower)) return '연락완료';
  if (['reserved', 'booked'].includes(lower)) return '예약완료';
  if (['closed', 'end'].includes(lower)) return '종료';
  return '신규';
}

export function isReservationLead(lead = {}) {
  const rawType = text(lead.type);
  const type = normalizedText(lead.type);
  if (rawType.includes('방문') || rawType.includes('예약')) return true;
  if (RESERVATION_TYPES.has(type)) return true;
  if (CONSULT_TYPES.has(type)) return false;

  const formTitle = normalizedText(lead.sourceBlockTitle);
  if (formTitle.includes('예약') || formTitle.includes('reservation') || formTitle.includes('booking')) return true;

  const values = lead.values || {};
  const answers = Array.isArray(lead.answers) ? lead.answers : [];
  const joinedKeys = [
    ...Object.keys(values),
    ...answers.map((answer) => answer.label),
    lead.message,
  ].map(normalizedText).join(' ');

  return joinedKeys.includes('예약') || joinedKeys.includes('방문') || joinedKeys.includes('reserve');
}

export function normalizeLeadType(lead = {}) {
  return isReservationLead(lead) ? '방문예약' : '상담신청';
}

export function normalizeLeadItem(lead = {}) {
  const delivery = lead.delivery || {};
  return {
    ...lead,
    id: lead.id || uid(),
    type: normalizeLeadType(lead),
    status: normalizeLeadStatus(lead.status),
    memo: lead.memo || '',
    createdAt: lead.createdAt || new Date().toISOString(),
    name: lead.name || '',
    phone: lead.phone || '',
    email: lead.email || '',
    address: lead.address || '',
    message: lead.message || '',
    sourceUrl: lead.sourceUrl || lead.pageUrl || lead.url || '',
    referrer: lead.referrer || '',
    channel: lead.channel || '',
    sourceLabel: lead.sourceLabel || '',
    utmSource: lead.utmSource || lead.utm_source || '',
    utmMedium: lead.utmMedium || lead.utm_medium || '',
    utmCampaign: lead.utmCampaign || lead.utm_campaign || '',
    answers: Array.isArray(lead.answers) ? lead.answers : [],
    values: lead.values || {},
    history: Array.isArray(lead.history) ? lead.history : [],
    delivery: {
      status: delivery.status || lead.deliveryStatus || 'none',
      summary: delivery.summary || '알림 없음',
      logs: Array.isArray(delivery.logs) ? delivery.logs : [],
    },
  };
}

export function leadKind(lead) {
  return isReservationLead(lead) ? 'reservation' : 'consult';
}

export function leadKindLabel(lead) {
  return leadKind(lead) === 'reservation' ? '예약' : '상담';
}

export function leadPrimaryContact(lead) {
  return lead.phone || lead.email || lead.address || '연락처 없음';
}

export function cleanTel(value = '') {
  return String(value).replace(/[^\d+]/g, '');
}

function searchableValue(value) {
  if (Array.isArray(value)) return value.map(searchableValue).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(searchableValue).join(' ');
  return String(value ?? '');
}

export function leadSearchText(lead) {
  return [
    lead.type,
    lead.status,
    lead.name,
    lead.phone,
    lead.email,
    lead.address,
    lead.message,
    lead.memo,
    lead.sourceUrl,
    lead.referrer,
    lead.sourceLabel,
    lead.channel,
    lead.utmSource,
    lead.utmCampaign,
    ...Object.values(lead.values || {}).map(searchableValue),
    ...(lead.answers || []).map((a) => `${a.label || ''} ${searchableValue(a.value)}`),
  ].join(' ').toLowerCase();
}

export function statusClass(status = '') {
  const normalized = normalizeLeadStatus(status);
  if (['연락완료', '예약완료', '종료'].includes(normalized)) return 'done';
  if (['확인중', '보류'].includes(normalized)) return 'hold';
  return 'new';
}

export function fmtDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR');
}
