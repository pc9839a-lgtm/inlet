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
const SAFE_TABLES = new Set([
  'calllink_profiles',
  'billing_accounts',
  'billing_subscriptions',
  'partner_commissions',
]);

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return adminOptions();
  if (request.method !== 'GET') return adminJson(405, { ok: false, error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });

  try {
    if (!env.DB?.prepare) return adminJson(503, { ok: false, error: '관리자 저장소가 연결되지 않았습니다.', code: 'CALLTAG_ADMIN_DB_REQUIRED' });
    const identity = await requireCalltagAdmin(request, env);

    // Production D1 may temporarily be one migration behind the application.
    // Introspect only fixed, allow-listed table names so one missing billing
    // column never takes down the whole backoffice overview.
    const schema = await loadSchema(env.DB);
    const degraded = [];

    const totalMembers = await totalMembersMetric(env.DB, schema, degraded);
    const newMembers7d = await newMembersMetric(env.DB, schema, degraded);
    const trialMembers = await trialMembersMetric(env.DB, schema, degraded);
    const activePaid = await activePaidMetric(env.DB, schema, degraded);
    const paymentReview = await paymentReviewMetric(env.DB, schema, degraded);
    const partnerPending = await partnerPendingMetric(env.DB, schema, degraded);
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
      recentMembers,
      // Only coarse component names are returned; SQL/schema details stay server-side.
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

async function recentCalltagMembers(db, schema, degraded) {
  if (!hasColumns(schema, 'calllink_profiles', ['owner_id'])) {
    degraded.push('member_list');
    return [];
  }

  const profile = schema.get('calllink_profiles') || new Set();
  const accounts = schema.get('billing_accounts') || new Set();
  const subscriptions = schema.get('billing_subscriptions') || new Set();

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

  let subscriptionJoin = '';
  const canJoinSubscription = ['id', 'owner_id', 'product_code'].every((column) => subscriptions.has(column));
  if (canJoinSubscription) {
    const order = subscriptions.has('updated_at') ? 'datetime(s2.updated_at) DESC, s2.id DESC' : 's2.id DESC';
    subscriptionJoin = `LEFT JOIN billing_subscriptions s ON s.id = (
      SELECT s2.id
      FROM billing_subscriptions s2
      WHERE s2.owner_id = p.owner_id
        AND s2.product_code IN (${CALLTAG_PRODUCTS_SQL})
      ORDER BY ${order}
      LIMIT 1
    )`;
    select.push(
      's.product_code AS product_code',
      subscriptions.has('channel') ? 's.channel AS channel' : "'' AS channel",
      subscriptions.has('status') ? 's.status AS subscription_status' : "'' AS subscription_status",
      subscriptions.has('verification_state') ? 's.verification_state AS verification_state' : "'' AS verification_state",
      subscriptions.has('expires_at') ? 's.expires_at AS expires_at' : "'' AS expires_at",
      subscriptions.has('last_verified_at') ? 's.last_verified_at AS last_verified_at' : "'' AS last_verified_at",
    );
  } else {
    select.push(
      "'' AS product_code",
      "'' AS channel",
      "'' AS subscription_status",
      "'' AS verification_state",
      "'' AS expires_at",
      "'' AS last_verified_at",
    );
  }

  const orderBy = profile.has('created_at') ? 'datetime(p.created_at) DESC' : 'p.owner_id DESC';
  let rows = [];
  try {
    const result = await db.prepare(`
      SELECT ${select.join(',\n')}
      FROM calllink_profiles p
      ${accountJoin}
      ${subscriptionJoin}
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
