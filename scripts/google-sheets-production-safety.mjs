import { createHash } from 'node:crypto';

export const QA_MARKER_PREFIX = 'qa-sheets-';
export const QA_SHEET_HEADERS = Object.freeze([
  '접수일시',
  '이름',
  '연락처',
  'qaMarker',
  'source',
]);

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY = /(secret|token|session|authorization|credential|password|client|spreadsheet|project|owner|email|phone)/i;

export function isQaName(value = '') {
  return /^qa(?:[- _]|$)/i.test(String(value || '').trim());
}

export function exactMarkerRowIndices(rows = [], marker = '') {
  const expected = String(marker || '');
  if (!expected) return [];
  const indices = [];
  rows.forEach((row, index) => {
    if (Array.isArray(row) && row.some((cell) => String(cell ?? '') === expected)) indices.push(index);
  });
  return indices;
}

export function qaResidueRowIndices(rows = []) {
  const indices = [];
  rows.forEach((row, index) => {
    if (Array.isArray(row) && row.some((cell) => String(cell ?? '').startsWith(QA_MARKER_PREFIX))) indices.push(index);
  });
  return indices;
}

export function assertDedicatedQaSheetRows(rows = []) {
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error('dedicated QA worksheet must contain exactly one header row and no data rows');
  }
  const header = Array.isArray(rows[0]) ? rows[0].map((cell) => String(cell ?? '')) : [];
  if (JSON.stringify(header) !== JSON.stringify(QA_SHEET_HEADERS)) {
    throw new Error(`dedicated QA worksheet header must exactly match ${QA_SHEET_HEADERS.join(', ')}`);
  }
  return true;
}

export function rowsDigest(rows = []) {
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

export function sanitizeGoogleSheetsEvidence(value, secrets = [], key = '') {
  const secretValues = secrets
    .map((item) => String(item ?? ''))
    .filter((item) => item.length >= 4);

  if (SENSITIVE_KEY.test(String(key || ''))) return REDACTED;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeGoogleSheetsEvidence(item, secretValues));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [
      childKey,
      sanitizeGoogleSheetsEvidence(childValue, secretValues, childKey),
    ]));
  }
  if (typeof value === 'string') {
    let output = value;
    for (const secret of secretValues) output = output.split(secret).join(REDACTED);
    return output.slice(0, 500);
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) return value;
  return String(value).slice(0, 500);
}
