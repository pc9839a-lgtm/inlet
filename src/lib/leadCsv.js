import { fmtDate, leadKind, leadPrimaryContact, normalizeLeadItem } from './leadModel.js';

const BASE_DYNAMIC_VALUE_KEYS = new Set([
  'name',
  'phone',
  'email',
  'address',
  'message',
  'memo',
  'clientId',
  'phoneNormalized',
  'emailNormalized',
  'sourceUrl',
  'referrer',
  'channel',
  'sourceLabel',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  '이름',
  '성함',
  '연락처',
  '전화번호',
  '휴대폰번호',
  '핸드폰번호',
  '이메일',
  '메일',
  '주소',
  '문의 내용',
  '문의내용',
  '상담내용',
  '메시지',
]);

function csvCell(value) {
  const text = neutralizeCsvFormula(value == null ? '' : String(value));
  return `"${text.replace(/"/g, '""')}"`;
}

function neutralizeCsvFormula(text) {
  const value = String(text || '').replace(/\0/g, '');
  const visibleStart = value.replace(/^[\s\uFEFF]+/, '');
  return /^[=+\-@]/.test(visibleStart) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
}

function flatValue(value) {
  if (Array.isArray(value)) return value.map(flatValue).filter(Boolean).join(', ');
  if (value && typeof value === 'object') return Object.values(value).map(flatValue).filter(Boolean).join(' ');
  return String(value || '');
}

function cleanFieldLabel(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function uniqueHeader(base, used) {
  const safeBase = base || '입력값';
  let header = safeBase;
  let index = 2;
  while (used.has(header)) {
    header = `${safeBase} ${index}`;
    index += 1;
  }
  used.add(header);
  return header;
}

function collectDynamicFieldHeaders(leads = []) {
  const keyToHeader = new Map();
  const usedHeaders = new Set();
  const add = (rawKey, rawLabel) => {
    const key = cleanFieldLabel(rawKey);
    const label = cleanFieldLabel(rawLabel || rawKey);
    if (!key || BASE_DYNAMIC_VALUE_KEYS.has(key)) return;
    if (keyToHeader.has(key)) return;
    keyToHeader.set(key, uniqueHeader(label, usedHeaders));
  };

  for (const lead of leads || []) {
    for (const answer of Array.isArray(lead.answers) ? lead.answers : []) {
      add(answer.id || answer.label, answer.label || answer.id);
    }
    for (const key of Object.keys(lead.values || {})) {
      add(key, key);
    }
  }
  return keyToHeader;
}

function dynamicFieldMap(lead = {}, dynamicHeaders = new Map()) {
  const fields = {};
  const set = (rawKey, value) => {
    const key = cleanFieldLabel(rawKey);
    const header = dynamicHeaders.get(key);
    if (header) fields[header] = flatValue(value);
  };

  for (const [key, value] of Object.entries(lead.values || {})) {
    set(key, value);
  }
  for (const answer of Array.isArray(lead.answers) ? lead.answers : []) {
    set(answer.id || answer.label, answer.value);
  }
  return fields;
}

function fieldByLabel(lead = {}, patterns = []) {
  const values = lead.values || {};
  for (const [key, value] of Object.entries(values)) {
    if (patterns.some((pattern) => pattern.test(String(key)))) return flatValue(value);
  }
  for (const answer of Array.isArray(lead.answers) ? lead.answers : []) {
    if (patterns.some((pattern) => pattern.test(String(answer.label || answer.id || '')))) {
      return flatValue(answer.value);
    }
  }
  return '';
}

function inDateRange(lead, from = '', to = '') {
  const createdAt = new Date(lead.createdAt || lead.savedAt || 0).getTime();
  if (!Number.isFinite(createdAt)) return false;
  if (from && createdAt < new Date(`${from}T00:00:00`).getTime()) return false;
  if (to && createdAt > new Date(`${to}T23:59:59.999`).getTime()) return false;
  return true;
}

export function filterLeadsForCsv(leads = [], filters = {}) {
  return (leads || [])
    .map(normalizeLeadItem)
    .filter((lead) => {
      if (filters.status && filters.status !== 'all' && lead.status !== filters.status) return false;
      if (filters.kind && filters.kind !== 'all' && leadKind(lead) !== filters.kind) return false;
      if (filters.deliveryStatus === 'needs-attention' && !['failed', 'partial'].includes(lead.delivery?.status)) return false;
      if (filters.deliveryStatus && !['all', 'needs-attention'].includes(filters.deliveryStatus) && lead.delivery?.status !== filters.deliveryStatus) return false;
      if ((filters.dateFrom || filters.dateTo) && !inDateRange(lead, filters.dateFrom, filters.dateTo)) return false;
      return true;
    });
}

export function leadsToCsv(leads = [], options = {}) {
  const source = options.filters ? filterLeadsForCsv(leads, options.filters) : (leads || []).map(normalizeLeadItem);
  const dynamicHeaders = collectDynamicFieldHeaders(source);
  const dynamicHeaderLabels = [...dynamicHeaders.values()];
  const headers = [
    '접수 ID',
    '접수 유형',
    '상태',
    '접수일시',
    '이름',
    '대표 연락처',
    '연락처',
    '이메일',
    '주소',
    '문의 내용',
    '예약일',
    '예약시간',
    '메모',
    '중복 여부',
    '중복 사유',
    '위험 점수',
    '제출일시',
    '페이지명',
    '페이지 URL',
    '유입 URL',
    'UTM Source',
    'UTM Medium',
    'UTM Campaign',
    ...dynamicHeaderLabels,
  ];

  const rows = source.map((item) => {
    const dynamicFields = dynamicFieldMap(item, dynamicHeaders);
    const sourceInfo = item.source || {};
    const page = item.page || item.deliveryPage || {};
    return [
      item.id,
      item.type,
      item.status,
      fmtDate(item.createdAt),
      item.name,
      leadPrimaryContact(item),
      item.phone,
      item.email,
      item.address,
      item.message,
      fieldByLabel(item, [/reservationDate|예약일|예약날짜|방문일|date/i]),
      fieldByLabel(item, [/reservationTime|예약시간|방문시간|time/i]),
      item.memo,
      item.duplicate ? '예' : '아니오',
      item.duplicateReason || '',
      item.riskScore ?? '',
      fmtDate(item.submittedAt || item.createdAt),
      page.title || item.pageTitle || '',
      page.url || item.pageUrl || '',
      sourceInfo.url || sourceInfo.pageUrl || item.sourceUrl || '',
      sourceInfo.utmSource || item.utmSource || '',
      sourceInfo.utmMedium || item.utmMedium || '',
      sourceInfo.utmCampaign || item.utmCampaign || '',
      ...dynamicHeaderLabels.map((header) => dynamicFields[header] || ''),
    ];
  });

  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function downloadLeadsCsv(leads = [], page = {}, options = {}) {
  const csv = `\ufeff${leadsToCsv(leads, options)}`;
  const slug = String(page.slug || 'my-page').replace(/[^\w가-힣-]/g, '-') || 'my-page';
  const date = String(options.filters?.month || '').match(/^\d{4}-\d{2}$/)
    ? options.filters.month
    : new Date().toISOString().slice(0, 10);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}-leads-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
