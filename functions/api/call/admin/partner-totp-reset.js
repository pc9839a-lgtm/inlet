import {
  adminErrorResponse,
  adminJson,
  adminOptions,
  ownerIdInput,
  recordAdminAudit,
  requireCalltagAdmin,
} from './_security.js';
import { revokeFreshSensitiveSessions } from '../../partner/_fresh.js';
import { adminResetPartnerTotp } from '../../partner/_security.js';
import { readJson } from '../../_shared.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return adminOptions();
  if (request.method !== 'POST') return adminJson(405, { ok: false, error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  try {
    const identity = await requireCalltagAdmin(request, env);
    const input = await readJson(request);
    const ownerId = ownerIdInput(input.ownerId || '');
    const result = await adminResetPartnerTotp(env.DB, ownerId);
    await revokeFreshSensitiveSessions(env.DB, ownerId);
    await recordAdminAudit(env.DB, request, env, identity, 'partner.totp_reset', ownerId);
    return adminJson(200, { ok: true, ...result });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
