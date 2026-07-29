import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import { AUTH_METHODS, getSessionAccount } from '../auth/_auth.js';
import { ensureCalllinkSchema } from './_shared.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);
  }

  try {
    assertD1(env);
    const input = await readJson(request);
    if (String(input.confirm || '').trim() !== 'DELETE') {
      return jsonResponse(request, env, 400, {
        ok: false,
        error: 'Account deletion confirmation is required.',
        details: { code: 'ACCOUNT_DELETE_CONFIRM_REQUIRED' },
      }, AUTH_METHODS);
    }

    const { user } = await getSessionAccount(request, env, input);
    const ownerId = String(user.ownerId || user.id || '').trim();
    if (!ownerId) {
      return jsonResponse(request, env, 404, {
        ok: false,
        error: 'Account was not found.',
        details: { code: 'AUTH_ACCOUNT_NOT_FOUND' },
      }, AUTH_METHODS);
    }

    await ensureCalllinkSchema(env.DB);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM calllink_entitlements WHERE owner_id = ?').bind(ownerId),
      env.DB.prepare('DELETE FROM calllink_profiles WHERE owner_id = ?').bind(ownerId),
      env.DB.prepare(`
        UPDATE accounts
        SET status = 'deleted_pending_retention',
            name = '',
            phone = NULL,
            password_hash = '',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(ownerId),
    ]);

    return jsonResponse(request, env, 200, {
      ok: true,
      deleted: true,
      deletedAt: new Date().toISOString(),
    }, AUTH_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, AUTH_METHODS);
  }
}
