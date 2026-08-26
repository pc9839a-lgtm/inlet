import { decryptProviderCredential } from './_credentials.js';
import { metaGraphVersion, verifyMetaPageAccess } from './_meta-graph.js';
import { ensureMetaLeadSchema } from './_meta-schema.js';
import { metaOauthScopes } from './_meta-oauth.js';
import { leadError, safeOwner, text } from './_utils.js';

const CREDENTIAL_AAD_PREFIX = 'calltag:meta-page-token:v1';

export function metaConnectionCredentialAad(ownerId = '', pageId = '') {
  return `${CREDENTIAL_AAD_PREFIX}:${safeOwner(ownerId)}:${String(pageId || '').trim()}`;
}

export function evaluateMetaConnectionHealth(row = {}, options = {}) {
  const status = String(row?.status || '').trim().toLowerCase();
  const grantedScopes = parseScopes(row?.granted_scopes_json ?? row?.grantedScopes);
  const requiredScopes = Array.from(new Set((Array.isArray(options.requiredScopes) ? options.requiredScopes : [])
    .map((scope) => text(scope, 120))
    .filter(Boolean)));
  const missingScopes = grantedScopes.length
    ? requiredScopes.filter((scope) => !grantedScopes.includes(scope))
    : [];
  const tokenExpiresAt = String(row?.token_expires_at ?? row?.tokenExpiresAt ?? '').trim();
  const expiryMs = tokenExpiresAt ? Date.parse(tokenExpiresAt) : Number.NaN;
  const tokenExpiryKnown = Number.isFinite(expiryMs);
  const tokenExpired = tokenExpiryKnown && expiryMs <= Date.now();
  const lastError = text(row?.last_error ?? row?.lastError ?? '', 180);
  const pageAccess = options.pageAccess === true ? true : options.pageAccess === false ? false : null;
  const checkCode = text(options.checkCode || '', 120);
  const reasons = [];

  let state = 'unknown';
  if (status === 'revoked') {
    state = 'revoked';
    reasons.push('CALLTAG_META_CONNECTION_REVOKED');
  } else if (tokenExpired) {
    state = 'error';
    reasons.push('CALLTAG_META_TOKEN_EXPIRED');
  } else if (pageAccess === false) {
    state = 'error';
    reasons.push(checkCode || 'CALLTAG_META_PAGE_ACCESS_DENIED');
  } else if (status === 'error') {
    state = 'warning';
    reasons.push('CALLTAG_META_CONNECTION_ERROR');
  } else if (missingScopes.length) {
    state = 'warning';
    reasons.push('CALLTAG_META_SCOPE_MISSING');
  } else if (lastError) {
    state = 'warning';
    reasons.push('CALLTAG_META_LAST_ERROR');
  } else if (pageAccess === true) {
    state = 'healthy';
  } else if (status === 'active') {
    state = 'active';
  }

  return {
    connectionId: String(row?.id || ''),
    pageId: String(row?.page_id ?? row?.pageId ?? ''),
    pageName: text(options.pageName || row?.page_name || row?.pageName || '', 160),
    state,
    providerStatus: status,
    pageAccess,
    checkedAt: Number(options.checkedAt || 0) || 0,
    graphVersion: text(options.graphVersion || '', 20),
    token: {
      expiresAt: tokenExpiresAt,
      expiryKnown: tokenExpiryKnown,
      expired: tokenExpired,
    },
    scopes: {
      granted: grantedScopes,
      required: requiredScopes,
      missing: missingScopes,
      known: grantedScopes.length > 0,
      complete: grantedScopes.length > 0 && missingScopes.length === 0,
    },
    activity: {
      lastWebhookAt: String(row?.last_webhook_at ?? row?.lastWebhookAt ?? ''),
      lastLeadAt: String(row?.last_lead_at ?? row?.lastLeadAt ?? ''),
    },
    lastError,
    reasons: Array.from(new Set(reasons)),
  };
}

export async function checkMetaConnectionHealth(db, ownerId = '', connectionId = '', env = {}) {
  await ensureMetaLeadSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const id = text(connectionId, 160);
  if (!id) throw leadError('connectionId가 필요합니다.', 400, 'CALLTAG_META_CONNECTION_ID_REQUIRED');

  const row = await db.prepare(`
    SELECT id, owner_id, page_id, page_name, status, credential_envelope,
      token_expires_at, granted_scopes_json, last_webhook_at, last_lead_at,
      last_error, created_at, updated_at, revoked_at
    FROM calltag_meta_connections
    WHERE id = ? AND owner_id = ?
    LIMIT 1
  `).bind(id, safeOwnerId).first();
  if (!row?.id) throw leadError('Meta connection was not found.', 404, 'CALLTAG_META_CONNECTION_NOT_FOUND');

  const baseOptions = {
    requiredScopes: metaOauthScopes(env),
    checkedAt: Date.now(),
    graphVersion: metaGraphVersion(env),
  };
  if (String(row.status || '').toLowerCase() === 'revoked') {
    return evaluateMetaConnectionHealth(row, baseOptions);
  }
  if (!row.credential_envelope) {
    return evaluateMetaConnectionHealth(row, {
      ...baseOptions,
      pageAccess: false,
      checkCode: 'CALLTAG_META_CREDENTIAL_MISSING',
    });
  }

  try {
    const token = await decryptProviderCredential(
      env,
      row.credential_envelope,
      metaConnectionCredentialAad(safeOwnerId, row.page_id),
    );
    const verified = await verifyMetaPageAccess(env, row.page_id, token);
    return evaluateMetaConnectionHealth(row, {
      ...baseOptions,
      pageAccess: true,
      pageName: verified.pageName || row.page_name,
    });
  } catch (error) {
    return evaluateMetaConnectionHealth(row, {
      ...baseOptions,
      pageAccess: false,
      checkCode: text(error?.code || error?.details?.code || 'CALLTAG_META_HEALTH_CHECK_FAILED', 120),
    });
  }
}

function parseScopes(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((scope) => text(scope, 120)).filter(Boolean))).slice(0, 100);
  }
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed)
      ? Array.from(new Set(parsed.map((scope) => text(scope, 120)).filter(Boolean))).slice(0, 100)
      : [];
  } catch {
    return [];
  }
}
