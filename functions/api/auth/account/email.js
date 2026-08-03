import { getD1AccountByEmail, upsertD1Account } from '../../../../server/storage/d1Adapter.mjs';
import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../_shared.js';
import { auditErrorMetadata, auditSubjectHash, writeAuditLog } from '../../_audit.js';
import {
  AUTH_METHODS,
  authError,
  authUserPublic,
  confirmEmailVerificationToken,
  createSessionToken,
  getSessionAccount,
  isValidEmail,
  normalizeEmail,
  passwordHash,
} from '../_auth.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (request.method !== 'PATCH') {
    return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);
  }

  let input = {};
  let currentUser = null;
  try {
    assertD1(env);
    input = await readJson(request);
    const session = await getSessionAccount(request, env, input);
    currentUser = session.user;

    const previousEmail = normalizeEmail(currentUser.email || '');
    const nextEmail = normalizeEmail(input.email || input.nextEmail || '');
    const token = String(input.token || input.verificationToken || '').trim();
    const currentPassword = String(input.currentPassword || '');

    if (!isValidEmail(nextEmail)) {
      throw authError('Valid email is required.', 400, { code: 'AUTH_EMAIL_REQUIRED' });
    }
    if (nextEmail === previousEmail) {
      throw authError('New email must be different.', 409, { code: 'AUTH_EMAIL_UNCHANGED' });
    }
    if (!token) {
      throw authError('Email verification is required before changing email.', 403, { code: 'EMAIL_VERIFICATION_REQUIRED' });
    }

    const duplicate = await getD1AccountByEmail(env.DB, nextEmail);
    if (duplicate && duplicate.ownerId !== currentUser.ownerId) {
      throw authError('Email is already registered.', 409, { code: 'AUTH_EMAIL_DUPLICATE', field: 'email' });
    }

    if (currentUser.passwordHash) {
      if (!currentPassword) {
        throw authError('Current password is required.', 400, { code: 'AUTH_CURRENT_PASSWORD_REQUIRED' });
      }
      const currentHash = await passwordHash(currentPassword, previousEmail, env);
      if (currentHash !== currentUser.passwordHash) {
        throw authError('Current password is invalid.', 403, { code: 'AUTH_CURRENT_PASSWORD_INVALID' });
      }
    }

    const verification = await confirmEmailVerificationToken({ email: nextEmail, token }, env);
    if (verification.purpose !== 'email-change') {
      throw authError('Email verification token is invalid.', 403, { code: 'EMAIL_VERIFICATION_INVALID' });
    }

    const updatedAt = new Date().toISOString();
    const updated = await upsertD1Account(env.DB, {
      ...currentUser,
      email: nextEmail,
      passwordHash: currentUser.passwordHash
        ? await passwordHash(currentPassword, nextEmail, env)
        : '',
      emailVerified: true,
      emailVerifiedAt: verification.confirmedAt || updatedAt,
      updatedAt,
    });
    const publicUser = authUserPublic(updated);
    const nextSession = await createSessionToken({
      ownerId: publicUser.ownerId,
      projectId: String(input.projectId || session.payload.projectId || ''),
      role: session.payload.role || 'master',
      email: publicUser.email,
    }, env);

    await writeAuditLog({
      request,
      env,
      actorAccountId: publicUser.ownerId,
      action: 'account.email_changed',
      targetType: 'account',
      targetId: publicUser.ownerId,
      metadata: {
        previousEmailHash: await auditSubjectHash(previousEmail, env),
        nextEmailHash: await auditSubjectHash(nextEmail, env),
        verificationPurpose: verification.purpose,
        previousSessionsInvalidated: true,
      },
    });

    return jsonResponse(request, env, 200, {
      ok: true,
      user: publicUser,
      session: nextSession,
    }, AUTH_METHODS);
  } catch (error) {
    await writeAuditLog({
      request,
      env,
      actorAccountId: currentUser?.ownerId || '',
      action: 'account.email_change_failed',
      targetType: 'account',
      targetId: currentUser?.ownerId || await auditSubjectHash(input.email || input.nextEmail || '', env).catch(() => ''),
      metadata: auditErrorMetadata(error),
    });
    return handleApiError(request, env, error, AUTH_METHODS);
  }
}
