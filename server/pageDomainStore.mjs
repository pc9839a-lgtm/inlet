import {
  applyPageDomainConfig,
  normalizePageDomainConfig,
  pageDomainIssues,
} from '../src/lib/pageDomains.js';

const DOMAIN_STATUSES = new Set(['ready', 'pending', 'verifying', 'active', 'failed', 'disconnected']);
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

function domainId(pageId = '') {
  return `domain_${String(pageId || '').replace(/[^a-zA-Z0-9-_]/g, '')}`;
}

function rawPageDomainInput(page = {}) {
  const nested = page?.url && typeof page.url === 'object' ? page.url : {};
  return {
    domainType: (page.domainType || nested.domainType) === 'custom' ? 'custom' : 'default',
    customDomain: page.customDomain || page.hostname || nested.customDomain || nested.hostname || '',
  };
}

function safeDomainStatus(value = '', fallback = 'pending') {
  const status = String(value || '').trim().toLowerCase();
  return DOMAIN_STATUSES.has(status) ? status : fallback;
}

function safeSslStatus(value = '', fallback = 'pending') {
  const status = String(value || '').trim().toLowerCase();
  return SSL_STATUSES.has(status) ? status : fallback;
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
  const rawDomain = rawPageDomainInput(page);
  const issues = pageDomainIssues(rawDomain);
  if (issues.length) {
    throw domainError(issues[0], 400, 'DOMAIN_INVALID', { issues });
  }
  const domain = normalizePageDomainConfig(page);

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
  const sameConnection = current
    && String(current.hostname || '') === domain.customDomain
    && String(current.status || '') !== 'disconnected';
  const connectedAt = domain.domainStatus === 'active'
    ? (current?.connected_at || now)
    : (sameConnection ? current?.connected_at || null : null);
  const providerState = sameConnection ? current : {};

  await db.prepare(`
    INSERT INTO page_domains (
      id, project_id, page_id, hostname, domain_type, status, ssl_status,
      failure_reason, verification_token_hash, provider, provider_domain_id,
      provider_status, verification_status, validation_status, validation_method,
      validation_name, validation_value, last_checked_at, last_provider_sync_at,
      connected_at, disconnected_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'custom', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    ON CONFLICT(page_id) DO UPDATE SET
      project_id = excluded.project_id,
      hostname = excluded.hostname,
      domain_type = 'custom',
      status = excluded.status,
      ssl_status = excluded.ssl_status,
      failure_reason = excluded.failure_reason,
      verification_token_hash = excluded.verification_token_hash,
      provider = excluded.provider,
      provider_domain_id = excluded.provider_domain_id,
      provider_status = excluded.provider_status,
      verification_status = excluded.verification_status,
      validation_status = excluded.validation_status,
      validation_method = excluded.validation_method,
      validation_name = excluded.validation_name,
      validation_value = excluded.validation_value,
      last_checked_at = excluded.last_checked_at,
      last_provider_sync_at = excluded.last_provider_sync_at,
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
    sameConnection ? current?.verification_token_hash || '' : '',
    providerState?.provider || '',
    providerState?.provider_domain_id || '',
    providerState?.provider_status || '',
    providerState?.verification_status || '',
    providerState?.validation_status || '',
    providerState?.validation_method || '',
    providerState?.validation_name || '',
    providerState?.validation_value || '',
    domain.domainLastCheckedAt || (sameConnection ? current?.last_checked_at || null : null),
    sameConnection ? current?.last_provider_sync_at || null : null,
    connectedAt,
    current?.created_at || now,
    now,
  ).run();

  return getD1PageDomainByPageId(db, pageId);
}

export async function syncD1PageDomainPageJson(db, pageId = '', patch = {}) {
  const safePageId = String(pageId || '').trim();
  if (!safePageId) return null;
  const row = await db.prepare('SELECT page_json FROM pages WHERE id = ? LIMIT 1').bind(safePageId).first();
  if (!row?.page_json) return null;
  let page = {};
  try {
    page = JSON.parse(row.page_json);
  } catch {
    return null;
  }
  const nextPage = applyPageDomainConfig(page, patch);
  await db.prepare('UPDATE pages SET page_json = ? WHERE id = ?').bind(JSON.stringify(nextPage), safePageId).run();
  return nextPage;
}

export async function updateD1PageDomainVerification(db, pageId = '', patch = {}) {
  const safePageId = String(pageId || '').trim();
  const current = await getD1PageDomainByPageId(db, safePageId);
  if (!current) {
    throw domainError('저장된 개인 도메인 정보를 찾을 수 없습니다.', 404, 'DOMAIN_CONNECTION_NOT_FOUND');
  }

  const now = nowIso();
  const domainStatus = safeDomainStatus(patch.domainStatus, String(current.status || 'pending'));
  const sslStatus = safeSslStatus(patch.sslStatus, String(current.ssl_status || 'pending'));
  const connectedAt = domainStatus === 'active' ? (current.connected_at || now) : current.connected_at || null;

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
        disconnected_at = NULL,
        updated_at = ?
    WHERE page_id = ?
  `).bind(
    domainStatus,
    sslStatus,
    String(patch.failureReason || '').slice(0, 300),
    String(patch.provider || current.provider || ''),
    String(patch.providerDomainId || current.provider_domain_id || ''),
    String(patch.providerStatus || ''),
    String(patch.verificationStatus || ''),
    String(patch.validationStatus || ''),
    String(patch.validationMethod || ''),
    String(patch.validationName || ''),
    String(patch.validationValue || ''),
    String(patch.checkedAt || now),
    String(patch.providerSyncedAt || now),
    connectedAt,
    now,
    safePageId,
  ).run();

  await syncD1PageDomainPageJson(db, safePageId, {
    domainType: 'custom',
    customDomain: current.hostname || '',
    domainStatus,
    sslStatus,
    domainFailureReason: String(patch.failureReason || '').slice(0, 300),
    domainLastCheckedAt: String(patch.checkedAt || now),
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
        failure_reason = ?,
        provider_status = ?,
        verification_status = '',
        validation_status = '',
        last_checked_at = ?,
        last_provider_sync_at = ?,
        disconnected_at = ?,
        updated_at = ?
    WHERE page_id = ?
  `).bind(
    String(options.failureReason || '').slice(0, 300),
    String(options.providerStatus || 'deactivated'),
    now,
    now,
    now,
    now,
    safePageId,
  ).run();
  await syncD1PageDomainPageJson(db, safePageId, {
    domainType: 'default',
    customDomain: '',
    domainStatus: 'ready',
    sslStatus: 'not_applicable',
    domainFailureReason: '',
    domainLastCheckedAt: '',
  });
  return getD1PageDomainByPageId(db, safePageId);
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
    provider: row.provider || '',
    providerDomainId: row.provider_domain_id || '',
    providerStatus: row.provider_status || '',
    verificationStatus: row.verification_status || '',
    validationStatus: row.validation_status || '',
    validation: {
      method: row.validation_method || '',
      name: row.validation_name || '',
      value: row.validation_value || '',
    },
    connectedAt: row.connected_at || '',
    disconnectedAt: row.disconnected_at || '',
    updatedAt: row.updated_at || '',
  };
}
