import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import { auditErrorMetadata, auditSubjectHash, writeAuditLog } from '../_audit.js';
import { AUTH_METHODS, createSessionToken, registerAccount } from './_auth.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);

  let input = {};
  try {
    assertD1(env);
    input = await readJson(request);
    const registration = input.user && typeof input.user === 'object' ? input.user : input;
    const user = await registerAccount(registration, env);
    const session = await createSessionToken({
      ownerId: user.ownerId,
      projectId: String(input.projectId || input.user?.projectId || ''),
      role: 'master',
      email: user.email,
    }, env);
    await writeAuditLog({
      request,
      env,
      actorAccountId: user.ownerId,
      action: 'account.signup_completed',
      targetType: 'account',
      targetId: user.ownerId,
      metadata: {
        source: String(registration.source || 'signup'),
        emailVerified: user.emailVerified === true,
      },
    });
    return jsonResponse(request, env, 200, { ok: true, user, session }, AUTH_METHODS);
  } catch (error) {
    const registration = input.user && typeof input.user === 'object' ? input.user : input;
    await writeAuditLog({
      request,
      env,
      action: 'account.signup_failed',
      targetType: 'account',
      targetId: await auditSubjectHash(registration.email || '', env).catch(() => ''),
      metadata: auditErrorMetadata(error),
    });
    return handleApiError(request, env, error, AUTH_METHODS);
  }
}
