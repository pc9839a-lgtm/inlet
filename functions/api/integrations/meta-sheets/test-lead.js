import { assertD1, jsonResponse, optionsResponse } from '../../_shared.js';
import { ensureWebhookSchema, intakeCanonicalLead, sha256 } from '../../calltag/v1/_shared.js';
import { notifyUniversalLeadAvailable } from '../../call/push/_shared.js';

const METHODS = 'POST, OPTIONS';
const ALLOWED_WEBHOOK_HASH = '5581b91b500d9fb0454d2377b8a53968d79d4471f314171d8eeb2d50dd78c57f';
const TEST_PHONE = '01000000000';

function parseKey(raw) {
  const input = String(raw || '').trim();
  if (/^ctwh_[A-Za-z0-9_-]{24,110}$/.test(input)) return input;
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.host !== 'pagero.kr') return '';
    const match = /^\/api\/calltag\/v1\/hooks\/(ctwh_[A-Za-z0-9_-]{24,110})$/.exec(url.pathname);
    return match ? match[1] : '';
  } catch { return ''; }
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' }, METHODS);
  try {
    const db = assertD1(env);
    const key = parseKey(request.headers.get('X-CallTag-Test-Webhook'));
    if (!key || await sha256(key) !== ALLOWED_WEBHOOK_HASH) {
      return jsonResponse(request, env, 401, { ok: false, error: 'INVALID_TEST_WEBHOOK' }, METHODS);
    }
    await ensureWebhookSchema(db);
    const connection = await db.prepare(
      "SELECT id, owner_id FROM calltag_webhook_connections WHERE endpoint_hash = ? AND status = 'active' LIMIT 1"
    ).bind(ALLOWED_WEBHOOK_HASH).first();
    if (!connection?.id || !connection?.owner_id) {
      return jsonResponse(request, env, 404, { ok: false, error: 'WEBHOOK_NOT_ACTIVE' }, METHODS);
    }
    const eventId = 'meta-sheets-manual-test-20261108';
    const inserted = await intakeCanonicalLead(db, connection.owner_id, {
      external_id: eventId,
      source: {
        type: 'custom_webhook',
        provider: 'meta_sheets',
        name: '개인회생 광고 연동 테스트'
      },
      customer: { name: '연동 테스트 고객', phone: TEST_PHONE },
      inquiry: {
        content: '콜태그 자동등록 기능 점검용 가상 데이터입니다. 광고주에게 전송하지 않았습니다. 테스트 후 삭제해도 됩니다.'
      },
      submitted_at: Date.now(),
    }, { connectionId: connection.id, idempotencyKey: eventId });

    let push = 'skipped';
    if (inserted.created) {
      try {
        const result = await notifyUniversalLeadAvailable(env, db, connection.owner_id, {
          eventId: inserted.eventId
        });
        push = Number(result?.sent || 0) > 0 ? 'sent' : 'not_delivered';
      } catch {
        push = 'not_delivered';
      }
    }
    return jsonResponse(request, env, 200, {
      ok: true,
      status: inserted.created ? 'CREATED' : 'ALREADY_EXISTS',
      appLabel: '연동 테스트 고객',
      appPhone: TEST_PHONE,
      push,
      advertiserSent: false
    }, METHODS);
  } catch (error) {
    console.error('CallTag lead registration test failed', { type: String(error?.name || 'Error') });
    return jsonResponse(request, env, 500, { ok: false, error: 'TEST_FAILED' }, METHODS);
  }
}
