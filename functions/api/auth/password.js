import { getD1AccountByEmail, upsertD1Account } from '../../../server/storage/d1Adapter.mjs';
import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import { auditErrorMetadata, auditSubjectHash, writeAuditLog } from '../_audit.js';
import { AUTH_METHODS, assertAccountActive, authError, authUserPublic, confirmEmailVerificationToken, isValidEmail, isValidPassword, normalizeEmail, passwordHash } from './_auth.js';
import { withCompatibleAuthVerificationStorage } from './_verification-storage-compat.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);

  let input = {};
  try {
    assertD1(env);
    input = await readJson(request);
    const email = normalizeEmail(input.email || '');
    const password = String(input.password || '');
    const token = String(input.token || input.verificationToken || '').trim();
    if (!isValidEmail(email)) throw authError('Valid email is required.', 400, { code: 'AUTH_EMAIL_REQUIRED' });
    if (!token) throw authError('Email verification is required before changing password.', 403, { code: 'EMAIL_VERIFICATION_REQUIRED' });
    if (!isValidPassword(password)) throw authError('Password must include letters and numbers and be at least 6 characters.', 400, { code: 'AUTH_PASSWORD_POLICY' });
    const user = await getD1AccountByEmail(env.DB, email);
    if (!user) throw authError('Account was not found.', 404, { code: 'AUTH_ACCOUNT_NOT_FOUND' });
    assertAccountActive(user, 'change password');
    const authEnv = withCompatibleAuthVerificationStorage(env);
    const verification = await confirmEmailVerificationToken({
      email,
      token,
      purpose: 'password-reset',
      consume: true,
    }, authEnv);
    const updated = await upsertD1Account(env.DB, {
      ...user,
      passwordHash: await passwordHash(password, email, authEnv),
      emailVerified: true,
      updatedAt: new Date().toISOString(),
    });
    const publicUser = authUserPublic(updated);
    await writeAuditLog({
      request,
      env,
      actorAccountId: publicUser.ownerId,
      action: 'account.password_changed',
      targetType: 'account',
      targetId: publicUser.ownerId,
      metadata: {
        verificationPurpose: verification.purpose || 'password-reset',
        sessionRotationRequired: true,
      },
    });
    return jsonResponse(request, env, 200, { ok: true, user: publicUser }, AUTH_METHODS);
  } catch (error) {
    await writeAuditLog({
      request,
      env,
      action: 'account.password_change_failed',
      targetType: 'account',
      targetId: await auditSubjectHash(input.email || '', env).catch(() => ''),
      metadata: auditErrorMetadata(error),
    });
    return handleApiError(request, env, error, AUTH_METHODS);
  }
}
