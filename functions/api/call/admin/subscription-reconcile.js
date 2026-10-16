import { reconcileGoogleSubscriptionByOrder } from '../../billing/_shared.js';
import { adminErrorResponse, adminJson, adminOptions, recordAdminAudit, requireCalltagAdmin } from './_security.js';

// Admin-triggered reconciliation of stale Google Play subscriptions.
// No free grants, no billing charges, and no guesswork based on 'auto_renewing'.
// Existing owner/token/product bindings must survive a new provider verification.
export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return adminOptions();
  if (request.method !== 'POST') return adminJson(405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
  try {
    const operator = await requireCalltagAdmin(request, env);
    const rows = await env.DB.prepare(`
      SELECT id, owner_id, product_code, channel, order_id, purchase_token_hash
      FROM billing_subscriptions
      WHERE channel = 'google_play'
        AND verification_state = 'verified'
        AND product_code IN ('call_monthly', 'message_monthly', 'all_monthly')
        AND status IN ('active', 'grace', 'cancelled', 'expired', 'suspended')
        AND (expires_at = '' OR datetime(expires_at) <= datetime('now'))
      ORDER BY datetime(last_verified_at) ASC, id ASC
      LIMIT 5
    `).all();
    const source = Array.isArray(rows?.results) ? rows.results : [];
    await recordAdminAudit(env.DB, request, env, operator, 'subscriptions.play.reconcile', '', 'started');
    const outcomes = [];
    // Bound concurrency and provider calls. Requests do not mutate expired
    // entitlements without a verified matching Play order and subscriptionsv2 state.
    for (let i = 0; i < source.length; i += 2) {
      const batch = await Promise.all(source.slice(i, i + 2).map(async (row) => {
        try {
          const result = await reconcileGoogleSubscriptionByOrder(env, env.DB, row);
          return {
            ownerId: String(row.owner_id || '').slice(0, 120),
            productCode: String(row.product_code || '').slice(0, 80),
            verified: result.ok === true,
            active: result.active === true,
            state: String(result.reason || 'provider_unavailable').slice(0, 64),
            providerHttpStatus: [401, 403, 404].includes(Number(result.providerHttpStatus || 0))
              ? Number(result.providerHttpStatus) : 0,
          };
        } catch (error) {
          return {
            ownerId: String(row.owner_id || '').slice(0, 120),
            productCode: String(row.product_code || '').slice(0, 80),
            verified: false,
            active: false,
            state: 'provider_unavailable',
            providerHttpStatus: 0,
          };
        }
      }));
      outcomes.push(...batch);
    }
    const refreshed = outcomes.filter((item) => item.verified).length;
    await recordAdminAudit(env.DB, request, env, operator, 'subscriptions.play.reconcile', '', 'ok');
    return adminJson(200, {
      ok: true,
      examined: outcomes.length,
      providerVerified: refreshed,
      activeNow: outcomes.filter((item) => item.active).length,
      needsReview: outcomes.length - refreshed,
      results: outcomes,
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
