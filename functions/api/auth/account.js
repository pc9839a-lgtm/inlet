import { getD1AccountByPhone, upsertD1Account } from '../../../server/storage/d1Adapter.mjs';
import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import { writeAuditLog } from '../_audit.js';
import { AUTH_METHODS, authError, authUserPublic, createSessionToken, getSessionAccount, normalizeEmail, normalizePhone } from './_auth.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (request.method !== 'PATCH') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);
  try {
    assertD1(env);
    const input = await readJson(request);
    const { payload, user } = await getSessionAccount(request, env, input);
    const phone = normalizePhone(input.phone || '');
    if (!phone) throw authError('Phone number is required.', 400, { code: 'AUTH_PHONE_REQUIRED' });
    const duplicate = await getD1AccountByPhone(env.DB, phone);
    if (duplicate && normalizeEmail(duplicate.email) !== normalizeEmail(user.email)) {
      throw authError('Phone number is already registered.', 409, { code: 'AUTH_PHONE_DUPLICATE', field: 'phone' });
    }
    const nextName = String(input.name || '').trim() || user.name || user.email;
    const changedFields = [];
    if (nextName !== String(user.name || '')) changedFields.push('name');
    if (phone !== normalizePhone(user.phone || '')) changedFields.push('phone');
    const updated = await upsertD1Account(env.DB, {
      ...user,
      name: nextName,
      phone,
      updatedAt: new Date().toISOString(),
    });
    const publicUser = authUserPublic(updated);
    const session = await createSessionToken({
      ownerId: publicUser.ownerId,
      projectId: String(input.projectId || payload.projectId || ''),
      role: payload.role || input.role || 'master',
      email: publicUser.email,
    }, env);
    if (changedFields.length) {
      await writeAuditLog({
        request,
        env,
        actorAccountId: publicUser.ownerId,
        action: 'account.profile_changed',
        targetType: 'account',
        targetId: publicUser.ownerId,
        metadata: { changedFields },
      });
    }
    return jsonResponse(request, env, 200, { ok: true, user: publicUser, session }, AUTH_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, AUTH_METHODS);
  }
}
