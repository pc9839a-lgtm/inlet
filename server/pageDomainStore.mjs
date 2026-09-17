const DOMAIN_STATUSES = new Set(['pending', 'verifying', 'active', 'failed', 'disconnected']);
const SSL_STATUSES = new Set(['not_applicable', 'pending', 'active', 'failed']);

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

export function normalizeDomainHostname(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .replace(/^\.+|\.+$/g, '');
}

export function canonicalDomainKey(value = '') {
  const hostname = normalizeDomainHostname(value);
  return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
}

export async function getD1PageDomainByPageId(db, pageId = '') {
  const safePageId = String(pageId || '').trim();
  if (!safePageId) return null;
  return db.prepare('SELECT * FROM page_domains WHERE page_id = ? LIMIT 1').bind(safePageId).first();
}

export async function getD1PageDomainByHostname(db, hostname = '') {
  const key = canonicalDomainKey(hostname);
  if (!key) return null;
  return db.prepare(`
    SELECT *
    FROM page_domains
    WHERE hostname_key = ?
      AND status <> 'disconnected'
    LIMIT 1
  `).bind(key).first();
}

export async function assertD1PageDomainAvailable(db, hostname = '', pageId = '') {
  const existing = await getD1PageDomainByHostname(db, hostname);
  if (!existing || String(existing.page_id || '') === String(pageId || '')) return existing;
  throw domainError('이미 다른 페이지에서 사용 중인 도메인입니다.', 409, 'DOMAIN_ALREADY_CONNECTED', {
    hostname: normalizeDomainHostname(hostname),
  });
}

export async function assertD1PageBelongsToProject(db, projectId = '', pageId = '') {
  const safeProjectId = String(projectId || '').trim();
  const safePageId = String(pageId || '').trim();
  if (!safePageId) throw domainError('페이지 정보가 누락되었습니다.', 400, 'DOMAIN_PAGE_IDENTITY_REQUIRED');
  const page = await db.prepare(`
    SELECT pages.id, pages.project_id, projects.status AS project_status
    FROM pages
    LEFT JOIN projects ON projects.id = pages.project_id
    WHERE pages.id = ?
    LIMIT 1
  `).bind(safePageId).first();
  if (!page) throw domainError('페이지 정보를 찾을 수 없습니다.', 404, 'DOMAIN_PAGE_NOT_FOUND');
  if (String(page.project_id || '') !== safeProjectId) {
    throw domainError('현재 프로젝트의 페이지가 아닙니다.', 403, 'DOMAIN_PROJECT_MISMATCH');
  }
  if (String(page.project_status || 'active') === 'archived') {
    throw domainError('보관된 프로젝트의 도메인은 연결할 수 없습니다.', 409, 'DOMAIN_PROJECT_ARCHIVED');
  }
  return page;
}

export async function assertOwnedD1PageDomain(db, { projectId = '', pageId = '', hostname = '' } = {}) {
  await assertD1PageBelongsToProject(db, projectId, pageId);
  const record = await getD1PageDomainByPageId(db, pageId);
  if (!record) throw domainError('저장된 개인 도메인 정보를 찾을 수 없습니다.', 404, 'DOMAIN_CONNECTION_NOT_FOUND');
  if (String(record.project_id || '') !== String(projectId || '')) {
    throw domainError('현재 프로젝트의 도메인 정보가 아닙니다.', 403, 'DOMAIN_PROJECT_MISMATCH');
  }
  if (String(record.status || '') === 'disconnected') {
    throw domainError('이미 해제된 도메인입니다.', 409, 'DOMAIN_ALREADY_DISCONNECTED');
  }
  const requested = normalizeDomainHostname(hostname);
  if (requested && canonicalDomainKey(requested) !== String(record.hostname_key || '')) {
    throw domainError('저장된 도메인과 요청 도메인이 다릅니다.', 409, 'DOMAIN_HOSTNAME_MISMATCH');
  }
  return record;
}

function safeStatus(value, current = 'pending') {
  const normalized = String(value || '').trim().toLowerCase();
  return DOMAIN_STATUSES.has(normalized) ? normalized : current;
}

function safeSslStatus(value, current = 'pending') {
  const normalized = String(value || '').trim().toLowerCase();
  return SSL_STATUSES.has(normalized) ? normalized : current;
}

async function mirrorPageJsonDomainState(db, pageId = '', patch = {}) {
  const row = await db.prepare('SELECT page_json FROM pages WHERE id = ? LIMIT 1').bind(pageId).first();
  if (!row?.page_json) return;
  let page;
  try {
    page = JSON.parse(row.page_json);
  } catch {
    return;
  }
  const integrations = page?.integrations && typeof page.integrations === 'object' ? page.integrations : {};
  const domain = integrations?.domain && typeof integrations.domain === 'object' ? integrations.domain : {};
  const next = {
    ...page,
    integrations: {
      ...integrations,
      domain: {
        ...domain,
        ...(Object.prototype.hasOwnProperty.call(patch, 'hostname') ? { hostname: patch.hostname } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'status') ? { status: patch.status } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'sslStatus') ? { sslStatus: patch.sslStatus } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'failureReason') ? { failureReason: patch.failureReason } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'lastCheckedAt') ? { lastCheckedAt: patch.lastCheckedAt } : {}),
      },
    },
  };
  await db.prepare('UPDATE pages SET page_json = ? WHERE id = ?').bind(JSON.stringify(next), pageId).run();
}

export async function updateD1PageDomainVerification(db, pageId = '', patch = {}) {
  const safePageId = String(pageId || '').trim();
  const current = await getD1PageDomainByPageId(db, safePageId);
  if (!current) throw domainError('저장된 개인 도메인 정보를 찾을 수 없습니다.', 404, 'DOMAIN_CONNECTION_NOT_FOUND');
  const now = String(patch.checkedAt || nowIso());
  const status = safeStatus(patch.domainStatus, String(current.status || 'pending'));
  const sslStatus = safeSslStatus(patch.sslStatus, String(current.ssl_status || 'pending'));
  const connectedAt = status === 'active' ? (current.connected_at || now) : current.connected_at || null;

  await db.prepare(`
    UPDATE page_domains
    SET status = ?,
        ssl_status = ?,
        failure_reason = ?,
        provider = ?,
        provider_domain_id = ?,
        provider_status = ?,
        verification_status = ?,
        validation_status = ?,
        validation_method = ?,
        validation_name = ?,
        validation_value = ?,
        last_checked_at = ?,
        last_provider_sync_at = ?,
        connected_at = ?,
        retry_count = ?,
        next_retry_at = ?,
        last_error_code = ?,
        escalated_at = ?,
        last_attempt_at = ?,
        disconnected_at = NULL,
        updated_at = ?
    WHERE page_id = ?
  `).bind(
    status,
    sslStatus,
    String(patch.failureReason || '').slice(0, 300),
    String(patch.provider || current.provider || ''),
    String(patch.providerDomainId || current.provider_domain_id || ''),
    String(patch.providerStatus || current.provider_status || ''),
    String(patch.verificationStatus || current.verification_status || ''),
    String(patch.validationStatus || current.validation_status || ''),
    String(patch.validationMethod || current.validation_method || ''),
    String(patch.validationName || current.validation_name || ''),
    String(patch.validationValue || current.validation_value || ''),
    now,
    String(patch.providerSyncedAt || now),
    connectedAt,
    Number.isFinite(Number(patch.retryCount)) ? Number(patch.retryCount) : Number(current.retry_count || 0),
    String(patch.nextRetryAt || '').trim() || null,
    String(patch.lastErrorCode || '').slice(0, 100),
    patch.escalatedAt ? String(patch.escalatedAt) : null,
    String(patch.lastAttemptAt || now),
    now,
    safePageId,
  ).run();

  await mirrorPageJsonDomainState(db, safePageId, {
    status,
    sslStatus,
    failureReason: String(patch.failureReason || '').slice(0, 300),
    lastCheckedAt: now,
  });
  return getD1PageDomainByPageId(db, safePageId);
}

export async function disconnectD1PageDomain(db, pageId = '', options = {}) {
  const safePageId = String(pageId || '').trim();
  const current = await getD1PageDomainByPageId(db, safePageId);
  if (!current) return null;
  const now = nowIso();
  await db.prepare(`
    UPDATE page_domains
    SET status = 'disconnected',
        ssl_status = 'not_applicable',
        failure_reason = '',
        provider_status = ?,
        verification_status = '',
        validation_status = '',
        validation_method = '',
        validation_name = '',
        validation_value = '',
        retry_count = 0,
        next_retry_at = NULL,
        last_error_code = '',
        escalated_at = NULL,
        last_attempt_at = ?,
        last_checked_at = ?,
        last_provider_sync_at = ?,
        disconnected_at = ?,
        updated_at = ?
    WHERE page_id = ?
  `).bind(
    String(options.providerStatus || 'deactivated'),
    now,
    now,
    now,
    now,
    now,
    safePageId,
  ).run();
  await mirrorPageJsonDomainState(db, safePageId, {
    hostname: '',
    status: 'disconnected',
    sslStatus: 'not_enabled',
    failureReason: '',
    lastCheckedAt: now,
  });
  return getD1PageDomainByPageId(db, safePageId);
}

export function publicDomainRecord(row = null) {
  if (!row) return null;
  return {
    id: String(row.id || ''),
    projectId: String(row.project_id || ''),
    pageId: String(row.page_id || ''),
    hostname: String(row.hostname || ''),
    domainStatus: String(row.status || 'pending'),
    sslStatus: String(row.ssl_status || 'pending'),
    failureReason: String(row.failure_reason || ''),
    provider: String(row.provider || ''),
    providerDomainId: String(row.provider_domain_id || ''),
    providerStatus: String(row.provider_status || ''),
    verificationStatus: String(row.verification_status || ''),
    validationStatus: String(row.validation_status || ''),
    validation: {
      method: String(row.validation_method || ''),
      name: String(row.validation_name || ''),
      value: String(row.validation_value || ''),
    },
    retryCount: Number(row.retry_count || 0),
    nextRetryAt: String(row.next_retry_at || ''),
    lastErrorCode: String(row.last_error_code || ''),
    escalatedAt: String(row.escalated_at || ''),
    lastAttemptAt: String(row.last_attempt_at || ''),
    lastCheckedAt: String(row.last_checked_at || ''),
    connectedAt: String(row.connected_at || ''),
    disconnectedAt: String(row.disconnected_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}
