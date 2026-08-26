export const MAX_BODY_BYTES = 262144;
export const MAX_METADATA_BYTES = 65536;

export async function readJsonLimited(request, maxBytes = MAX_BODY_BYTES) {
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw leadError('Request body is too large.', 413, 'CALLTAG_LEAD_BODY_TOO_LARGE');
  }

  const reader = request.body?.getReader?.();
  if (!reader) {
    const bodyText = await request.text();
    if (new TextEncoder().encode(bodyText).length > maxBytes) {
      throw leadError('Request body is too large.', 413, 'CALLTAG_LEAD_BODY_TOO_LARGE');
    }
    return parseJson(bodyText);
  }

  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch {}
      throw leadError('Request body is too large.', 413, 'CALLTAG_LEAD_BODY_TOO_LARGE');
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return parseJson(new TextDecoder().decode(merged));
}

export function normalizeCanonicalLead(input = {}) {
  const sourceInput = objectValue(input?.source);
  const customerInput = objectValue(input?.customer);
  const inquiryInput = objectValue(input?.inquiry);
  const phoneRaw = text(customerInput.phone, 40);
  const phone = normalizePhone(phoneRaw);
  if (phone.length < 8 || phone.length > 20) {
    throw leadError('A valid customer phone number is required.', 400, 'CALLTAG_LEAD_PHONE_REQUIRED');
  }

  const email = text(customerInput.email, 240).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw leadError('Customer email is invalid.', 400, 'CALLTAG_LEAD_EMAIL_INVALID');
  }

  const sourceType = normalizeCode(sourceInput.type || 'custom_api', 80) || 'custom_api';
  const fields = Array.isArray(inquiryInput.fields)
    ? inquiryInput.fields.slice(0, 100).map((field, index) => ({
        key: text(field?.key || `field_${index + 1}`, 120),
        label: text(field?.label || field?.key || `항목 ${index + 1}`, 160),
        value: safeFieldValue(field?.value),
        order: Number.isFinite(Number(field?.order)) ? Number(field.order) : index + 1,
      }))
    : [];

  return {
    eventId: text(input?.event_id || input?.eventId, 240),
    externalId: text(input?.external_id || input?.externalId, 240),
    source: {
      ...sanitizeObject(sourceInput, 30),
      type: sourceType,
      name: text(sourceInput.name || sourceType, 160),
      provider: normalizeCode(sourceInput.provider || sourceType, 80),
    },
    customer: {
      name: text(customerInput.name, 120),
      phone,
      phoneRaw,
      email,
    },
    inquiry: {
      content: text(inquiryInput.content, 5000),
      fields,
    },
    submittedAt: normalizeTimestamp(input?.submitted_at ?? input?.submittedAt),
    metadata: sanitizeObject(objectValue(input?.metadata), 80),
  };
}

export function normalizePhone(value = '') {
  let digits = String(value || '').replace(/\D/g, '').slice(0, 24);
  if (digits.startsWith('0082')) digits = digits.slice(2);
  if (digits.startsWith('82') && digits.length >= 10 && digits.length <= 13) {
    digits = `0${digits.slice(2)}`;
  }
  return digits.slice(0, 20);
}

export async function canonicalDedupeKey(lead, idempotencyKey = '', connectionId = '') {
  const scope = text(connectionId, 160) || `source:${lead.source.provider || lead.source.type}`;
  if (lead.eventId) return `event:${scope}:${lead.eventId}`;
  if (lead.externalId) return `external:${scope}:${lead.externalId}`;
  if (idempotencyKey) return `idempotency:${scope}:${text(idempotencyKey, 240)}`;
  const fingerprint = [scope, lead.source.provider, lead.source.type, lead.customer.phone, lead.submittedAt].join('|');
  return `fingerprint:${scope}:${await sha256(fingerprint)}`;
}

export function limitedJson(value, maxBytes = MAX_METADATA_BYTES, code = 'CALLTAG_LEAD_METADATA_TOO_LARGE') {
  let json = '';
  try { json = JSON.stringify(value ?? {}); }
  catch { throw leadError('Lead data could not be encoded.', 400, 'CALLTAG_LEAD_JSON_ENCODE_FAILED'); }
  if (new TextEncoder().encode(json).length > maxBytes) {
    throw leadError('Lead metadata is too large.', 413, code);
  }
  return json;
}

export function parseStoredJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); }
  catch { return fallback; }
}

export function safeFieldValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.slice(0, 5000);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map(safeFieldValue);
  if (typeof value === 'object') return sanitizeObject(value, 50);
  return text(value, 5000);
}

export function safeOwner(value = '') {
  const ownerId = text(value, 160);
  if (!ownerId) throw leadError('Owner scope could not be resolved.', 401, 'CALLTAG_LEAD_OWNER_REQUIRED');
  return ownerId;
}

export function randomToken(byteLength = 24) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function sha256(value = '') {
  const bytes = new TextEncoder().encode(String(value));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

export function leadError(message, status = 400, code = 'CALLTAG_LEAD_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = { code };
  return error;
}

function parseJson(value = '') {
  if (!String(value || '').trim()) return {};
  try { return JSON.parse(value); }
  catch { throw leadError('Request JSON is invalid.', 400, 'CALLTAG_LEAD_JSON_INVALID'); }
}

function normalizeCode(value = '', max = 80) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, max);
}

function normalizeTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 100000000000 ? Math.round(value * 1000) : Math.round(value);
  }
  if (value) {
    const parsed = Date.parse(String(value));
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function sanitizeObject(value, maxKeys = 50) {
  const result = {};
  for (const [key, item] of Object.entries(objectValue(value)).slice(0, maxKeys)) {
    const safeKey = text(key, 120);
    if (!safeKey) continue;
    result[safeKey] = safeFieldValue(item);
  }
  return result;
}
