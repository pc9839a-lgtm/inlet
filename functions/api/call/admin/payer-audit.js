import { adminErrorResponse, adminJson, adminOptions, maskEmail, recordAdminAudit, requireCalltagAdmin } from './_security.js';

// Read-only coverage audit. Do not infer purchase from a subscription verification
// or from a legacy entitlement. Never expose order references or purchase tokens.
const PRODUCT_SQL = "'call_monthly','message_monthly','all_monthly'";
const LIMIT = 500;
export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return adminOptions();
  if (request.method !== 'GET') return adminJson(405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
  try {
    const actor = await requireCalltagAdmin(request, env);
    const schemaRows = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('accounts','calllink_profiles','calllink_entitlements','billing_subscriptions','billing_payment_events')").all();
    const tables = new Set((schemaRows.results || []).map((x) => String(x.name || '')));
    if (!tables.has('billing_subscriptions')) return adminJson(200, { ok: true, available: false, code: 'SUBSCRIPTION_SOURCE_MISSING', candidates: [] });
    const subscriptions = await env.DB.prepare(`
      SELECT owner_id, product_code, channel, status, verification_state,
             expires_at, auto_renewing, last_verified_at,
             CASE WHEN COALESCE(order_id, '') = '' THEN 0 ELSE 1 END AS has_reference
      FROM billing_subscriptions WHERE product_code IN (${PRODUCT_SQL})
      ORDER BY datetime(updated_at) DESC, id DESC LIMIT ?
    `).bind(LIMIT + 1).all();
    const events = tables.has('billing_payment_events')
      ? await env.DB.prepare(`
          SELECT owner_id, product_code, channel, event_type, payment_status,
                 amount_source, amount_krw, paid_at
          FROM billing_payment_events WHERE product_code IN (${PRODUCT_SQL})
          ORDER BY datetime(created_at) DESC, id DESC LIMIT ?
        `).bind(LIMIT + 1).all()
      : { results: [] };
    const legacy = tables.has('calllink_entitlements')
      ? await env.DB.prepare(`
          SELECT owner_id, plan_code, source FROM calllink_entitlements
          WHERE lower(source) IN ('pagero_payment','web_payment','payment','paid')
          LIMIT ?
        `).bind(LIMIT + 1).all()
      : { results: [] };
    const subscribed = Array.isArray(subscriptions.results) ? subscriptions.results : [];
    const charged = Array.isArray(events.results) ? events.results : [];
    const former = Array.isArray(legacy.results) ? legacy.results : [];
    const truncated = subscribed.length > LIMIT || charged.length > LIMIT || former.length > LIMIT;
    const candidates = new Map();
    const ensure = (raw) => {
      const id = String(raw || '').slice(0, 120);
      if (!/^[A-Za-z0-9._:-]{3,120}$/.test(id)) return null;
      if (!candidates.has(id)) candidates.set(id, {
        ownerId: id, memberListed: false, email: '', hasVerifiedSubscription: false,
        hasCurrentSubscription: false, autoRenewing: false,
        hasPurchaseReference: false, recordedCharge: false,
        recordedRefund: false, legacyPaymentMarker: false,
        lastSubscriptionStatus: '', lastVerifiedAt: '', lastProductCode: '',
      });
      return candidates.get(id);
    };
    for (const s of subscribed.slice(0, LIMIT)) {
      const m = ensure(s.owner_id); if (!m) continue;
      const verified = String(s.verification_state || '').toLowerCase() === 'verified';
      const status = String(s.status || '').toLowerCase();
      const expiry = Date.parse(String(s.expires_at || ''));
      const notExpired = !Number.isFinite(expiry) || expiry > Date.now();
      m.hasVerifiedSubscription ||= verified;
      m.hasCurrentSubscription ||= verified && ['active','grace','cancelled'].includes(status) && notExpired;
      m.autoRenewing ||= verified && status === 'active' && notExpired && Number(s.auto_renewing || 0) === 1;
      m.hasPurchaseReference ||= Boolean(Number(s.has_reference || 0));
      if (!m.lastSubscriptionStatus) {
        m.lastSubscriptionStatus = /^[a-z_]{1,32}$/.test(status) ? status : '';
        m.lastVerifiedAt = safeDate(s.last_verified_at);
        m.lastProductCode = safeToken(s.product_code, 64);
      }
    }
    for (const e of charged.slice(0, LIMIT)) {
      const m = ensure(e.owner_id); if (!m) continue;
      const status = String(e.payment_status || '').toLowerCase();
      const type = String(e.event_type || '').toLowerCase();
      const source = String(e.amount_source || '').toLowerCase();
      const provider = ['provider_confirmed','play_earnings_report','google_play_orders_api'].includes(source);
      if (provider && type === 'charge' && status === 'paid' && Number(e.amount_krw || 0) > 0) m.recordedCharge = true;
      if (type === 'refund' && ['refunded','paid'].includes(status)) m.recordedRefund = true;
    }
    for (const e of former.slice(0, LIMIT)) { const m = ensure(e.owner_id); if (m) m.legacyPaymentMarker = true; }
    const ids = [...candidates.keys()];
    if (ids.length) {
      // Count exactly the owner IDs the normal admin list can find.
      for (let start = 0; start < ids.length; start += 100) {
        const chunk = ids.slice(start, start + 100);
        const slots = chunk.map(() => '?').join(',');
        const members = await env.DB.prepare(`
          SELECT owner_id, email, shown FROM (
            SELECT p.owner_id, p.email AS email, 1 AS shown FROM calllink_profiles p WHERE p.owner_id IN (${slots})
            UNION ALL
            SELECT a.id AS owner_id, a.email AS email,
                   CASE WHEN a.status='active' AND EXISTS (SELECT 1 FROM calllink_entitlements e WHERE e.owner_id=a.id) THEN 1 ELSE 0 END AS shown
            FROM accounts a WHERE a.id IN (${slots})
          )
        `).bind(...chunk, ...chunk).all();
        for (const x of (members.results || [])) {
          const m = candidates.get(String(x.owner_id || '')); if (!m) continue;
          m.memberListed ||= Number(x.shown || 0) === 1;
          if (!m.email) m.email = maskEmail(x.email);
        }
      }
    }
    const result = [...candidates.values()].map((x) => ({
      ...x,
      category: x.recordedCharge ? 'charge_recorded' : x.hasVerifiedSubscription ? 'subscription_verified' : x.legacyPaymentMarker ? 'legacy_unverified' : 'other',
      suspectedOmission: !x.memberListed && (x.recordedCharge || x.hasVerifiedSubscription),
    })).sort((a, b) => Number(b.suspectedOmission) - Number(a.suspectedOmission)
      || Number(b.recordedCharge) - Number(a.recordedCharge)
      || Number(b.hasCurrentSubscription) - Number(a.hasCurrentSubscription)
      || a.ownerId.localeCompare(b.ownerId));
    await recordAdminAudit(env.DB, request, env, actor, 'members.payer-audit.read');
    return adminJson(200, { ok: true, available: true, truncated: truncated || result.length > LIMIT,
      sources: { subscriptions: subscribed.length, payments: charged.length, legacy: former.length },
      summary: { candidates: result.length, chargeRecorded: result.filter(x=>x.recordedCharge).length,
        verifiedSubscription: result.filter(x=>x.hasVerifiedSubscription).length,
        notInMemberList: result.filter(x=>x.suspectedOmission).length,
        awaitingProviderProof: result.filter(x=>x.hasVerifiedSubscription && !x.recordedCharge).length,
        legacyOnly: result.filter(x=>x.category==='legacy_unverified').length },
      candidates: result.slice(0, LIMIT), generatedAt: new Date().toISOString(),
    });
  } catch (error) { return adminErrorResponse(error); }
}
function safeToken(v,n=64) { const s=String(v||'');return /^[a-zA-Z0-9._:-]*$/.test(s)?s.slice(0,n):''; }
function safeDate(v) { const n=Date.parse(String(v||''));return Number.isFinite(n)?new Date(n).toISOString():''; }
