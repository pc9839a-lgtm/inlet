import { verifyPageDomainConnection } from '../../../server/pageDomainOperations.mjs';
import {
  listD1PageDomainsForOperator,
  operatorDomainRecord,
} from '../../../server/pageDomainOperationsStore.mjs';
import { getD1PageDomainByPageId } from '../../../server/pageDomainStore.mjs';
import {
  assertD1,
  handleApiError,
  jsonResponse,
  optionsResponse,
  readJson,
  sessionIdentity,
} from '../_shared.js';
import { assertPlatformMaster } from './_platformMaster.js';

const METHODS = 'GET, POST, OPTIONS';
const ALLOWED_STATUSES = new Set(['', 'ready', 'pending', 'verifying', 'active', 'failed']);

function endpointError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = { code };
  return error;
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function summarize(items = []) {
  return items.reduce((summary, item) => {
    summary.total += 1;
    summary[item.domainStatus] = Number(summary[item.domainStatus] || 0) + 1;
    if (item.requiresAttention) summary.requiresAttention += 1;
    if (item.escalatedAt) summary.escalated += 1;
    return summary;
  }, {
    total: 0,
    pending: 0,
    verifying: 0,
    active: 0,
    failed: 0,
    requiresAttention: 0,
    escalated: 0,
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }

  try {
    const identity = await sessionIdentity(request, env);
    assertPlatformMaster(identity, env);
    const db = assertD1(env);

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const status = String(url.searchParams.get('status') || '').trim().toLowerCase();
      if (!ALLOWED_STATUSES.has(status)) {
        throw endpointError('지원하지 않는 도메인 상태 필터입니다.', 400, 'DOMAIN_STATUS_FILTER_INVALID');
      }
      const items = await listD1PageDomainsForOperator(db, {
        status,
        query: url.searchParams.get('query') || '',
        staleMinutes: boundedInteger(url.searchParams.get('staleMinutes'), 0, 0, 525_600),
        limit: boundedInteger(url.searchParams.get('limit'), 100, 1, 500),
      });
      return jsonResponse(request, env, 200, {
        ok: true,
        generatedAt: new Date().toISOString(),
        summary: summarize(items),
        items,
      }, METHODS);
    }

    const body = await readJson(request);
    const action = String(body.action || 'verify').trim().toLowerCase();
    if (action !== 'verify') {
      throw endpointError('지원하지 않는 도메인 운영 작업입니다.', 400, 'DOMAIN_ADMIN_ACTION_INVALID');
    }
    const pageId = String(body.pageId || '').trim();
    if (!pageId) throw endpointError('페이지 정보가 누락되었습니다.', 400, 'DOMAIN_PAGE_IDENTITY_REQUIRED');
    const record = await getD1PageDomainByPageId(db, pageId);
    if (!record || String(record.status || '') === 'disconnected') {
      throw endpointError('운영 확인할 개인 도메인 연결을 찾을 수 없습니다.', 404, 'DOMAIN_CONNECTION_NOT_FOUND');
    }
    const result = await verifyPageDomainConnection({
      db,
      env,
      pageId,
      record,
      source: 'operator_manual',
    });
    return jsonResponse(request, env, 200, {
      ...result,
      operatorRecord: operatorDomainRecord(await getD1PageDomainByPageId(db, pageId)),
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
