import { getD1AccountByEmail } from '../../../server/storage/d1Adapter.mjs';
import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import { auditErrorMetadata, auditSubjectHash, writeAuditLog } from '../_audit.js';
import { AUTH_METHODS, authError, emailVerificationRequesterKey, issueEmailVerificationToken, normalizeEmail, normalizeEmailVerificationPurpose } from './_auth.js';
import { withCompatibleAuthVerificationStorage } from './_verification-storage-compat.js';

const FINAL_DUPLICATE_DECISION_CODE = 'AUTH_EMAIL_DUPLICATE';

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
    const authEnv = withCompatibleAuthVerificationStorage(withAuthEmailDeliveryDefaults(env));
    const verification = await issueEmailVerificationToken({
      ...input,
      requesterKey,
      suppressDelivery: suppressPasswordResetDelivery,
      concealDeliveryFailure: purpose === 'password-reset',
    }, authEnv);
    const publicVerification = publicEmailVerificationResult(verification, purpose);
    if (purpose === 'password-reset') await ensureMinimumResponseTime(responseStartedAt, 650);
    const ownershipCheckedAtCompletion = purpose === 'signup' || purpose === 'email-change';
    await writeAuditLog({
      request,
      env,
      action: 'auth.email_verification_requested',
      targetType: 'email_verification',
      targetId: await auditSubjectHash(input.email || '', env).catch(() => ''),
      metadata: {
        purpose,
        ownershipCheckedAtCompletion,
        finalDuplicateDecisionCode: ownershipCheckedAtCompletion ? FINAL_DUPLICATE_DECISION_CODE : '',
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

function withAuthEmailDeliveryDefaults(env = {}) {
  const accessKey = String(
    env.AWS_SES_ACCESS_KEY_ID
      || env.INLET_AWS_SES_ACCESS_KEY_ID
      || env.AWS_ACCESS_KEY_ID
      || env.SES_ACCESS_KEY_ID
      || env['Access key ID']
      || '',
  ).trim();
  const secretKey = String(
    env.AWS_SES_SECRET_ACCESS_KEY
      || env.INLET_AWS_SES_SECRET_ACCESS_KEY
      || env.AWS_SECRET_ACCESS_KEY
      || env.SES_SECRET_ACCESS_KEY
      || env['Secret access key']
      || '',
  ).trim();
  const hasSesCredentials = !!accessKey && !!secretKey;
  const branch = String(env.CF_PAGES_BRANCH || '').trim().toLowerCase();
  const runtime = String(env.INLET_RUNTIME_ENV || env.INLET_ENVIRONMENT || env.NODE_ENV || env.ENVIRONMENT || '').trim().toLowerCase();
  const production = branch === 'main' || runtime === 'production';
  const configuredMode = String(env.INLET_AUTH_EMAIL_MODE || '').trim().toLowerCase();
  const deliveryMode = (!configuredMode || (production && configuredMode === 'mock')) && hasSesCredentials
    ? 'ses'
    : configuredMode || 'mock';

  return {
    ...env,
    INLET_AUTH_EMAIL_MODE: deliveryMode,
    INLET_EMAIL_PROVIDER: String(env.INLET_EMAIL_PROVIDER || 'ses').trim().toLowerCase() || 'ses',
    INLET_AUTH_EMAIL_FROM: String(
      env.INLET_AUTH_EMAIL_FROM
        || env.INLET_LEAD_EMAIL_FROM
        || env.AWS_SES_FROM
        || '페이지로 <support@pagero.kr>',
    ).trim(),
  };
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
