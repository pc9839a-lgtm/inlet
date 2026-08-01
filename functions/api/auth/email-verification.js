import { getD1AccountByEmail } from '../../../server/storage/d1Adapter.mjs';
import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import { auditErrorMetadata, auditSubjectHash, writeAuditLog } from '../_audit.js';
import { AUTH_METHODS, authError, issueEmailVerificationToken, normalizeEmail } from './_auth.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);

  let input = {};
  try {
    assertD1(env);
    input = await readJson(request);
    const purpose = String(input.purpose || 'signup').trim() || 'signup';
    const email = normalizeEmail(input.email || '');
    if (purpose === 'email-change' && email && await getD1AccountByEmail(env.DB, email)) {
      throw authError('Email is already registered.', 409, { code: 'AUTH_EMAIL_DUPLICATE', field: 'email' });
    }
    const verification = await issueEmailVerificationToken(input, env);
    await writeAuditLog({
      request,
      env,
      action: 'auth.email_verification_requested',
      targetType: 'email_verification',
      targetId: await auditSubjectHash(input.email || '', env).catch(() => ''),
      metadata: {
        purpose,
        deliveryMode: verification.delivery?.mode || '',
        deliveryStatus: verification.delivery?.status || '',
      },
    });
    return jsonResponse(request, env, 200, { ok: true, verification }, AUTH_METHODS);
  } catch (error) {
    await writeAuditLog({
      request,
      env,
      action: 'auth.email_verification_request_failed',
      targetType: 'email_verification',
      targetId: await auditSubjectHash(input.email || '', env).catch(() => ''),
      metadata: {
        purpose: String(input.purpose || 'signup'),
        ...auditErrorMetadata(error),
      },
    });
    return handleApiError(request, env, error, AUTH_METHODS);
  }
}
