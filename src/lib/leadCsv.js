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
  let header = base || '\uC785\uB825\uAC12';
  let index = 2;
  while (used.has(header)) {
    header = `${base} ${index}`;
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
    '\uC811\uC218 ID',
    '\uC811\uC218 \uC720\uD615',
    '\uC0C1\uD0DC',
    '\uC811\uC218\uC77C\uC2DC',
    '\uC774\uB984',
    '\uB300\uD45C \uC5F0\uB77D\uCC98',
    '\uC5F0\uB77D\uCC98',
    '\uC774\uBA54\uC77C',
    '\uC8FC\uC18C',
    '\uBB38\uC758 \uB0B4\uC6A9',
    '\uC608\uC57D\uC77C',
    '\uC608\uC57D\uC2DC\uAC04',
    '\uBA54\uBAA8',
    '\uC911\uBCF5 \uC5EC\uBD80',
    '\uC911\uBCF5 \uC0AC\uC720',
    '\uC704\uD5D8 \uC810\uC218',
    '\uC81C\uCD9C\uC77C\uC2DC',
    '\uD398\uC774\uC9C0\uBA85',
    '\uD398\uC774\uC9C0 URL',
    '\uC720\uC785 URL',
    'UTM Source',
    'UTM Medium',
    'UTM Campaign',
    ...dynamicHeaderLabels,
  ];

  const rows = source.map((item) => {
    const dynamicFields = dynamicFieldMap(item, dynamicHeaders);
    const source = item.source || {};
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
      fieldByLabel(item, [/reservationDate|\uC608\uC57D\uC77C|date/i]),
      fieldByLabel(item, [/reservationTime|\uC608\uC57D\uC2DC\uAC04|time/i]),
      item.memo,
      item.duplicate ? '\uC608' : '\uC544\uB2C8\uC624',
      item.duplicateReason || '',
      item.riskScore ?? '',
      fmtDate(item.submittedAt || item.createdAt),
      page.title || item.pageTitle || '',
      page.url || item.pageUrl || '',
      source.url || source.pageUrl || item.sourceUrl || '',
      source.utmSource || item.utmSource || '',
      source.utmMedium || item.utmMedium || '',
      source.utmCampaign || item.utmCampaign || '',
      ...dynamicHeaderLabels.map((header) => dynamicFields[header] || ''),
    ];
  });

  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function downloadLeadsCsv(leads = [], page = {}, options = {}) {
  const csv = `\ufeff${leadsToCsv(leads, options)}`;
  const slug = String(page.slug || 'my-page').replace(/[^\w\uAC00-\uD7A3-]/g, '-') || 'my-page';
  const date = new Date().toISOString().slice(0, 10);
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
