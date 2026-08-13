import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import { auditErrorMetadata, auditSubjectHash, writeAuditLog } from '../_audit.js';
import { assertPasswordLoginAllowed, finishPasswordLoginTiming } from '../auth/_loginRateLimit.js';
import { revokeFreshSensitiveSessions } from './_fresh.js';
import {
  PARTNER_SECURITY_METHODS,
  partnerAuthCookie,
  passwordPartnerLogin,
} from './_security.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, PARTNER_SECURITY_METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, PARTNER_SECURITY_METHODS);

  let startedAt = 0;
  let input = {};
  let rateLimitContext = { targetId: '', ipHash: '' };
  try {
    assertD1(env);
    input = await readJson(request);
    startedAt = Date.now();
    rateLimitContext = await assertPasswordLoginAllowed(request, env, input.email || '');
    const result = await passwordPartnerLogin(input, env);
    const ownerId = String(result.user?.ownerId || result.user?.id || '').trim();
    await revokeFreshSensitiveSessions(env.DB, ownerId);
    await writeAuditLog({
      request,
      env,
      actorAccountId: ownerId,
      action: 'auth.login_succeeded',
      targetType: 'account',
      targetId: ownerId,
      metadata: { provider: 'password', surface: 'partner-settlement' },
    });
    await finishPasswordLoginTiming(startedAt, env);
    return jsonResponse(request, env, 200, {
      ok: true,
      user: result.user,
      requiresTotp: true,
    }, PARTNER_SECURITY_METHODS, {
      headers: { 'Set-Cookie': partnerAuthCookie(result.session, request) },
    });
  } catch (error) {
    const errorCode = String(error?.details?.code || '');
    const rateLimited = errorCode === 'AUTH_LOGIN_RATE_LIMITED';
    await writeAuditLog({
      request,
      env,
      action: rateLimited ? 'auth.login_rate_limited' : 'auth.login_failed',
      targetType: 'account',
      targetId: rateLimitContext.targetId || await auditSubjectHash(input.email || '', env).catch(() => ''),
      metadata: { provider: 'password', surface: 'partner-settlement', ...auditErrorMetadata(error) },
    });
    await finishPasswordLoginTiming(startedAt, env);
    return handleApiError(request, env, error, PARTNER_SECURITY_METHODS);
  }
}
