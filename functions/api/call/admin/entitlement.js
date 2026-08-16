import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../_shared.js';
import { AUTH_METHODS } from '../../auth/_auth.js';
import { assertCallAdmin, callError, entitlementPublic, normalizeEntitlementStatus } from '../_shared.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (!['GET', 'POST', 'PATCH'].includes(request.method)) return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);
  try {
    assertD1(env);
    assertCallAdmin(request, env);
    const input = request.method === 'GET'
      ? Object.fromEntries(new URL(request.url).searchParams.entries())
      : await readJson(request);
    const email = String(input.email || '').trim().toLowerCase();
    const phone = String(input.phone || '').replace(/\D/g, '');
    const ownerIdInput = String(input.ownerId || '').trim();
    const profile = ownerIdInput
      ? await env.DB.prepare('SELECT owner_id, email, phone FROM calllink_profiles WHERE owner_id = ? LIMIT 1').bind(ownerIdInput).first()
      : email
        ? await env.DB.prepare('SELECT owner_id, email, phone FROM calllink_profiles WHERE email = ? LIMIT 1').bind(email).first()
        : phone
          ? await env.DB.prepare('SELECT owner_id, email, phone FROM calllink_profiles WHERE phone = ? LIMIT 1').bind(phone).first()
          : null;
    if (!profile) throw callError('CallLink user was not found.', 404, { code: 'CALL_USER_NOT_FOUND' });

    if (request.method !== 'GET') {
      const status = normalizeEntitlementStatus(input.status || 'active');
      const planCode = String(input.planCode || 'calllink_paid').trim().slice(0, 80);
      const paidUntil = String(input.paidUntil || '').trim();
      const source = String(input.source || 'pagero_payment').trim().slice(0, 80);
      const paymentCustomerId = String(input.paymentCustomerId || '').trim().slice(0, 120);
      const note = String(input.note || '').trim().slice(0, 300);
      await env.DB.prepare(`
        INSERT INTO calllink_entitlements (
          owner_id, status, plan_code, paid_until, source, payment_customer_id, note, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(owner_id) DO UPDATE SET
          status = excluded.status,
          plan_code = excluded.plan_code,
          paid_until = excluded.paid_until,
          source = excluded.source,
          payment_customer_id = excluded.payment_customer_id,
          note = excluded.note,
          updated_at = CURRENT_TIMESTAMP
      `).bind(profile.owner_id, status, planCode, paidUntil, source, paymentCustomerId, note).run();
    }

    const entitlement = await env.DB.prepare(`
      SELECT owner_id, status, plan_code, paid_until, source, payment_customer_id, note, created_at, updated_at
      FROM calllink_entitlements WHERE owner_id = ? LIMIT 1
    `).bind(profile.owner_id).first();
    return jsonResponse(request, env, 200, {
      ok: true,
      account: { ownerId: profile.owner_id, email: profile.email, phone: profile.phone },
      entitlement: entitlementPublic(entitlement),
    }, AUTH_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, AUTH_METHODS);
  }
}
