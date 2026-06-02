import { deliveryStatusLabel } from './leadIntegrations.js';
import { fmtDate, leadKind, leadPrimaryContact, normalizeLeadItem } from './leadModel.js';

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
  if (Array.isArray(value)) return value.map(flatValue).join(', ');
  if (value && typeof value === 'object') return Object.values(value).map(flatValue).filter(Boolean).join(' ');
  return String(value || '');
}

function answerText(answers = []) {
  return answers
    .map((answer) => {
      const value = flatValue(answer.value);
      return `${answer.label || answer.id || '항목'}: ${value}`;
    })
    .filter(Boolean)
    .join(' / ');
}

function valuesText(values = {}) {
  return Object.entries(values)
    .map(([key, value]) => `${key}: ${flatValue(value)}`)
    .filter(Boolean)
    .join(' / ');
}

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

function cleanFieldLabel(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function dynamicFieldHeader(label = '') {
  return `입력: ${cleanFieldLabel(label)}`;
}

function collectDynamicFieldHeaders(leads = []) {
  const seen = new Set();
  const headers = [];
  for (const lead of leads || []) {
    for (const answer of Array.isArray(lead.answers) ? lead.answers : []) {
      const label = cleanFieldLabel(answer.label || answer.id || '');
      if (!label) continue;
      const header = dynamicFieldHeader(label);
      if (!seen.has(header)) {
        seen.add(header);
        headers.push(header);
      }
    }
    for (const key of Object.keys(lead.values || {})) {
      const label = cleanFieldLabel(key);
      if (!label || BASE_DYNAMIC_VALUE_KEYS.has(label)) continue;
      const header = dynamicFieldHeader(label);
      if (!seen.has(header)) {
        seen.add(header);
        headers.push(header);
      }
    }
  }
  return headers;
}

function dynamicFieldMap(lead = {}) {
  const fields = {};
  for (const [key, value] of Object.entries(lead.values || {})) {
    const label = cleanFieldLabel(key);
    if (!label || BASE_DYNAMIC_VALUE_KEYS.has(label)) continue;
    fields[dynamicFieldHeader(label)] = flatValue(value);
  }
  for (const answer of Array.isArray(lead.answers) ? lead.answers : []) {
    const label = cleanFieldLabel(answer.label || answer.id || '');
    if (!label) continue;
    fields[dynamicFieldHeader(label)] = flatValue(answer.value);
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

function deliveryLogsText(logs = []) {
  return (Array.isArray(logs) ? logs : [])
    .slice(-10)
    .map((log) => [
      log.target,
      log.status,
      log.message,
      log.idempotencyKey ? `idempotency=${log.idempotencyKey}` : '',
      log.at,
    ].filter(Boolean).join(': '))
    .join(' / ');
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
  const headers = [
    '접수ID',
    '접수유형',
    '상태',
    '접수시간',
    '이름',
    '대표연락처',
    '연락처',
    '이메일',
    '주소',
    '문의내용',
    '예약일',
    '예약시간',
    '메모',
    '외부 전송 상태',
    '외부 전송 요약',
    '외부 전송 로그',
    'duplicate',
    'duplicateReason',
    'riskScore',
    'submittedAt',
    '답변 전체',
    '입력값 전체',
    ...dynamicHeaders,
  ];

  const rows = source.map((item) => {
    const dynamicFields = dynamicFieldMap(item);
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
      fieldByLabel(item, [/reservationDate|date/i]),
      fieldByLabel(item, [/reservationTime|time/i]),
      item.memo,
      deliveryStatusLabel(item.delivery?.status),
      item.delivery?.summary || '',
      deliveryLogsText(item.delivery?.logs),
      item.duplicate ? 'yes' : 'no',
      item.duplicateReason || '',
      item.riskScore ?? '',
      fmtDate(item.submittedAt || item.createdAt),
      answerText(item.answers),
      valuesText(item.values),
      ...dynamicHeaders.map((header) => dynamicFields[header] || ''),
    ];
  });

  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
export function downloadLeadsCsv(leads = [], page = {}, options = {}) {
  const csv = `\ufeff${leadsToCsv(leads, options)}`;
  const slug = String(page.slug || 'my-page').replace(/[^\w가-힣-]/g, '-') || 'my-page';
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
