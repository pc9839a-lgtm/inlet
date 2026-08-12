import {
  adminErrorResponse,
  adminJson,
  ownerIdInput,
  recordAdminAudit,
} from './_security.js';
import {
  financeOptions,
  methodNotAllowed,
  readJsonBody,
  requireCalltagFinanceAdmin,
} from './_financeSecurity.js';
import { ensureBillingSchema } from '../../billing/_shared.js';
import {
  ensurePartnerFinanceSchema,
  normalizePartnerRateBps,
  writePartnerFinanceAudit,
} from '../../billing/_partnerFinance.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return financeOptions();
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    const identity = await requireCalltagFinanceAdmin(request, env, 'partner.rate.update');
    const body = await readJsonBody(request);
    const ownerId = ownerIdInput(body.ownerId || '');
    const newRateBps = normalizePartnerRateBps(body.ratePercent ?? body.rateBps);
    if (!newRateBps) {
      return adminJson(400, { ok: false, error: '파트너 수수료는 20% 또는 50%만 선택할 수 있습니다.', code: 'CALLTAG_ADMIN_PARTNER_RATE_INVALID' });
    }

    await ensureBillingSchema(env.DB);
    await ensurePartnerFinanceSchema(env.DB);
    const member = await env.DB.prepare(`
      SELECT p.owner_id
      FROM calllink_profiles p
      JOIN accounts a ON a.id = p.owner_id
      WHERE p.owner_id = ? AND a.status = 'active'
      LIMIT 1
    `).bind(ownerId).first();
    if (!member?.owner_id) {
      return adminJson(404, { ok: false, error: '활성 회원을 찾을 수 없습니다.', code: 'CALLTAG_ADMIN_PARTNER_NOT_FOUND' });
    }

    const current = await env.DB.prepare(`
      SELECT commission_rate_bps
      FROM partner_profiles
      WHERE owner_id = ?
      LIMIT 1
    `).bind(ownerId).first();
    const oldRateBps = Number(current?.commission_rate_bps || 2000) === 5000 ? 5000 : 2000;

    await env.DB.prepare(`
      INSERT INTO partner_profiles (
        owner_id, commission_rate_bps, status, updated_by_owner_id, created_at, updated_at
      ) VALUES (?, ?, 'active', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(owner_id) DO UPDATE SET
        commission_rate_bps = excluded.commission_rate_bps,
        status = 'active',
        updated_by_owner_id = excluded.updated_by_owner_id,
        updated_at = CURRENT_TIMESTAMP
    `).bind(ownerId, newRateBps, identity.ownerId).run();

    await writePartnerFinanceAudit(env.DB, {
      actorOwnerId: identity.ownerId,
      targetOwnerId: ownerId,
      action: 'partner.rate.update',
      oldRateBps,
      newRateBps,
    });
    await recordAdminAudit(env.DB, request, env, identity, 'partner.rate.update', ownerId);

    return adminJson(200, {
      ok: true,
      partnerOwnerId: ownerId,
      oldRatePercent: oldRateBps / 100,
      commissionRatePercent: newRateBps / 100,
      appliesTo: 'future_commissions',
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
