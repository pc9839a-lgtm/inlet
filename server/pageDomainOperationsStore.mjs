import {
  getD1PageDomainByPageId,
  publicDomainRecord,
} from './pageDomainStore.mjs';

const DOMAIN_STATUSES = new Set(['ready', 'pending', 'verifying', 'active', 'failed', 'disconnected']);
const RETRY_MINUTES = [5, 15, 30, 60, 180, 360];

function domainError(message, status, code, details = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = { code, ...details };
  return error;
}

function nowIso() {
  return new Date().toISOString();
}

function asDate(value, fallback = new Date()) {
  const date = value instanceof Date ? value : new Date(value || fallback);
  return Number.isNaN(date.getTime()) ? new Date(fallback) : date;
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export function pageDomainRetryDelayMinutes(retryCount = 1) {
  const count = boundedInteger(retryCount, 1, 1, 100);
  return RETRY_MINUTES[Math.min(RETRY_MINUTES.length - 1, count - 1)];
}

export function nextPageDomainRetryAt(retryCount = 1, now = new Date()) {
  const base = asDate(now);
  return new Date(base.getTime() + (pageDomainRetryDelayMinutes(retryCount) * 60_000)).toISOString();
}

export function publicDomainOperationsRecord(row = null) {
  if (!row) return null;
  return {
    ...publicDomainRecord(row),
    retryCount: Number(row.retry_count || 0),
    nextRetryAt: row.next_retry_at || '',
    lastErrorCode: row.last_error_code || '',
    escalatedAt: row.escalated_at || '',
    lastAttemptAt: row.last_attempt_at || '',
  };
}

export async function updateD1PageDomainOperationState(db, pageId = '', patch = {}) {
  const safePageId = String(pageId || '').trim();
  const current = await getD1PageDomainByPageId(db, safePageId);
  if (!current) {
    throw domainError('저장된 개인 도메인 정보를 찾을 수 없습니다.', 404, 'DOMAIN_CONNECTION_NOT_FOUND');
  }

  const now = String(patch.at || nowIso());
  const previousRetryCount = Number(current.retry_count || 0);
  const retryCount = patch.resetRetry === true
    ? 0
    : (patch.incrementRetry === true
      ? previousRetryCount + 1
      : boundedInteger(patch.retryCount, previousRetryCount, 0, 100));
  let nextRetryAt = current.next_retry_at || null;
  if (patch.resetRetry === true || patch.clearNextRetry === true) nextRetryAt = null;
  else if (Object.prototype.hasOwnProperty.call(patch, 'nextRetryAt')) {
    nextRetryAt = String(patch.nextRetryAt || '').trim() || null;
  } else if (patch.scheduleRetry === true) {
    nextRetryAt = nextPageDomainRetryAt(Math.max(1, retryCount), now);
  }

  let escalatedAt = current.escalated_at || null;
  if (patch.clearEscalation === true) escalatedAt = null;
  else if (patch.escalate === true) escalatedAt = escalatedAt || now;

  await db.prepare(`
    UPDATE page_domains
    SET retry_count = ?,
        next_retry_at = ?,
        last_error_code = ?,
        escalated_at = ?,
        last_attempt_at = ?,
        updated_at = ?
    WHERE page_id = ?
  `).bind(
    retryCount,
    nextRetryAt,
    String(Object.prototype.hasOwnProperty.call(patch, 'lastErrorCode')
      ? patch.lastErrorCode || ''
      : current.last_error_code || '').slice(0, 100),
    escalatedAt,
    String(patch.lastAttemptAt || current.last_attempt_at || now),
    now,
    safePageId,
  ).run();
  return getD1PageDomainByPageId(db, safePageId);
}

export async function listD1PageDomainsForOperator(db, options = {}) {
  const status = String(options.status || '').trim().toLowerCase();
  const safeStatus = DOMAIN_STATUSES.has(status) && status !== 'disconnected' ? status : '';
  const query = String(options.query || '').trim().toLowerCase();
  const likeQuery = query ? `%${query}%` : '';
  const staleMinutes = boundedInteger(options.staleMinutes, 0, 0, 60 * 24 * 365);
  const staleBefore = staleMinutes > 0
    ? new Date(asDate(options.now || new Date()).getTime() - (staleMinutes * 60_000)).toISOString()
    : '';
  const limit = boundedInteger(options.limit, 100, 1, 500);

  const result = await db.prepare(`
    SELECT
      page_domains.*,
      projects.slug AS project_slug,
      projects.title AS project_title,
      accounts.email AS owner_email
    FROM page_domains
    LEFT JOIN projects ON projects.id = page_domains.project_id
    LEFT JOIN accounts ON accounts.id = projects.owner_account_id
    WHERE page_domains.status <> 'disconnected'
      AND (? = '' OR page_domains.status = ?)
      AND (
        ? = ''
        OR lower(page_domains.hostname) LIKE ?
        OR lower(COALESCE(projects.slug, '')) LIKE ?
        OR lower(COALESCE(projects.title, '')) LIKE ?
        OR lower(COALESCE(accounts.email, '')) LIKE ?
      )
      AND (
        ? = ''
        OR COALESCE(page_domains.last_checked_at, page_domains.updated_at, page_domains.created_at) <= ?
      )
    ORDER BY
      CASE page_domains.status
        WHEN 'failed' THEN 0
        WHEN 'verifying' THEN 1
        WHEN 'pending' THEN 2
        WHEN 'active' THEN 3
        ELSE 4
      END,
      CASE WHEN page_domains.escalated_at IS NULL THEN 1 ELSE 0 END,
      COALESCE(page_domains.next_retry_at, page_domains.last_checked_at, page_domains.updated_at) ASC
    LIMIT ?
  `).bind(
    safeStatus,
    safeStatus,
    query,
    likeQuery,
    likeQuery,
    likeQuery,
    likeQuery,
    staleBefore,
    staleBefore,
    limit,
  ).all();

  return (result.results || []).map(operatorDomainRecord);
}

export async function listD1PageDomainsDueForRecheck(db, options = {}) {
  const now = asDate(options.now || new Date()).toISOString();
  const limit = boundedInteger(options.limit, 20, 1, 100);
  const maxRetries = boundedInteger(options.maxRetries, 8, 1, 20);
  const result = await db.prepare(`
    SELECT *
    FROM page_domains
    WHERE status IN ('pending', 'verifying', 'failed')
      AND retry_count < ?
      AND (
        status IN ('pending', 'verifying')
        OR (status = 'failed' AND next_retry_at IS NOT NULL AND next_retry_at <> '')
      )
      AND (next_retry_at IS NULL OR next_retry_at = '' OR next_retry_at <= ?)
    ORDER BY
      CASE status WHEN 'failed' THEN 0 WHEN 'verifying' THEN 1 ELSE 2 END,
      COALESCE(next_retry_at, last_checked_at, updated_at, created_at) ASC
    LIMIT ?
  `).bind(maxRetries, now, limit).all();
  return result.results || [];
}

export function operatorDomainRecord(row = null) {
  if (!row) return null;
  const record = publicDomainOperationsRecord(row);
  return {
    ...record,
    projectSlug: row.project_slug || '',
    projectTitle: row.project_title || row.project_slug || row.project_id || '',
    ownerEmail: row.owner_email || '',
    requiresAttention: record.domainStatus === 'failed'
      || !!record.escalatedAt
      || (!!record.nextRetryAt && new Date(record.nextRetryAt).getTime() <= Date.now()),
  };
}
