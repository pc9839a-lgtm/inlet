import {
  applyPageDomainConfig,
  normalizePageDomainConfig,
  pageDomainIssues,
} from '../src/lib/pageDomains.js';

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

function domainId(pageId = '') {
  return `domain_${String(pageId || '').replace(/[^a-zA-Z0-9-_]/g, '')}`;
}

export async function getD1PageDomainByPageId(db, pageId = '') {
  const safePageId = String(pageId || '').trim();
  if (!safePageId) return null;
  return db.prepare('SELECT * FROM page_domains WHERE page_id = ? LIMIT 1').bind(safePageId).first();
}

export async function getD1PageDomainByHostname(db, hostname = '') {
  const safeHostname = String(hostname || '').trim().toLowerCase();
  if (!safeHostname) return null;
  return db.prepare(`
    SELECT *
    FROM page_domains
    WHERE hostname = ?
      AND status <> 'disconnected'
    LIMIT 1
  `).bind(safeHostname).first();
}

export async function assertD1PageDomainAvailable(db, hostname = '', pageId = '') {
  const existing = await getD1PageDomainByHostname(db, hostname);
  if (!existing || String(existing.page_id || '') === String(pageId || '')) return existing;
  throw domainError('이미 다른 페이지에서 사용 중인 도메인입니다.', 409, 'DOMAIN_ALREADY_CONNECTED', {
    hostname: String(hostname || '').trim().toLowerCase(),
  });
}

export async function prepareD1PageDomainSave(db, page = {}, context = {}) {
  const domain = normalizePageDomainConfig(page);
  const issues = pageDomainIssues(domain);
  if (issues.length) {
    throw domainError(issues[0], 400, 'DOMAIN_INVALID', { issues });
  }

  if (domain.domainType !== 'custom') {
    return applyPageDomainConfig(page, {
      domainType: 'default',
      domainStatus: 'ready',
      sslStatus: 'not_applicable',
      customDomain: '',
      domainFailureReason: '',
      domainLastCheckedAt: '',
    });
  }

  const pageId = String(context.pageId || page.id || '').trim();
  const current = pageId ? await getD1PageDomainByPageId(db, pageId) : null;
  await assertD1PageDomainAvailable(db, domain.customDomain, pageId);
  const sameConnection = current
    && String(current.hostname || '') === domain.customDomain
    && String(current.status || '') !== 'disconnected';
  const status = sameConnection ? String(current.status || 'pending') : 'pending';
  const sslStatus = sameConnection ? String(current.ssl_status || 'pending') : 'pending';

  return applyPageDomainConfig(page, {
    ...domain,
    domainStatus: status,
    sslStatus,
    domainFailureReason: status === 'failed' ? String(current?.failure_reason || '') : '',
    domainLastCheckedAt: String(current?.last_checked_at || ''),
  });
}

export async function syncD1PageDomain(db, page = {}, context = {}) {
  const domain = normalizePageDomainConfig(page);
  const pageId = String(context.pageId || page.id || '').trim();
  const projectId = String(context.projectId || page.projectId || '').trim();
  if (!pageId || !projectId) {
    throw domainError('도메인 저장에 필요한 페이지 정보가 없습니다.', 409, 'DOMAIN_PAGE_IDENTITY_REQUIRED');
  }

  const current = await getD1PageDomainByPageId(db, pageId);
  const now = nowIso();

  if (domain.domainType !== 'custom') {
    if (current) {
      await db.prepare(`
        UPDATE page_domains
        SET status = 'disconnected',
            ssl_status = 'not_applicable',
            failure_reason = '',
            disconnected_at = ?,
            updated_at = ?
        WHERE page_id = ?
      `).bind(now, now, pageId).run();
    }
    return null;
  }

  await assertD1PageDomainAvailable(db, domain.customDomain, pageId);
  const connectedAt = domain.domainStatus === 'active'
    ? (current?.connected_at || now)
    : (current?.connected_at || null);

  await db.prepare(`
    INSERT INTO page_domains (
      id, project_id, page_id, hostname, domain_type, status, ssl_status,
      failure_reason, verification_token_hash, last_checked_at, connected_at,
      disconnected_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'custom', ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    ON CONFLICT(page_id) DO UPDATE SET
      project_id = excluded.project_id,
      hostname = excluded.hostname,
      domain_type = 'custom',
      status = excluded.status,
      ssl_status = excluded.ssl_status,
      failure_reason = excluded.failure_reason,
      last_checked_at = excluded.last_checked_at,
      connected_at = excluded.connected_at,
      disconnected_at = NULL,
      updated_at = excluded.updated_at
  `).bind(
    current?.id || domainId(pageId),
    projectId,
    pageId,
    domain.customDomain,
    domain.domainStatus,
    domain.sslStatus,
    domain.domainFailureReason || '',
    current?.verification_token_hash || '',
    domain.domainLastCheckedAt || current?.last_checked_at || null,
    connectedAt,
    current?.created_at || now,
    now,
  ).run();

  return getD1PageDomainByPageId(db, pageId);
}

export function publicDomainRecord(row = null) {
  if (!row) return null;
  return {
    id: row.id || '',
    projectId: row.project_id || '',
    pageId: row.page_id || '',
    customDomain: row.hostname || '',
    domainType: row.domain_type || 'custom',
    domainStatus: row.status || 'pending',
    sslStatus: row.ssl_status || 'pending',
    domainFailureReason: row.failure_reason || '',
    domainLastCheckedAt: row.last_checked_at || '',
    connectedAt: row.connected_at || '',
    disconnectedAt: row.disconnected_at || '',
    updatedAt: row.updated_at || '',
  };
}
