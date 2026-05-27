import { upsertD1Account } from '../../../../server/storage/d1Adapter.mjs';
import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../_shared.js';
import { AUTH_METHODS, assertAccountActive, authError, authUserPublic, getSessionAccount, normalizeAccountStatus } from '../_auth.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (request.method !== 'PATCH') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);
  try {
    assertD1(env);
    const input = await readJson(request);
    const { user } = await getSessionAccount(request, env, input);
    assertAccountActive(user, 'update account status');
    const status = normalizeAccountStatus(input.status || input.accountStatus || '');
    if (status === 'active') throw authError('Only suspended or deleted status can be set through this endpoint.', 400, { code: 'AUTH_ACCOUNT_STATUS_INVALID' });
    const now = new Date().toISOString();
    const updated = await upsertD1Account(env.DB, {
      ...user,
      status,
      ...(status === 'suspended' ? { suspendedAt: now } : {}),
      ...(status === 'deleted' ? { deletedAt: now } : {}),
      updatedAt: now,
    });
    return jsonResponse(request, env, 200, { ok: true, user: authUserPublic(updated), session: '' }, AUTH_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, AUTH_METHODS);
  }
}
