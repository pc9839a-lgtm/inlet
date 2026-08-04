import { getD1AccountByEmail } from '../../../server/storage/d1Adapter.mjs';
import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import { auditErrorMetadata, auditSubjectHash, writeAuditLog } from '../_audit.js';
import { AUTH_METHODS, authError, emailVerificationRequesterKey, issueEmailVerificationToken, normalizeEmail, normalizeEmailVerificationPurpose } from './_auth.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);

  let input = {};
  try {
    assertD1(env);
    input = await readJson(request);
    const purpose = normalizeEmailVerificationPurpose(input.purpose || 'signup');
    if (!purpose) throw authError('Email verification purpose is invalid.', 400, { code: 'EMAIL_VERIFICATION_PURPOSE_INVALID' });
    input = { ...input, purpose };
    const responseStartedAt = Date.now();
    const email = normalizeEmail(input.email || '');
    const suppressPasswordResetDelivery = purpose === 'password-reset'
      && !!email
      && !(await getD1AccountByEmail(env.DB, email));
    const requesterKey = await emailVerificationRequesterKey(request, env);
    const verification = await issueEmailVerificationToken({
      ...input,
      requesterKey,
      suppressDelivery: suppressPasswordResetDelivery,
      concealDeliveryFailure: purpose === 'password-reset',
    }, env);
    const publicVerification = publicEmailVerificationResult(verification, purpose);
    if (purpose === 'password-reset') await ensureMinimumResponseTime(responseStartedAt, 650);
    await writeAuditLog({
      request,
      env,
      action: 'auth.email_verification_requested',
      targetType: 'email_verification',
      targetId: await auditSubjectHash(input.email || '', env).catch(() => ''),
      metadata: {
        purpose,
        ownershipCheckedAtCompletion: purpose === 'signup' || purpose === 'email-change',
        deliveryMode: publicVerification.delivery?.mode || '',
        deliveryStatus: publicVerification.delivery?.status || '',
      },
    });
    return jsonResponse(request, env, 200, { ok: true, verification: publicVerification }, AUTH_METHODS);
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

function publicEmailVerificationResult(verification = {}, purpose = '') {
  if (purpose !== 'password-reset') return verification;
  return {
    email: verification.email || '',
    purpose: 'password-reset',
    status: 'pending',
    expiresAt: verification.expiresAt || '',
    delivery: { mode: 'api', status: 'accepted' },
    ...(verification.token ? { token: verification.token } : {}),
  };
}

async function ensureMinimumResponseTime(startedAt = 0, minimumMs = 650) {
  const elapsed = Date.now() - Number(startedAt || 0);
  const remaining = Math.max(0, Number(minimumMs || 0) - elapsed);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}
