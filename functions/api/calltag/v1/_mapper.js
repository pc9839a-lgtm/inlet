import { leadError, normalizePhone, safeFieldValue, text } from './_utils.js';

const ROLE_ALIASES = {
  name: ['name', 'customername', 'fullname', 'applicantname', 'username', '성함', '이름', '고객명', '신청자', '신청자명'],
  phone: ['phone', 'mobile', 'tel', 'telephone', 'phonenumber', 'mobilenumber', 'contactphone', 'contactnumber', '연락처', '전화번호', '휴대폰', '휴대전화', '핸드폰'],
  email: ['email', 'emailaddress', 'mail', '이메일', '메일'],
  content: ['message', 'inquiry', 'inquirycontent', 'memo', 'note', 'request', 'question', 'content', 'description', '상담내용', '문의내용', '문의', '내용', '메모'],
  externalId: ['leadid', 'submissionid', 'responseid', 'entryid', 'eventid', 'requestid', 'externalid', '접수번호', '문의번호'],
  submittedAt: ['submittedat', 'createdat', 'createdtime', 'timestamp', 'submittime', 'receivedat', 'date', 'datetime', '접수일시', '신청일시', '등록일시'],
};

const ROLE_THRESHOLDS = {
  name: 115,
  phone: 120,
  email: 120,
  content: 105,
  externalId: 115,
  submittedAt: 110,
};

export function flattenWebhookPayload(payload, options = {}) {
  const maxDepth = Math.max(1, Math.min(10, Number(options.maxDepth || 6)));
  const maxFields = Math.max(10, Math.min(500, Number(options.maxFields || 220)));
  const out = [];

  function walk(value, segments, depth) {
    if (out.length >= maxFields || depth > maxDepth) return;
    if (value == null || typeof value !== 'object') {
      out.push({
        pointer: pointerFromSegments(segments),
        leaf: String(segments[segments.length - 1] ?? ''),
        value: safeFieldValue(value),
      });
      return;
    }

    if (Array.isArray(value)) {
      if (!value.length) {
        out.push({ pointer: pointerFromSegments(segments), leaf: String(segments[segments.length - 1] ?? ''), value: [] });
        return;
      }
      const primitiveOnly = value.every((item) => item == null || ['string', 'number', 'boolean'].includes(typeof item));
      if (primitiveOnly) {
        out.push({ pointer: pointerFromSegments(segments), leaf: String(segments[segments.length - 1] ?? ''), value: safeFieldValue(value) });
      }
      for (let index = 0; index < Math.min(value.length, 10); index++) {
        walk(value[index], [...segments, String(index)], depth + 1);
        if (out.length >= maxFields) break;
      }
      return;
    }

    const entries = Object.entries(value).slice(0, 120);
    if (!entries.length && segments.length) {
      out.push({ pointer: pointerFromSegments(segments), leaf: String(segments[segments.length - 1] ?? ''), value: {} });
      return;
    }
    for (const [key, item] of entries) {
      walk(item, [...segments, key], depth + 1);
      if (out.length >= maxFields) break;
    }
  }

  walk(payload, [], 0);
  return out.filter((item) => item.pointer && item.pointer !== '/');
}

export function suggestWebhookMapping(payload) {
  const fields = flattenWebhookPayload(payload);
  const suggestions = {};
  for (const role of Object.keys(ROLE_ALIASES)) {
    const ranked = fields
      .map((field) => ({ ...field, score: scoreFieldForRole(field, role) }))
      .filter((field) => field.score > 0)
      .sort((a, b) => b.score - a.score || a.pointer.localeCompare(b.pointer))
      .slice(0, 5);
    const best = ranked[0] || null;
    suggestions[role] = {
      pointer: best?.pointer || '',
      score: Number(best?.score || 0),
      confidence: confidence(Number(best?.score || 0)),
      preview: previewValue(best?.value),
      alternatives: ranked.slice(1).map((field) => ({
        pointer: field.pointer,
        score: field.score,
        preview: previewValue(field.value),
      })),
    };
  }
  return {
    fields: fields.map((field) => ({ pointer: field.pointer, preview: previewValue(field.value), type: valueType(field.value) })),
    suggestions,
    draftMapping: draftMappingFromSuggestions(suggestions),
  };
}

export function draftMappingFromSuggestions(suggestions = {}) {
  const mapping = { customFields: [] };
  for (const role of Object.keys(ROLE_THRESHOLDS)) {
    const suggestion = suggestions?.[role] || {};
    if (suggestion.pointer && Number(suggestion.score || 0) >= ROLE_THRESHOLDS[role]) {
      mapping[role] = suggestion.pointer;
    }
  }
  return mapping;
}

export function normalizeWebhookMapping(input = {}) {
  const mapping = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const result = {
    name: normalizePointer(mapping.name),
    phone: normalizePointer(mapping.phone),
    email: normalizePointer(mapping.email),
    content: normalizePointer(mapping.content),
    externalId: normalizePointer(mapping.externalId),
    submittedAt: normalizePointer(mapping.submittedAt),
    customFields: [],
  };
  const customFields = Array.isArray(mapping.customFields) ? mapping.customFields : [];
  result.customFields = customFields.slice(0, 100).map((field, index) => ({
    path: normalizePointer(field?.path || field?.pointer),
    key: text(field?.key || `field_${index + 1}`, 120),
    label: text(field?.label || field?.key || `항목 ${index + 1}`, 160),
    order: Number.isFinite(Number(field?.order)) ? Number(field.order) : index + 1,
  })).filter((field) => field.path);
  return result;
}

export function validateWebhookMapping(input = {}) {
  const mapping = normalizeWebhookMapping(input);
  if (!mapping.phone) {
    throw leadError('전화번호 필드는 반드시 지정해야 합니다.', 400, 'CALLTAG_WEBHOOK_MAPPING_PHONE_REQUIRED');
  }
  return mapping;
}

export function webhookMappingReady(input = {}) {
  try {
    return !!validateWebhookMapping(input).phone;
  } catch {
    return false;
  }
}

export function applyWebhookMapping(payload, mappingInput = {}, connection = {}) {
  const mapping = validateWebhookMapping(mappingInput);
  const value = (pointer) => pointer ? getJsonPointerValue(payload, pointer) : undefined;
  const rawPhone = value(mapping.phone);
  const phone = normalizePhone(rawPhone);
  if (phone.length < 8) {
    throw leadError('선택한 전화번호 필드의 값이 비어 있거나 전화번호 형식이 아닙니다. 다른 필드를 선택해주세요.', 422, 'CALLTAG_WEBHOOK_MAPPED_PHONE_INVALID');
  }

  const customFields = mapping.customFields.map((field) => ({
    key: field.key,
    label: field.label,
    value: safeFieldValue(value(field.path)),
    order: field.order,
  }));

  return {
    external_id: text(value(mapping.externalId), 240),
    source: {
      type: text(connection.source_type || connection.sourceType || 'custom_webhook', 80) || 'custom_webhook',
      name: text(connection.source_name || connection.sourceName || connection.name || 'Webhook', 160),
      provider: 'custom_webhook',
      connection_id: text(connection.id || connection.connectionId, 160),
    },
    customer: {
      name: text(value(mapping.name), 120),
      phone: text(rawPhone, 40),
      email: text(value(mapping.email), 240),
    },
    inquiry: {
      content: text(value(mapping.content), 5000),
      fields: customFields,
    },
    submitted_at: value(mapping.submittedAt) ?? Date.now(),
    metadata: {
      mapper: 'generic_webhook_v1',
      mappingVersion: Number(connection.mapping_version || connection.mappingVersion || 0),
    },
  };
}

export function getJsonPointerValue(payload, pointer = '') {
  const normalized = normalizePointer(pointer);
  if (!normalized) return undefined;
  const segments = normalized.slice(1).split('/').map(unescapePointerSegment);
  let current = payload;
  for (const segment of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined;
      current = current[index];
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
    current = current[segment];
  }
  return current;
}

function scoreFieldForRole(field, role) {
  const aliases = ROLE_ALIASES[role] || [];
  const leaf = normalizedKey(field.leaf);
  const pointerKey = normalizedKey(field.pointer);
  let score = 0;
  if (aliases.includes(leaf)) score += 120;
  else if (aliases.some((alias) => leaf.endsWith(alias) || alias.endsWith(leaf))) score += 90;
  else if (aliases.some((alias) => pointerKey.includes(alias))) score += 65;

  const raw = scalarString(field.value);
  if (role === 'phone') {
    const phone = normalizePhone(raw);
    if (phone.length >= 9 && phone.length <= 12) score += 55;
    if (/^0?1[016789]/.test(phone) || /^82?10/.test(phone)) score += 20;
    if (raw.includes('@')) score -= 80;
  } else if (role === 'email') {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) score += 80;
  } else if (role === 'name') {
    if (raw.length >= 2 && raw.length <= 80 && !raw.includes('@') && normalizePhone(raw).length < 8) score += 20;
  } else if (role === 'content') {
    if (raw.length >= 5) score += Math.min(35, Math.floor(raw.length / 20) + 10);
  } else if (role === 'externalId') {
    if (raw && raw.length <= 240) score += 15;
  } else if (role === 'submittedAt') {
    if (isTimestampLike(field.value)) score += 45;
  }
  return Math.max(0, score);
}

function pointerFromSegments(segments) {
  if (!segments.length) return '/';
  return `/${segments.map(escapePointerSegment).join('/')}`;
}

function escapePointerSegment(value) {
  return String(value).replace(/~/g, '~0').replace(/\//g, '~1');
}

function unescapePointerSegment(value) {
  return String(value).replace(/~1/g, '/').replace(/~0/g, '~');
}

function normalizePointer(value = '') {
  const pointer = String(value || '').trim();
  if (!pointer) return '';
  if (!pointer.startsWith('/')) throw leadError('필드 경로는 / 로 시작하는 JSON Pointer 형식이어야 합니다.', 400, 'CALLTAG_WEBHOOK_MAPPING_PATH_INVALID');
  if (pointer.length > 1000) throw leadError('필드 경로가 너무 깁니다. 1,000자 이하의 JSON Pointer를 사용해주세요.', 400, 'CALLTAG_WEBHOOK_MAPPING_PATH_INVALID');
  return pointer;
}

function normalizedKey(value = '') {
  return String(value || '').toLowerCase().normalize('NFKC').replace(/[^a-z0-9가-힣]/g, '');
}

function scalarString(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}

function previewValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.length > 100 ? `${value.slice(0, 97)}...` : value;
  try {
    const encoded = JSON.stringify(value);
    return encoded.length > 100 ? `${encoded.slice(0, 97)}...` : encoded;
  } catch {
    return String(value).slice(0, 100);
  }
}

function confidence(score) {
  if (score >= 150) return 'high';
  if (score >= 110) return 'medium';
  if (score > 0) return 'low';
  return 'none';
}

function valueType(value) {
  if (value == null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function isTimestampLike(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value < 100000000000 ? value * 1000 : value;
    return ms > Date.UTC(2000, 0, 1) && ms < Date.UTC(2100, 0, 1);
  }
  const raw = scalarString(value);
  if (!raw) return false;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) && parsed > Date.UTC(2000, 0, 1) && parsed < Date.UTC(2100, 0, 1);
}
