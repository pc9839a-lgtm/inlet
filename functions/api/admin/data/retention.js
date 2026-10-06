import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../_shared.js';
import { writeAuditLog } from '../../_audit.js';

const METHODS = 'POST, OPTIONS';
const DAY_MS = 24 * 60 * 60 * 1000;

function boundedDays(value, fallback, min = 1, max = 3650) {
  const number = Number(value);
  const days = Number.isFinite(number) ? Math.floor(number) : fallback;
  return Math.max(min, Math.min(max, days));
}

export function pageRoDataRetentionPolicy(env = {}) {
  return {
    leadDays: boundedDays(env.INLET_LEAD_RETENTION_DAYS, 180),
    deliveryLogDays: boundedDays(env.INLET_DELIVERY_LOG_RETENTION_DAYS, 30, 1, 365),
    aiDraftDays: boundedDays(env.INLET_AI_DRAFT_RETENTION_DAYS, 30, 1, 365),
    // Current events payload_json retains the submitted event object. Until that write
    // contract is guaranteed PII-free, keep the runtime window no longer than leads.
    eventDays: boundedDays(env.INLET_EVENT_RETENTION_DAYS, 180, 1, 180),
    batchLimit: boundedDays(env.INLET_DATA_RETENTION_BATCH_LIMIT, 500, 1, 5000),
    eventRetentionClass: 'conservative-potential-pii',
  };
}

export function hasPageRoDataRetentionSecret(request, env = {}) {
  const expected = String(env.INLET_DATA_RETENTION_SECRET || '').trim();
  if (!expected) return false;
  const header = String(request.headers.get('X-Inlet-Data-Retention-Secret') || '').trim();
  const bearer = String(request.headers.get('Authorization') || '').trim();
  return header === expected || bearer === `Bearer ${expected}`;
}

function retentionError(message, status = 403, code = 'DATA_RETENTION_SECRET_REQUIRED') {
  const error = new Error(message);
  error.status = status;
  error.details = { code };
  return error;
}

function cutoffIso(now, days) {
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}

async function countCandidates(db, table, cutoff) {
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE created_at < ?`).bind(cutoff).first();
  return Number(row?.count || 0);
}

async function deleteOldest(db, table, cutoff, batchLimit) {
  const result = await db.prepare(`
    DELETE FROM ${table}
    WHERE id IN (
      SELECT id
      FROM ${table}
      WHERE created_at < ?
      ORDER BY created_at ASC, id ASC
      LIMIT ?
    )
  `).bind(cutoff, batchLimit).run();
  return Number(result?.meta?.changes || result?.changes || 0);
}

export async function runPageRoDataRetention(db, env = {}, { dryRun = true, now = new Date() } = {}) {
  const policy = pageRoDataRetentionPolicy(env);
  const cutoffs = {
    deliveryLogs: cutoffIso(now, policy.deliveryLogDays),
    aiDrafts: cutoffIso(now, policy.aiDraftDays),
    events: cutoffIso(now, policy.eventDays),
    leads: cutoffIso(now, policy.leadDays),
  };

  const targets = [
    { key: 'deliveryLogs', table: 'delivery_logs', cutoff: cutoffs.deliveryLogs },
    { key: 'aiDrafts', table: 'ai_drafts', cutoff: cutoffs.aiDrafts },
    { key: 'events', table: 'events', cutoff: cutoffs.events },
    { key: 'leads', table: 'leads', cutoff: cutoffs.leads },
  ];

  const result = {};
  for (const target of targets) {
    const candidates = await countCandidates(db, target.table, target.cutoff);
    const deleted = !dryRun && candidates > 0
      ? await deleteOldest(db, target.table, target.cutoff, policy.batchLimit)
      : 0;
    result[target.key] = {
      table: target.table,
      cutoff: target.cutoff,
      candidates,
      deleted,
      remainingEstimate: Math.max(0, candidates - deleted),
    };
  }

  return {
    dryRun,
    policy,
    targets: result,
    totalCandidates: Object.values(result).reduce((sum, item) => sum + item.candidates, 0),
    totalDeleted: Object.values(result).reduce((sum, item) => sum + item.deleted, 0),
  };
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, METHODS);
  }

  try {
    const db = assertD1(env);
    if (!hasPageRoDataRetentionSecret(request, env)) {
      throw retentionError('PageRo data retention secret is required.');
    }

    const input = await readJson(request).catch(() => ({}));
    const dryRun = input.dryRun !== false;
    const result = await runPageRoDataRetention(db, env, { dryRun });

    await writeAuditLog({
      request,
      env,
      action: dryRun ? 'data.retention_dry_run' : 'data.retention_completed',
      targetType: 'pagero_data_retention',
      targetId: new Date().toISOString().slice(0, 10),
      metadata: {
        dryRun,
        policy: result.policy,
        totalCandidates: result.totalCandidates,
        totalDeleted: result.totalDeleted,
        deletedByTarget: Object.fromEntries(
          Object.entries(result.targets).map(([key, value]) => [key, value.deleted]),
        ),
      },
    });

    return jsonResponse(request, env, 200, { ok: true, ...result }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
