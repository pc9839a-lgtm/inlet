import { getD1AccountByEmail } from '../../../server/storage/d1Adapter.mjs';
import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import { auditErrorMetadata, auditSubjectHash, writeAuditLog } from '../_audit.js';
import { AUTH_METHODS, authError, emailVerificationRequesterKey, issueEmailVerificationToken, normalizeEmail, normalizeEmailVerificationPurpose } from './_auth.js';
import { sendAuthVerificationEmail } from './_ses-delivery.js';
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

    const issuanceEnv = withCompatibleAuthVerificationStorage(internalTokenIssuanceEnv(env));
    const issuedVerification = await issueEmailVerificationToken({
      ...input,
      requesterKey,
      suppressDelivery: suppressPasswordResetDelivery,
      concealDeliveryFailure: purpose === 'password-reset',
    }, issuanceEnv);

    let verification = issuedVerification;
    if (!suppressPasswordResetDelivery) {
      const token = String(issuedVerification.token || '').trim();
      if (!/^\d{6}$/.test(token)) {
        await cleanupLatestPendingVerification(env.DB, email, purpose);
        throw authError('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 503, {
          code: 'EMAIL_VERIFICATION_TOKEN_MISSING',
          provider: 'ses',
        });
      }

      try {
        const delivery = await sendAuthVerificationEmail({
          email,
          purpose,
          token,
          expiresAt: issuedVerification.expiresAt || '',
        }, env);
        verification = {
          email: issuedVerification.email || email,
          purpose,
          status: issuedVerification.status || 'pending',
          expiresAt: issuedVerification.expiresAt || '',
          delivery: {
            mode: delivery.mode || 'api',
            provider: delivery.provider || 'ses',
            status: delivery.status || 'sent',
          },
        };
      } catch (error) {
        await cleanupLatestPendingVerification(env.DB, email, purpose);
        throw authError('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 503, {
          code: String(error?.code || 'EMAIL_SEND_PROVIDER_ERROR'),
          provider: 'ses',
        });
      }
    }

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

function internalTokenIssuanceEnv(env = {}) {
  return {
    ...env,
    CF_PAGES_BRANCH: 'auth-email-internal',
    INLET_RUNTIME_ENV: 'development',
    INLET_ENVIRONMENT: 'development',
    NODE_ENV: 'development',
    ENVIRONMENT: 'development',
    INLET_AUTH_EMAIL_MODE: 'mock',
    INLET_AUTH_EMAIL_EXPOSE_TOKEN: '1',
  };
}

async function cleanupLatestPendingVerification(db, email = '', purpose = '') {
  if (!db?.prepare || !email || !purpose) return;
  try {
    await db.prepare(`
      DELETE FROM auth_email_verifications
      WHERE id IN (
        SELECT id
        FROM auth_email_verifications
        WHERE email = ? AND purpose = ? AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
      )
    `).bind(email, purpose).run();
  } catch {
    console.error('auth verification cleanup failed', {
      code: 'EMAIL_VERIFICATION_CLEANUP_FAILED',
      provider: 'ses',
    });
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
  };
}

async function ensureMinimumResponseTime(startedAt = 0, minimumMs = 650) {
  const elapsed = Date.now() - Number(startedAt || 0);
  const remaining = Math.max(0, Number(minimumMs || 0) - elapsed);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}
