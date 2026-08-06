import {
  handleApiError,
  jsonResponse,
  optionsResponse,
  readJson,
} from '../_shared.js';
import { assertSyncRequestSize } from './_guard.js';
import {
  ensureSecureSyncSchema,
  syncError,
} from './_shared.js';

const METHODS = 'POST, OPTIONS';
const WRITE_CONFIRMATION = 'PURGE_CALLTAG_OPERATIONAL_LOGS';
const encoder = new TextEncoder();

function retentionError(message, status, code) {
  return syncError(message, status, code);
}

function boundedDays(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function constantTimeEqual(left, right) {
  const a = encoder.encode(String(left || ''));
  const b = encoder.encode(String(right || ''));
  const length = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let index = 0; index < length; index++) {
    mismatch |= (a[index] || 0) ^ (b[index] || 0);
  }
  return mismatch === 0;
}

function assertRetentionAuthorization(request, env) {
  if (String(env.CALLTAG_SYNC_RETENTION_ENABLED || '0').trim() !== '1') {
    throw retentionError('동기화 보관기간 정리 기능이 비활성화되어 있습니다.', 503, 'CALLTAG_SYNC_RETENTION_NOT_ENABLED');
  }
  const expected = String(env.CALLTAG_SYNC_RETENTION_SECRET || '');
  const supplied = String(request.headers.get('X-CallTag-Sync-Retention-Secret') || '');
  if (expected.length < 32 || !constantTimeEqual(expected, supplied)) {
    throw retentionError('보관기간 정리 권한을 확인하지 못했습니다.', 401, 'CALLTAG_SYNC_RETENTION_UNAUTHORIZED');
  }
}

async function countCandidates(db, securityCutoff, rateCutoff) {
  const security = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM calltag_security_events
    WHERE created_at < ?
  `).bind(securityCutoff).first();
  const rate = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM calltag_sync_rate_limits
    WHERE updated_at < ?
  `).bind(rateCutoff).first();
  return {
    securityEvents: Number(security?.count || 0),
    rateLimits: Number(rate?.count || 0),
  };
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, {
      ok: false,
      error: '허용되지 않는 요청 방식입니다.',
    }, METHODS);
  }

  try {
    assertSyncRequestSize(request, 16 * 1024);
    assertRetentionAuthorization(request, env);
    await ensureSecureSyncSchema(env.DB);
    const body = await readJson(request);
    const dryRun = body.dryRun !== false;
    if (!dryRun && String(body.confirmation || '') !== WRITE_CONFIRMATION) {
      throw retentionError(
        '실제 정리를 실행하려면 확인값이 필요합니다.',
        400,
        'CALLTAG_SYNC_RETENTION_CONFIRMATION_REQUIRED',
      );
    }

    const securityDays = boundedDays(
      env.CALLTAG_SYNC_SECURITY_EVENT_RETENTION_DAYS,
      180,
      30,
      730,
    );
    const rateDays = boundedDays(
      env.CALLTAG_SYNC_RATE_LIMIT_RETENTION_DAYS,
      3,
      1,
      30,
    );
    const securityCutoff = new Date(Date.now() - securityDays * 86_400_000).toISOString();
    const rateCutoff = new Date(Date.now() - rateDays * 86_400_000).toISOString();
    const candidates = await countCandidates(env.DB, securityCutoff, rateCutoff);

    let deleted = { securityEvents: 0, rateLimits: 0 };
    if (!dryRun) {
      const security = await env.DB.prepare(`
        DELETE FROM calltag_security_events
        WHERE created_at < ?
      `).bind(securityCutoff).run();
      const rate = await env.DB.prepare(`
        DELETE FROM calltag_sync_rate_limits
        WHERE updated_at < ?
      `).bind(rateCutoff).run();
      deleted = {
        securityEvents: Number(security?.meta?.changes || 0),
        rateLimits: Number(rate?.meta?.changes || 0),
      };
    }

    return jsonResponse(request, env, 200, {
      ok: true,
      serverNow: new Date().toISOString(),
      dryRun,
      policy: {
        securityEventRetentionDays: securityDays,
        rateLimitRetentionDays: rateDays,
        customerRecordsTouched: false,
        syncChangesTouched: false,
        tombstonesTouched: false,
        devicesTouched: false,
      },
      cutoffs: {
        securityEvents: securityCutoff,
        rateLimits: rateCutoff,
      },
      candidates,
      deleted,
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
