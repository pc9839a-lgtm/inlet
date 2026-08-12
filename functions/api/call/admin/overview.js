import {
  adminErrorResponse,
  adminJson,
  adminOptions,
  maskEmail,
  maskPhone,
  recordAdminAudit,
  requireCalltagAdmin,
} from './_security.js';

const CALLTAG_PRODUCTS_SQL = "'call_monthly','message_monthly','all_monthly'";

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return adminOptions();
  if (request.method !== 'GET') return adminJson(405, { ok: false, error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });

  try {
    if (!env.DB?.prepare) return adminJson(503, { ok: false, error: '관리자 저장소가 연결되지 않았습니다.', code: 'CALLTAG_ADMIN_DB_REQUIRED' });
    const identity = await requireCalltagAdmin(request, env);

    const [totalMembers, newMembers7d, trialMembers, activePaid, paymentReview, partnerPending] = await Promise.all([
      scalar(env.DB, `SELECT COUNT(*) AS value FROM calllink_profiles`),
      scalar(env.DB, `SELECT COUNT(*) AS value FROM calllink_profiles WHERE datetime(created_at) >= datetime('now', '-7 days')`),
      scalar(env.DB, `
        SELECT COUNT(*) AS value
        FROM billing_accounts b
        JOIN calllink_profiles p ON p.owner_id = b.owner_id
        WHERE datetime(b.trial_ends_at) > datetime('now')
          AND NOT EXISTS (
            SELECT 1 FROM billing_subscriptions s
            WHERE s.owner_id = b.owner_id
              AND s.product_code IN (${CALLTAG_PRODUCTS_SQL})
              AND s.status IN ('active','grace','cancelled')
              AND (s.expires_at = '' OR datetime(s.expires_at) > datetime('now'))
          )
      `),
      scalar(env.DB, `
        SELECT COUNT(DISTINCT s.owner_id) AS value
        FROM billing_subscriptions s
        JOIN calllink_profiles p ON p.owner_id = s.owner_id
        WHERE s.product_code IN (${CALLTAG_PRODUCTS_SQL})
          AND s.status IN ('active','grace','cancelled')
          AND (s.expires_at = '' OR datetime(s.expires_at) > datetime('now'))
      `),
      scalar(env.DB, `
        SELECT COUNT(DISTINCT s.owner_id) AS value
        FROM billing_subscriptions s
        JOIN calllink_profiles p ON p.owner_id = s.owner_id
        WHERE s.product_code IN (${CALLTAG_PRODUCTS_SQL})
          AND (s.verification_state != 'verified' OR s.status = 'pending')
      `),
      scalar(env.DB, `
        SELECT COUNT(*) AS value
        FROM partner_commissions pc
        JOIN billing_subscriptions s ON s.id = pc.subscription_id
        WHERE s.product_code IN (${CALLTAG_PRODUCTS_SQL})
          AND pc.status IN ('estimated','confirmed')
      `),
    ]);

    const recentMembers = await recentCalltagMembers(env.DB);
    await recordAdminAudit(env.DB, request, env, identity, 'overview.read');

    return adminJson(200, {
      ok: true,
      readOnly: true,
      admin: { email: maskEmail(identity.email) },
      metrics: {
        totalMembers,
        newMembers7d,
        trialMembers,
        activePaid,
        paymentReview,
        partnerPending,
      },
      recentMembers,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

async function recentCalltagMembers(db) {
  let rows = [];
  try {
    const result = await db.prepare(`
      SELECT
        p.owner_id,
        p.email,
        p.phone,
        p.created_at,
        p.updated_at,
        b.trial_ends_at,
        b.referral_bonus_days,
        s.product_code,
        s.channel,
        s.status AS subscription_status,
        s.verification_state,
        s.expires_at,
        s.last_verified_at
      FROM calllink_profiles p
      LEFT JOIN billing_accounts b ON b.owner_id = p.owner_id
      LEFT JOIN billing_subscriptions s ON s.id = (
        SELECT s2.id
        FROM billing_subscriptions s2
        WHERE s2.owner_id = p.owner_id
          AND s2.product_code IN (${CALLTAG_PRODUCTS_SQL})
        ORDER BY datetime(s2.updated_at) DESC, s2.id DESC
        LIMIT 1
      )
      ORDER BY datetime(p.created_at) DESC
      LIMIT 40
    `).all();
    rows = Array.isArray(result?.results) ? result.results : [];
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    const fallback = await db.prepare(`
      SELECT owner_id, email, phone, created_at, updated_at
      FROM calllink_profiles
      ORDER BY datetime(created_at) DESC
      LIMIT 40
    `).all().catch(() => ({ results: [] }));
    rows = Array.isArray(fallback?.results) ? fallback.results : [];
  }

  return rows.map((row) => ({
    ownerId: String(row.owner_id || '').slice(0, 120),
    email: maskEmail(row.email),
    phone: maskPhone(row.phone),
    createdAt: safeIso(row.created_at),
    updatedAt: safeIso(row.updated_at),
    trialEndsAt: safeIso(row.trial_ends_at),
    referralBonusDays: clampNumber(row.referral_bonus_days, 0, 31),
    subscription: row.product_code ? {
      productCode: String(row.product_code || '').slice(0, 80),
      channel: String(row.channel || '').slice(0, 32),
      status: String(row.subscription_status || '').slice(0, 32),
      verificationState: String(row.verification_state || '').slice(0, 32),
      expiresAt: safeIso(row.expires_at),
      lastVerifiedAt: safeIso(row.last_verified_at),
    } : null,
  }));
}

async function scalar(db, sql) {
  try {
    const row = await db.prepare(sql).first();
    return Math.max(0, Number(row?.value || 0));
  } catch (error) {
    if (isMissingTable(error)) return 0;
    throw error;
  }
}

function isMissingTable(error) {
  return String(error?.message || '').toLowerCase().includes('no such table');
}

function safeIso(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function clampNumber(value, min, max) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}
