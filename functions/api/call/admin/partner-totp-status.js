import {
  adminErrorResponse,
  adminJson,
  adminOptions,
  ownerIdInput,
  recordAdminAudit,
  requireCalltagAdmin,
} from './_security.js';
import { partnerTotpAdminStatus } from '../../partner/_security.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return adminOptions();
  if (request.method !== 'GET') return adminJson(405, { ok: false, error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  try {
    const identity = await requireCalltagAdmin(request, env);
    const ownerId = ownerIdInput(new URL(request.url).searchParams.get('ownerId') || '');
    const security = await partnerTotpAdminStatus(env.DB, ownerId);
    await recordAdminAudit(env.DB, request, env, identity, 'partner.totp_status', ownerId);
    return adminJson(200, { ok: true, ownerId, security });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
