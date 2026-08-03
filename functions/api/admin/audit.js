import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../_shared.js';
import { sanitizeAuditMetadata } from '../_audit.js';
import { requirePlatformMaster } from './_auth.js';

const ADMIN_METHODS = 'GET, OPTIONS';

function safeLimit(value, fallback = 50) {
  return Math.max(1, Math.min(100, Number(value || fallback)));
}

function safeCursor(value) {
  return Math.max(0, Number(value || 0));
}

function dateBoundary(value = '', end = false) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T${end ? '23:59:59.999' : '00:00:00.000'}Z`;
  return raw.slice(0, 40);
}

function decodeMetadata(value = '') {
  try {
    return sanitizeAuditMetadata(value ? JSON.parse(value) : {});
  } catch {
    return {};
  }
}

function mapAuditRow(row = {}) {
  return {
    id: row.id || '',
    projectId: row.project_id || '',
    project: row.project_id ? {
      id: row.project_id,
      slug: row.project_slug || '',
      title: row.project_title || '',
    } : null,
    actorAccountId: row.actor_account_id || '',
    actor: row.actor_account_id ? {
      id: row.actor_account_id,
      email: row.actor_email || '',
      name: row.actor_name || '',
    } : null,
    action: row.action || '',
    targetType: row.target_type || '',
    targetId: row.target_id || '',
    metadata: decodeMetadata(row.metadata_json || ''),
    createdAt: row.created_at || '',
  };
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, ADMIN_METHODS);
  if (request.method !== 'GET') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, ADMIN_METHODS);

  try {
    const db = assertD1(env);
    const identity = await requirePlatformMaster(request, env);
    const url = new URL(request.url);
    const limit = safeLimit(url.searchParams.get('limit'));
    const cursor = safeCursor(url.searchParams.get('cursor'));
    const filters = [];
    const params = [];

    const action = String(url.searchParams.get('action') || '').trim();
    const actor = String(url.searchParams.get('actor') || '').trim();
    const projectId = String(url.searchParams.get('projectId') || '').trim();
    const targetType = String(url.searchParams.get('targetType') || '').trim();
    const query = String(url.searchParams.get('q') || '').trim().toLowerCase();
    const dateFrom = dateBoundary(url.searchParams.get('dateFrom') || '');
    const dateTo = dateBoundary(url.searchParams.get('dateTo') || '', true);

    if (action) {
      filters.push('audit_logs.action = ?');
      params.push(action);
    }
    if (actor) {
      filters.push('(audit_logs.actor_account_id = ? OR lower(accounts.email) = lower(?))');
      params.push(actor, actor);
    }
    if (projectId) {
      filters.push('audit_logs.project_id = ?');
      params.push(projectId);
    }
    if (targetType) {
      filters.push('audit_logs.target_type = ?');
      params.push(targetType);
    }
    if (dateFrom) {
      filters.push('audit_logs.created_at >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      filters.push('audit_logs.created_at <= ?');
      params.push(dateTo);
    }
    if (query) {
      const needle = `%${query}%`;
      filters.push(`(
        lower(audit_logs.action) LIKE ?
        OR lower(audit_logs.target_type) LIKE ?
        OR lower(audit_logs.target_id) LIKE ?
        OR lower(COALESCE(accounts.email, '')) LIKE ?
        OR lower(COALESCE(accounts.name, '')) LIKE ?
        OR lower(COALESCE(projects.slug, '')) LIKE ?
        OR lower(COALESCE(projects.title, '')) LIKE ?
      )`);
      params.push(needle, needle, needle, needle, needle, needle, needle);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const rows = await db.prepare(`
      SELECT
        audit_logs.id,
        audit_logs.project_id,
        audit_logs.actor_account_id,
        audit_logs.action,
        audit_logs.target_type,
        audit_logs.target_id,
        audit_logs.metadata_json,
        audit_logs.created_at,
        accounts.email AS actor_email,
        accounts.name AS actor_name,
        projects.slug AS project_slug,
        projects.title AS project_title
      FROM audit_logs
      LEFT JOIN accounts ON accounts.id = audit_logs.actor_account_id
      LEFT JOIN projects ON projects.id = audit_logs.project_id
      ${where}
      ORDER BY audit_logs.created_at DESC, audit_logs.id DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, cursor).all();

    const countRow = await db.prepare(`
      SELECT COUNT(*) AS total
      FROM audit_logs
      LEFT JOIN accounts ON accounts.id = audit_logs.actor_account_id
      LEFT JOIN projects ON projects.id = audit_logs.project_id
      ${where}
    `).bind(...params).first();

    const records = (rows.results || []).map(mapAuditRow);
    const total = Number(countRow?.total || 0);
    return jsonResponse(request, env, 200, {
      ok: true,
      generatedAt: new Date().toISOString(),
      identity: { email: identity.email || '' },
      filters: { action, actor, projectId, targetType, q: query, dateFrom, dateTo },
      records,
      total,
      cursor,
      nextCursor: cursor + records.length < total ? cursor + records.length : null,
      hasMore: cursor + records.length < total,
    }, ADMIN_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, ADMIN_METHODS);
  }
}
