import { ensureUniversalLeadSchema } from './_schema.js';
import { safeOwner, text } from './_utils.js';

const ALLOWED_STATUSES = new Set(['ACCEPTED', 'DELIVERED', 'IMPORTED', 'REJECTED']);

export async function listIntegrationActivity(db, ownerId = '', options = {}) {
  await ensureUniversalLeadSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const limit = Math.max(1, Math.min(100, Number(options.limit || 50)));
  const sourceType = normalizeSourceType(options.sourceType);
  const status = normalizeStatus(options.status);

  const where = ['owner_id = ?'];
  const bindings = [safeOwnerId];
  if (sourceType) {
    where.push('lower(source_type) = ?');
    bindings.push(sourceType);
  }
  if (status) {
    where.push('status = ?');
    bindings.push(status);
  }

  const rows = await db.prepare(`
    SELECT
      id, event_id, connection_id,
      source_type, source_name, provider,
      customer_name, customer_phone,
      inquiry_content, submitted_at,
      status, delivered_at, imported_at, result,
      created_at, updated_at
    FROM calltag_lead_events
    WHERE ${where.join(' AND ')}
    ORDER BY id DESC
    LIMIT ?
  `).bind(...bindings, limit).all();

  const summaryRows = await db.prepare(`
    SELECT status, COUNT(*) AS count
    FROM calltag_lead_events
    WHERE owner_id = ? AND created_at >= datetime('now', '-7 days')
    GROUP BY status
  `).bind(safeOwnerId).all();

  const sourceRows = await db.prepare(`
    SELECT lower(source_type) AS source_type, COUNT(*) AS count
    FROM calltag_lead_events
    WHERE owner_id = ? AND created_at >= datetime('now', '-7 days')
    GROUP BY lower(source_type)
    ORDER BY count DESC, source_type ASC
    LIMIT 20
  `).bind(safeOwnerId).all();

  const summary = { accepted: 0, delivered: 0, imported: 0, rejected: 0, total: 0 };
  for (const row of summaryRows?.results || []) {
    const key = String(row?.status || '').toLowerCase();
    const count = Math.max(0, Number(row?.count || 0));
    if (Object.prototype.hasOwnProperty.call(summary, key)) summary[key] = count;
    summary.total += count;
  }

  return {
    readOnly: true,
    windowDays: 7,
    summary,
    sources: (sourceRows?.results || []).map((row) => ({
      type: String(row?.source_type || ''),
      count: Math.max(0, Number(row?.count || 0)),
    })),
    events: (rows?.results || []).map(publicActivityEvent),
  };
}

export function publicActivityEvent(row = {}) {
  const sourceType = String(row?.source_type || '').toLowerCase();
  const status = String(row?.status || 'ACCEPTED').toUpperCase();
  const pageroLegacy = sourceType === 'pagero';
  return {
    id: Number(row?.id || 0),
    eventId: String(row?.event_id || ''),
    connectionId: String(row?.connection_id || ''),
    source: {
      type: sourceType,
      name: String(row?.source_name || ''),
      provider: String(row?.provider || ''),
    },
    customer: {
      name: text(row?.customer_name, 120),
      phoneMasked: maskPhone(row?.customer_phone),
    },
    inquiryPreview: text(row?.inquiry_content, 180),
    status,
    deliveryMode: pageroLegacy ? 'pagero_legacy' : 'universal',
    stage: pageroLegacy ? 'PAGERO_LEGACY' : stageFromStatus(status),
    submittedAt: Number(row?.submitted_at || 0),
    deliveredAt: String(row?.delivered_at || ''),
    importedAt: String(row?.imported_at || ''),
    result: text(row?.result, 500),
    createdAt: String(row?.created_at || ''),
    updatedAt: String(row?.updated_at || ''),
  };
}

function normalizeSourceType(value = '') {
  const normalized = text(value, 80).toLowerCase();
  if (!normalized) return '';
  return /^[a-z0-9_.:-]{1,80}$/.test(normalized) ? normalized : '';
}

function normalizeStatus(value = '') {
  const normalized = String(value || '').trim().toUpperCase();
  return ALLOWED_STATUSES.has(normalized) ? normalized : '';
}

function stageFromStatus(status = '') {
  if (status === 'IMPORTED') return 'IMPORTED';
  if (status === 'REJECTED') return 'REJECTED';
  if (status === 'DELIVERED') return 'APP_FETCHED';
  return 'RECEIVED';
}

function maskPhone(value = '') {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 4) return '*'.repeat(digits.length);
  const tail = digits.slice(-4);
  const prefix = digits.length >= 10 ? digits.slice(0, 3) : digits.slice(0, Math.min(2, digits.length - 4));
  return `${prefix}${'*'.repeat(Math.max(3, digits.length - prefix.length - 4))}${tail}`;
}
