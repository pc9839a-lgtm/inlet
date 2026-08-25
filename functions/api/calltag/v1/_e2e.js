import { firebaseConfigured, notifyUniversalLeadAvailable } from '../../call/push/_shared.js';
import { intakeCanonicalLead, recordLeadAudit } from './_store.js';
import { leadError, normalizePhone, randomToken, safeOwner, text } from './_utils.js';

const E2E_CONFIRM = 'CREATE_CALLTAG_E2E_TEST_LEAD';
const E2E_SOURCE_TYPE = 'calltag_e2e_test';
const E2E_CONNECTION_ID = 'calltag_e2e_test';

export function e2eReadiness(env = {}) {
  return {
    enabled: String(env.CALLTAG_E2E_TEST_ENABLED || '') === '1',
    firebaseConfigured: firebaseConfigured(env),
    confirmPhrase: E2E_CONFIRM,
    sourceType: E2E_SOURCE_TYPE,
  };
}

export async function createE2eLead(env = {}, db, ownerId = '', input = {}) {
  const readiness = e2eReadiness(env);
  if (!readiness.enabled) {
    throw leadError('CallTag E2E 테스트 모드가 비활성화되어 있습니다.', 403, 'CALLTAG_E2E_DISABLED');
  }
  if (String(input?.confirm || '') !== E2E_CONFIRM) {
    throw leadError('E2E 테스트 실행 확인값이 올바르지 않습니다.', 400, 'CALLTAG_E2E_CONFIRM_REQUIRED');
  }

  const safeOwnerId = safeOwner(ownerId);
  const rawPhone = text(input?.phone, 40);
  const normalizedPhone = normalizePhone(rawPhone);
  if (normalizedPhone.length < 8) {
    throw leadError('테스트에 사용할 유효한 전화번호가 필요합니다.', 400, 'CALLTAG_E2E_PHONE_REQUIRED');
  }

  const runId = `cte2e_${randomToken(12)}`;
  const eventId = `ct_e2e_${randomToken(16)}`;
  const customerName = text(input?.name || '콜태그 E2E 테스트', 120) || '콜태그 E2E 테스트';
  const inquiryContent = text(input?.content || '콜태그 외부 문의 E2E 테스트입니다.', 5000);
  const submittedAt = Date.now();

  const result = await intakeCanonicalLead(db, safeOwnerId, {
    event_id: eventId,
    external_id: runId,
    source: {
      type: E2E_SOURCE_TYPE,
      name: 'CallTag E2E Test',
      provider: 'calltag',
      connection_id: E2E_CONNECTION_ID,
    },
    customer: {
      name: customerName,
      phone: rawPhone,
      email: '',
    },
    inquiry: {
      content: inquiryContent,
      fields: [
        { key: 'e2e_run_id', label: 'E2E Run ID', value: runId, order: 1 },
      ],
    },
    submitted_at: submittedAt,
    metadata: {
      test: true,
      e2e: true,
      runId,
      generatedBy: 'calltag_connect_e2e_v1',
    },
  }, {
    idempotencyKey: runId,
    connectionId: E2E_CONNECTION_ID,
  });

  let push = { configured: readiness.firebaseConfigured, attempted: 0, sent: 0 };
  let pushErrorMessage = '';
  if (result.created) {
    try {
      push = await notifyUniversalLeadAvailable(env, db, safeOwnerId, {
        eventId: result.eventId,
        leadId: result.event?.id,
      });
    } catch (error) {
      pushErrorMessage = text(error?.message || error, 180);
    }
  }

  await recordLeadAudit(db, {
    requestId: `e2e_${runId}`,
    ownerId: safeOwnerId,
    eventId: result.eventId,
    action: 'e2e.push',
    result: pushErrorMessage
      ? 'PUSH_FAILED'
      : `PUSH_${Number(push.sent || 0)}_OF_${Number(push.attempted || 0)}`,
    sourceType: E2E_SOURCE_TYPE,
    statusCode: pushErrorMessage ? 503 : 200,
  });

  return {
    runId,
    eventId: result.eventId,
    leadId: Number(result.event?.id || 0),
    result: result.result,
    created: !!result.created,
    push: {
      configured: !!push.configured,
      attempted: Number(push.attempted || 0),
      sent: Number(push.sent || 0),
      error: pushErrorMessage,
    },
    phoneMasked: maskPhone(rawPhone),
    submittedAt,
  };
}

export async function getE2eStatus(db, ownerId = '', runId = '') {
  const safeOwnerId = safeOwner(ownerId);
  const safeRunId = text(runId, 120);
  if (!safeRunId || !/^cte2e_[A-Za-z0-9_-]{6,100}$/.test(safeRunId)) {
    throw leadError('유효한 E2E runId가 필요합니다.', 400, 'CALLTAG_E2E_RUN_ID_REQUIRED');
  }

  const event = await db.prepare(`
    SELECT id, event_id, external_id, source_type, source_name,
      customer_name, customer_phone, inquiry_content,
      status, delivered_at, imported_at, result,
      submitted_at, created_at, updated_at
    FROM calltag_lead_events
    WHERE owner_id = ? AND external_id = ? AND source_type = ?
    LIMIT 1
  `).bind(safeOwnerId, safeRunId, E2E_SOURCE_TYPE).first();

  if (!event?.id) {
    throw leadError('E2E 테스트 실행 내역을 찾을 수 없습니다.', 404, 'CALLTAG_E2E_RUN_NOT_FOUND');
  }

  const audit = await db.prepare(`
    SELECT action, result, status_code, created_at
    FROM calltag_lead_audit
    WHERE owner_id = ? AND event_id = ? AND action = 'e2e.push'
    ORDER BY id DESC
    LIMIT 1
  `).bind(safeOwnerId, String(event.event_id || '')).first();

  const status = String(event.status || 'ACCEPTED').toUpperCase();
  return {
    runId: safeRunId,
    eventId: String(event.event_id || ''),
    leadId: Number(event.id || 0),
    sourceType: String(event.source_type || ''),
    customer: {
      name: text(event.customer_name, 120),
      phoneMasked: maskPhone(event.customer_phone),
    },
    inquiryPreview: text(event.inquiry_content, 180),
    status,
    stage: stageFromStatus(status),
    deliveredAt: String(event.delivered_at || ''),
    importedAt: String(event.imported_at || ''),
    result: text(event.result, 500),
    submittedAt: Number(event.submitted_at || 0),
    createdAt: String(event.created_at || ''),
    updatedAt: String(event.updated_at || ''),
    push: audit?.action ? {
      result: String(audit.result || ''),
      statusCode: Number(audit.status_code || 0),
      createdAt: String(audit.created_at || ''),
    } : null,
  };
}

function stageFromStatus(status = '') {
  if (status === 'IMPORTED') return 'IMPORTED';
  if (status === 'REJECTED') return 'REJECTED';
  if (status === 'DELIVERED') return 'APP_FETCHED';
  return 'SERVER_ACCEPTED';
}

function maskPhone(value = '') {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 4) return '*'.repeat(digits.length);
  const tail = digits.slice(-4);
  const prefix = digits.length >= 10 ? digits.slice(0, 3) : digits.slice(0, Math.min(2, digits.length - 4));
  return `${prefix}${'*'.repeat(Math.max(3, digits.length - prefix.length - 4))}${tail}`;
}
