import {
  adminErrorResponse,
  adminJson,
  adminOptions,
  maskEmail,
  maskPhone,
  recordAdminAudit,
  requireCalltagAdmin,
} from './_security.js';
import { productPriceKrw } from '../../billing/_commissions.js';

const CALLTAG_PRODUCTS_SQL = "'call_monthly','message_monthly','all_monthly'";
const SAFE_TABLES = new Set([
  'calllink_profiles',
  'billing_accounts',
  'billing_subscriptions',
  'partner_commissions',
]);
const PLAY_FEE_RATE = 0.15;

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return adminOptions();
  if (request.method !== 'GET') return adminJson(405, { ok: false, error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });

  try {
    if (!env.DB?.prepare) return adminJson(503, { ok: false, error: '관리자 저장소가 연결되지 않았습니다.', code: 'CALLTAG_ADMIN_DB_REQUIRED' });
    const identity = await requireCalltagAdmin(request, env);
    const schema = await loadSchema(env.DB);
    const degraded = [];

    const totalMembers = await totalMembersMetric(env.DB, schema, degraded);
    const newMembers7d = await newMembersMetric(env.DB, schema, degraded);
    const trialMembers = await trialMembersMetric(env.DB, schema, degraded);
    const activePaid = await activePaidMetric(env.DB, schema, degraded);
    const paymentReview = await paymentReviewMetric(env.DB, schema, degraded);
    const partnerPending = await partnerPendingMetric(env.DB, schema, degraded);
    const revenueEstimate = await monthlyRevenueEstimate(env.DB, schema, degraded);
    const recentMembers = await recentCalltagMembers(env.DB, schema, degraded);

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
      revenueEstimate,
      recentMembers,
      degraded: Array.from(new Set(degraded)).slice(0, 8),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

async function loadSchema(db) {
  const schema = new Map();
  for (const table of SAFE_TABLES) {
    try {
      const result = await db.prepare(`PRAGMA table_info(${table})`).all();
      const rows = Array.isArray(result?.results) ? result.results : [];
      schema.set(table, new Set(rows.map((row) => String(row?.name || '')).filter(Boolean)));
    } catch {
      schema.set(table, new Set());
    }
  }
  return schema;
}

function hasColumns(schema, table, columns) {
  const available = schema.get(table) || new Set();
  return columns.every((column) => available.has(column));
}

function hasTable(schema, table) {
  return (schema.get(table)?.size || 0) > 0;
}

async function totalMembersMetric(db, schema, degraded) {
  if (!hasTable(schema, 'calllink_profiles')) {
    degraded.push('members');
    return 0;
  }
  return safeScalar(db, `SELECT COUNT(*) AS value FROM calllink_profiles`, degraded, 'members');
}

async function newMembersMetric(db, schema, degraded) {
  if (!hasColumns(schema, 'calllink_profiles', ['created_at'])) {
    degraded.push('members_recent');
    return 0;
  }
  return safeScalar(
    db,
    `SELECT COUNT(*) AS value FROM calllink_profiles WHERE datetime(created_at) >= datetime('now', '-7 days')`,
    degraded,
    'members_recent',
  );
}

async function trialMembersMetric(db, schema, degraded) {
  if (!hasColumns(schema, 'billing_accounts', ['owner_id', 'trial_ends_at']) || !hasColumns(schema, 'calllink_profiles', ['owner_id'])) {
    degraded.push('trial');
    return 0;
  }

  let exclusion = '';
  if (hasColumns(schema, 'billing_subscriptions', ['owner_id', 'product_code', 'status', 'expires_at'])) {
    exclusion = `
      AND NOT EXISTS (
        SELECT 1 FROM billing_subscriptions s
        WHERE s.owner_id = b.owner_id
          AND s.product_code IN (${CALLTAG_PRODUCTS_SQL})
          AND s.status IN ('active','grace','cancelled')
          AND (COALESCE(s.expires_at, '') = '' OR datetime(s.expires_at) > datetime('now'))
      )`;
  }

  return safeScalar(db, `
    SELECT COUNT(*) AS value
    FROM billing_accounts b
    JOIN calllink_profiles p ON p.owner_id = b.owner_id
    WHERE datetime(b.trial_ends_at) > datetime('now')
    ${exclusion}
  `, degraded, 'trial');
}

async function activePaidMetric(db, schema, degraded) {
  if (!hasColumns(schema, 'billing_subscriptions', ['owner_id', 'product_code', 'status', 'expires_at']) || !hasColumns(schema, 'calllink_profiles', ['owner_id'])) {
    degraded.push('billing_active');
    return 0;
  }
  return safeScalar(db, `
    SELECT COUNT(DISTINCT s.owner_id) AS value
    FROM billing_subscriptions s
    JOIN calllink_profiles p ON p.owner_id = s.owner_id
    WHERE s.product_code IN (${CALLTAG_PRODUCTS_SQL})
      AND s.status IN ('active','grace','cancelled')
      AND (COALESCE(s.expires_at, '') = '' OR datetime(s.expires_at) > datetime('now'))
  `, degraded, 'billing_active');
}

async function paymentReviewMetric(db, schema, degraded) {
  if (!hasColumns(schema, 'billing_subscriptions', ['owner_id', 'product_code', 'status']) || !hasColumns(schema, 'calllink_profiles', ['owner_id'])) {
    degraded.push('billing_review');
    return 0;
  }
  const verification = hasColumns(schema, 'billing_subscriptions', ['verification_state'])
    ? `(COALESCE(s.verification_state, '') != 'verified' OR s.status = 'pending')`
    : `s.status = 'pending'`;
  return safeScalar(db, `
    SELECT COUNT(DISTINCT s.owner_id) AS value
    FROM billing_subscriptions s
    JOIN calllink_profiles p ON p.owner_id = s.owner_id
    WHERE s.product_code IN (${CALLTAG_PRODUCTS_SQL})
      AND ${verification}
  `, degraded, 'billing_review');
}

async function partnerPendingMetric(db, schema, degraded) {
  if (!hasColumns(schema, 'partner_commissions', ['subscription_id', 'status']) || !hasColumns(schema, 'billing_subscriptions', ['id', 'product_code'])) {
    degraded.push('partner');
    return 0;
  }
  return safeScalar(db, `
    SELECT COUNT(*) AS value
    FROM partner_commissions pc
    JOIN billing_subscriptions s ON s.id = pc.subscription_id
    WHERE s.product_code IN (${CALLTAG_PRODUCTS_SQL})
      AND pc.status IN ('estimated','confirmed')
  `, degraded, 'partner');
}

async function monthlyRevenueEstimate(db, schema, degraded) {
  const required = ['product_code', 'channel', 'status', 'expires_at', 'verification_state'];
  if (!hasColumns(schema, 'billing_subscriptions', required) || !hasColumns(schema, 'calllink_profiles', ['owner_id'])) {
    degraded.push('revenue_estimate');
    return emptyRevenueEstimate();
  }

  try {
    const result = await db.prepare(`
      SELECT s.product_code, s.channel, COUNT(*) AS subscription_count
      FROM billing_subscriptions s
      JOIN calllink_profiles p ON p.owner_id = s.owner_id
      WHERE s.product_code IN (${CALLTAG_PRODUCTS_SQL})
        AND s.status IN ('active','grace')
        AND s.verification_state = 'verified'
        AND (COALESCE(s.expires_at, '') = '' OR datetime(s.expires_at) > datetime('now'))
      GROUP BY s.product_code, s.channel
    `).all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    let grossMonthlyKrw = 0;
    let googlePlayGrossMonthlyKrw = 0;

    for (const row of rows) {
      const price = productPriceKrw(String(row?.product_code || ''));
      const count = Math.max(0, Math.trunc(Number(row?.subscription_count || 0)));
      const amount = price * count;
      grossMonthlyKrw += amount;
      if (String(row?.channel || '').toLowerCase() === 'google_play') googlePlayGrossMonthlyKrw += amount;
    }

    const googlePlayFeeEstimateKrw = Math.round(googlePlayGrossMonthlyKrw * PLAY_FEE_RATE);
    return {
      grossMonthlyKrw,
      googlePlayGrossMonthlyKrw,
      googlePlayFeeRatePercent: 15,
      googlePlayFeeEstimateKrw,
      netAfterPlayFeeEstimateKrw: Math.max(0, grossMonthlyKrw - googlePlayFeeEstimateKrw),
      basis: 'active_verified_subscription_list_price',
      exactSettlement: false,
    };
  } catch (error) {
    console.warn('calltag-admin-revenue-estimate-degraded', String(error?.message || 'query_failed').slice(0, 120));
    degraded.push('revenue_estimate');
    return emptyRevenueEstimate();
  }
}

function emptyRevenueEstimate() {
  return {
    grossMonthlyKrw: 0,
    googlePlayGrossMonthlyKrw: 0,
    googlePlayFeeRatePercent: 15,
    googlePlayFeeEstimateKrw: 0,
    netAfterPlayFeeEstimateKrw: 0,
    basis: 'active_verified_subscription_list_price',
    exactSettlement: false,
  };
}

async function recentCalltagMembers(db, schema, degraded) {
  if (!hasColumns(schema, 'calllink_profiles', ['owner_id'])) {
    degraded.push('member_list');
    return [];
  }

  const profile = schema.get('calllink_profiles') || new Set();
  const accounts = schema.get('billing_accounts') || new Set();
  const subscriptionsSchema = schema.get('billing_subscriptions') || new Set();

  const select = [
    'p.owner_id AS owner_id',
    profile.has('email') ? 'p.email AS email' : "'' AS email",
    profile.has('phone') ? 'p.phone AS phone' : "'' AS phone",
    profile.has('created_at') ? 'p.created_at AS created_at' : "'' AS created_at",
    profile.has('updated_at') ? 'p.updated_at AS updated_at' : "'' AS updated_at",
  ];

  let accountJoin = '';
  if (accounts.has('owner_id')) {
    accountJoin = 'LEFT JOIN billing_accounts b ON b.owner_id = p.owner_id';
    select.push(accounts.has('trial_ends_at') ? 'b.trial_ends_at AS trial_ends_at' : "'' AS trial_ends_at");
    select.push(accounts.has('referral_bonus_days') ? 'b.referral_bonus_days AS referral_bonus_days' : '0 AS referral_bonus_days');
  } else {
    select.push("'' AS trial_ends_at", '0 AS referral_bonus_days');
  }

  const orderBy = profile.has('created_at') ? 'datetime(p.created_at) DESC' : 'p.owner_id DESC';
  let rows = [];
  try {
    const result = await db.prepare(`
      SELECT ${select.join(',\n')}
      FROM calllink_profiles p
      ${accountJoin}
      ORDER BY ${orderBy}
      LIMIT 40
    `).all();
    rows = Array.isArray(result?.results) ? result.results : [];
  } catch (error) {
    console.warn('calltag-admin-member-list-degraded', String(error?.message || 'query_failed').slice(0, 120));
    degraded.push('member_list');
    try {
      const fallback = await db.prepare(`SELECT owner_id FROM calllink_profiles ORDER BY owner_id DESC LIMIT 40`).all();
      rows = (Array.isArray(fallback?.results) ? fallback.results : []).map((row) => ({ owner_id: row.owner_id }));
    } catch {
      rows = [];
    }
  }

  const subscriptionsByOwner = await recentMemberSubscriptions(db, rows, subscriptionsSchema, degraded);

  return rows.map((row) => {
    const subscriptions = subscriptionsByOwner.get(String(row.owner_id || '')) || [];
    return {
      ownerId: String(row.owner_id || '').slice(0, 120),
      email: maskEmail(row.email),
      phone: maskPhone(row.phone),
      createdAt: safeIso(row.created_at),
      updatedAt: safeIso(row.updated_at),
      trialEndsAt: safeIso(row.trial_ends_at),
      referralBonusDays: clampNumber(row.referral_bonus_days, 0, 31),
      subscriptions,
      subscription: subscriptions[0] || null,
    };
  });
}

async function recentMemberSubscriptions(db, memberRows, schemaColumns, degraded) {
  const resultMap = new Map();
  const ownerIds = memberRows.map((row) => String(row?.owner_id || '')).filter(Boolean).slice(0, 40);
  const required = ['owner_id', 'product_code', 'status'];
  if (!ownerIds.length || !required.every((column) => schemaColumns.has(column))) return resultMap;

  const placeholders = ownerIds.map(() => '?').join(',');
  const select = [
    'owner_id',
    'product_code',
    schemaColumns.has('channel') ? 'channel' : "'' AS channel",
    schemaColumns.has('status') ? 'status' : "'' AS status",
    schemaColumns.has('verification_state') ? 'verification_state' : "'' AS verification_state",
    schemaColumns.has('expires_at') ? 'expires_at' : "'' AS expires_at",
    schemaColumns.has('last_verified_at') ? 'last_verified_at' : "'' AS last_verified_at",
    schemaColumns.has('updated_at') ? 'updated_at' : "'' AS updated_at",
  ];
  const expiryFilter = schemaColumns.has('expires_at')
    ? `AND (COALESCE(expires_at, '') = '' OR datetime(expires_at) > datetime('now'))`
    : '';
  const orderBy = schemaColumns.has('updated_at')
    ? `CASE product_code WHEN 'all_monthly' THEN 0 WHEN 'call_monthly' THEN 1 ELSE 2 END, datetime(updated_at) DESC`
    : `CASE product_code WHEN 'all_monthly' THEN 0 WHEN 'call_monthly' THEN 1 ELSE 2 END`;

  try {
    const result = await db.prepare(`
      SELECT ${select.join(', ')}
      FROM billing_subscriptions
      WHERE owner_id IN (${placeholders})
        AND product_code IN (${CALLTAG_PRODUCTS_SQL})
        AND status IN ('active','grace','cancelled','pending','suspended')
        ${expiryFilter}
      ORDER BY owner_id, ${orderBy}
    `).bind(...ownerIds).all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    for (const row of rows) {
      const ownerId = String(row.owner_id || '');
      if (!ownerId) continue;
      const list = resultMap.get(ownerId) || [];
      list.push({
        productCode: String(row.product_code || '').slice(0, 80),
        channel: String(row.channel || '').slice(0, 32),
        status: String(row.status || '').slice(0, 32),
        verificationState: String(row.verification_state || '').slice(0, 32),
        expiresAt: safeIso(row.expires_at),
        lastVerifiedAt: safeIso(row.last_verified_at),
      });
      resultMap.set(ownerId, dedupeSubscriptions(list));
    }
  } catch (error) {
    console.warn('calltag-admin-member-subscriptions-degraded', String(error?.message || 'query_failed').slice(0, 120));
    degraded.push('member_subscriptions');
  }
  return resultMap;
}

function dedupeSubscriptions(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = `${item.productCode}:${item.channel}:${item.status}:${item.expiresAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output.slice(0, 6);
}

async function safeScalar(db, sql, degraded, component) {
  try {
    const row = await db.prepare(sql).first();
    return Math.max(0, Number(row?.value || 0));
  } catch (error) {
    console.warn(`calltag-admin-${component}-degraded`, String(error?.message || 'query_failed').slice(0, 120));
    degraded.push(component);
    return 0;
  }
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
