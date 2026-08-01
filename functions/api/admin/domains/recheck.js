import { verifyPageDomainConnection, pageDomainMaxRetries } from '../../../../server/pageDomainOperations.mjs';
import { listD1PageDomainsDueForRecheck } from '../../../../server/pageDomainOperationsStore.mjs';
import {
  assertD1,
  handleApiError,
  jsonResponse,
  optionsResponse,
} from '../../_shared.js';

const METHODS = 'POST, OPTIONS';

function endpointError(message, status, code, details = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = { code, ...details };
  return error;
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

async function digest(value = '') {
  const bytes = new TextEncoder().encode(String(value || ''));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((part) => part.toString(16).padStart(2, '0')).join('');
}

async function assertSchedulerSecret(request, env = {}) {
  const expected = String(env.INLET_DOMAIN_RECHECK_SECRET || '').trim();
  if (!expected) {
    throw endpointError('도메인 자동 확인 비밀키가 설정되지 않았습니다.', 503, 'DOMAIN_RECHECK_SECRET_MISSING', {
      status: 'skipped-live',
    });
  }
  const authorization = String(request.headers.get('Authorization') || '').trim();
  const bearer = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
  if (!bearer || await digest(bearer) !== await digest(expected)) {
    throw endpointError('도메인 자동 확인 권한이 없습니다.', 401, 'DOMAIN_RECHECK_UNAUTHORIZED');
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }

  try {
    await assertSchedulerSecret(request, env);
    const db = assertD1(env);
    const limit = boundedInteger(env.INLET_DOMAIN_RECHECK_BATCH_SIZE, 20, 1, 50);
    const records = await listD1PageDomainsDueForRecheck(db, {
      limit,
      maxRetries: pageDomainMaxRetries(env),
    });
    const results = [];

    for (const record of records) {
      try {
        const result = await verifyPageDomainConnection({
          db,
          env,
          pageId: record.page_id,
          record,
          source: 'scheduled_recheck',
        });
        results.push({
          pageId: record.page_id,
          hostname: record.hostname,
          ok: true,
          status: result.current?.domainStatus || record.status,
          operatorRequired: !!result.operatorRequired,
        });
      } catch (error) {
        results.push({
          pageId: record.page_id,
          hostname: record.hostname,
          ok: false,
          code: String(error?.code || error?.details?.code || 'DOMAIN_RECHECK_FAILED'),
          retryable: !!error?.details?.retryable,
          nextRetryAt: String(error?.details?.nextRetryAt || ''),
          escalated: !!error?.details?.escalated,
        });
      }
    }

    return jsonResponse(request, env, 200, {
      ok: true,
      processed: results.length,
      succeeded: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      operatorRequired: results.filter((item) => item.operatorRequired || item.escalated).length,
      results,
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
