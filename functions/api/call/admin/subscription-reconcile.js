import { googlePlayOrderPaidAmountKrw, reconcileGoogleSubscriptionByOrder } from '../../billing/_shared.js';
import { recordPaymentEvent } from '../../billing/_paymentHistory.js';
import { adminErrorResponse, adminJson, adminOptions, recordAdminAudit, requireCalltagAdmin } from './_security.js';

// Admin-triggered reconciliation of stale Google Play subscriptions.
// No free grants, no billing charges, and no guesswork based on 'auto_renewing'.
// Existing owner/token/product bindings must survive a new provider verification.
export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return adminOptions();
  if (request.method !== 'POST') return adminJson(405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
  try {
    const operator = await requireCalltagAdmin(request, env);
    const payload = await request.json().catch(() => ({}));
    if (Array.isArray(payload?.orders)) return reconcileKnownPaidOrders(request, env, operator, payload);
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

// Exact-order reconciliation; submitted order IDs are never logged or returned.
// Default dry run performs zero subscription or payment writes.
async function reconcileKnownPaidOrders(request, env, operator, payload) {
  const input = payload.orders;
  if (!input.length || input.length > 12) return adminJson(400, { ok: false, code: 'PLAY_ORDER_BATCH_SIZE_INVALID' });
  const orders = [], seen = new Set();
  for (const candidate of input) {
    const orderId = String(candidate?.orderId || '').trim();
    const productCode = String(candidate?.productCode || '').trim();
    if (!/^GPA\.\d{4}-\d{4}-\d{4}-\d{5}(?:\.\.\d+)?$/.test(orderId)
        || !['call_monthly','message_monthly','all_monthly'].includes(productCode)) {
      return adminJson(400, { ok: false, code: 'PLAY_ORDER_INPUT_INVALID' });
    }
    const key = orderId.toLowerCase() + ':' + productCode;
    if (!seen.has(key)) { seen.add(key); orders.push({ orderId, productCode }); }
  }
  const apply = payload.apply === true;
  const results = [];
  for (let i = 0; i < orders.length; i++) {
    const { orderId, productCode } = orders[i];
    const result = { index: i + 1, productCode, state: 'provider_unavailable',
      providerPaid: false, matchedExistingOwner: false, paymentRecorded: false,
      subscriptionRefreshed: false, activeNow: false };
    let proof;
    try {
      proof = await googlePlayOrderPaidAmountKrw(env, 'kr.pagero.calltag', orderId, productCode);
    } catch (_) { proof = { ok: false, reason: 'PLAY_ORDER_LOOKUP_FAILED' }; }
    if (!proof?.ok) {
      result.state = String(proof?.reason || 'provider_unavailable').slice(0, 64);
      result.providerHttpStatus = [401,403,404].includes(Number(proof?.googleStatus || 0)) ? Number(proof.googleStatus) : 0;
      results.push(result);
      continue;
    }
    result.providerPaid = true;
    result.verifiedAmountKrw = proof.amountKrw;
    if (!/^[a-f0-9]{64}$/i.test(String(proof.purchaseTokenHash || ''))) {
      result.state = 'play_purchase_token_unavailable';
      results.push(result);
      continue;
    }
    const rows = await env.DB.prepare(
      "SELECT id,owner_id,product_code,channel,order_id,purchase_token_hash FROM billing_subscriptions WHERE channel='google_play' AND verification_state='verified' AND product_code=? AND purchase_token_hash=? LIMIT 2"
    ).bind(productCode, proof.purchaseTokenHash).all();
    const matches = Array.isArray(rows?.results) ? rows.results : [];
    if (matches.length !== 1 || !matches[0]?.owner_id) {
      result.state = 'paid_order_without_verified_owner';
      results.push(result);
      continue;
    }
    const row = matches[0];
    result.matchedExistingOwner = true;
    if (!apply) { result.state = 'verified_ready'; results.push(result); continue; }
    try {
      // Immutable existing ledger owner; never silently take over another buyer's payment.
      const existing = await env.DB.prepare(
        "SELECT owner_id FROM billing_payment_events WHERE channel='google_play' AND payment_reference=? AND event_type='charge' LIMIT 1"
      ).bind(orderId).first();
      if (existing?.owner_id && existing.owner_id !== row.owner_id) {
        result.state = 'ledger_owner_conflict';
        results.push(result);
        continue;
      }
      await recordPaymentEvent(env.DB, {
        ownerId: row.owner_id, subscriptionId: row.id, productCode,
        channel: 'google_play', eventType: 'charge', paymentReference: orderId,
        amountKrw: proof.amountKrw, amountSource: 'google_play_orders_api',
        paymentStatus: 'paid', paidAt: proof.paidAt,
      });
      result.paymentRecorded = true;
    } catch (_) {
      result.state = 'payment_record_failed';
      results.push(result);
      continue;
    }
    try {
      // Orders confirm a paid charge; subscriptionsv2 alone decides current access.
      const sync = await reconcileGoogleSubscriptionByOrder(env, env.DB, {
        ...row, reconcile_order_id: orderId,
      });
      result.subscriptionRefreshed = sync.ok === true;
      result.activeNow = sync.active === true;
      result.state = sync.ok === true ? (sync.active ? 'repaired_current' : 'verified_not_current')
        : String(sync.reason || 'subscription_verification_failed').slice(0, 64);
      result.providerHttpStatus = [401,403,404].includes(Number(sync.providerHttpStatus || 0))
        ? Number(sync.providerHttpStatus) : 0;
    } catch (_) { result.state = 'subscription_verification_failed'; }
    results.push(result);
  }
  if (apply) await recordAdminAudit(env.DB, request, env, operator, 'subscriptions.play.proven-orders-reconcile', '', 'verified');
  return adminJson(200, {
    ok: true, applied: apply, examined: results.length,
    providerPaid: results.filter(x => x.providerPaid).length,
    matchedExistingOwner: results.filter(x => x.matchedExistingOwner).length,
    paymentRecorded: results.filter(x => x.paymentRecorded).length,
    subscriptionRefreshed: results.filter(x => x.subscriptionRefreshed).length,
    activeNow: results.filter(x => x.activeNow).length,
    unmatchedPaidOrders: results.filter(x => x.state === 'paid_order_without_verified_owner').length,
    results,
  });
}
