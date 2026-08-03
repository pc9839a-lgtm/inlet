import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../_shared.js';
import { writeAuditLog } from '../../_audit.js';

const METHODS = 'POST, OPTIONS';

export function auditRetentionDays(env = {}) {
  const value = Number(env.INLET_AUDIT_RETENTION_DAYS || 730);
  return Math.max(365, Math.min(3650, Number.isFinite(value) ? Math.floor(value) : 730));
}

export function auditRetentionBatchLimit(env = {}) {
  const value = Number(env.INLET_AUDIT_RETENTION_BATCH_LIMIT || 1000);
  return Math.max(1, Math.min(5000, Number.isFinite(value) ? Math.floor(value) : 1000));
}

export function hasAuditRetentionSecret(request, env = {}) {
  const expected = String(env.INLET_AUDIT_RETENTION_SECRET || '').trim();
  if (!expected) return false;
  const header = String(request.headers.get('X-Inlet-Audit-Retention-Secret') || '').trim();
  const bearer = String(request.headers.get('Authorization') || '').trim();
  return header === expected || bearer === `Bearer ${expected}`;
}

function retentionError(message, status = 403, code = 'AUDIT_RETENTION_SECRET_REQUIRED') {
  const error = new Error(message);
  error.status = status;
  error.details = { code };
  return error;
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, METHODS);
  }

  try {
    const db = assertD1(env);
    if (!hasAuditRetentionSecret(request, env)) {
      throw retentionError('Audit retention secret is required.');
    }

    const input = await readJson(request).catch(() => ({}));
    const retentionDays = auditRetentionDays(env);
    const batchLimit = auditRetentionBatchLimit(env);
    const dryRun = input.dryRun === true;
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const countRow = await db.prepare(`
      SELECT COUNT(*) AS count
      FROM audit_logs
      WHERE created_at < ?
        AND action NOT LIKE 'audit.retention_%'
    `).bind(cutoff).first();
    const candidates = Number(countRow?.count || 0);
    let deleted = 0;

    if (!dryRun && candidates > 0) {
      const result = await db.prepare(`
        DELETE FROM audit_logs
        WHERE id IN (
          SELECT id
          FROM audit_logs
          WHERE created_at < ?
            AND action NOT LIKE 'audit.retention_%'
          ORDER BY created_at ASC, id ASC
          LIMIT ?
        )
      `).bind(cutoff, batchLimit).run();
      deleted = Number(result?.meta?.changes || result?.changes || 0);
    }

    await writeAuditLog({
      request,
      env,
      action: dryRun ? 'audit.retention_dry_run' : 'audit.retention_completed',
      targetType: 'audit_log',
      targetId: cutoff,
      metadata: {
        retentionDays,
        batchLimit,
        candidates,
        deleted,
        dryRun,
      },
    });

    return jsonResponse(request, env, 200, {
      ok: true,
      cutoff,
      retentionDays,
      batchLimit,
      candidates,
      deleted,
      dryRun,
      remainingEstimate: Math.max(0, candidates - deleted),
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
