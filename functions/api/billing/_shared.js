const PRODUCT_CODES = new Set([
  'pagero_monthly',
  'call_monthly',
  'message_monthly',
  'all_monthly',
]);
const CALLTAG_PRODUCT_CODES = new Set(['call_monthly', 'message_monthly']);
const ACTIVE_STATES = new Set(['active', 'grace', 'cancelled']);
const TRIAL_BASE_DAYS = 3;
const REFERRAL_BONUS_DAYS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
let cachedPlayAccessToken = '';
let cachedPlayAccessTokenExpiresAt = 0;

export function billingError(message, status = 400, code = 'BILLING_ERROR', extra = {}) {
  const error = new Error(message);
  error.status = status;
  error.details = { code, ...extra };
  return error;
}

export async function ensureBillingSchema(db) {
  if (!db?.prepare) throw billingError('결제 저장소가 연결되지 않았습니다.', 503, 'BILLING_DB_REQUIRED');
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS billing_accounts (
      owner_id TEXT PRIMARY KEY,
      trial_started_at TEXT NOT NULL,
      trial_ends_at TEXT NOT NULL,
      referral_bonus_days INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS billing_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id TEXT NOT NULL,
      product_code TEXT NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      external_subscription_id TEXT NOT NULL DEFAULT '',
      purchase_token_hash TEXT NOT NULL DEFAULT '',
      order_id TEXT NOT NULL DEFAULT '',
      started_at TEXT NOT NULL DEFAULT '',
      next_billing_at TEXT NOT NULL DEFAULT '',
      expires_at TEXT NOT NULL DEFAULT '',
      auto_renewing INTEGER NOT NULL DEFAULT 0,
      verification_state TEXT NOT NULL DEFAULT 'pending',
      last_verified_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(channel, purchase_token_hash)
    )
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_owner_status
    ON billing_subscriptions(owner_id, status, expires_at DESC)
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS referral_codes (
      owner_id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_owner_id TEXT NOT NULL,
      referred_owner_id TEXT NOT NULL UNIQUE,
      referral_code TEXT NOT NULL,
      bonus_days INTEGER NOT NULL DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'applied',
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      first_paid_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK(referrer_owner_id != referred_owner_id)
    )
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_referrals_referrer_status
    ON referrals(referrer_owner_id, status, applied_at DESC)
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS partner_commissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_owner_id TEXT NOT NULL,
      referred_owner_id TEXT NOT NULL,
      subscription_id INTEGER,
      payment_reference TEXT NOT NULL DEFAULT '',
      base_amount_krw INTEGER NOT NULL DEFAULT 0,
      commission_amount_krw INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'estimated',
      earned_month TEXT NOT NULL DEFAULT '',
      confirmed_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(payment_reference)
    )
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_partner_commissions_referrer_month
    ON partner_commissions(referrer_owner_id, earned_month, status)
  `).run();
}

export async function ensureBillingAccount(db, ownerId = '') {
  await ensureBillingSchema(db);
  const safeOwnerId = text(ownerId, 120);
  if (!safeOwnerId) throw billingError('로그인이 필요합니다.', 401, 'BILLING_SESSION_REQUIRED');
  const now = new Date();
  const trialEnds = new Date(now.getTime() + TRIAL_BASE_DAYS * DAY_MS);
  await db.prepare(`
    INSERT OR IGNORE INTO billing_accounts (
      owner_id, trial_started_at, trial_ends_at, referral_bonus_days, created_at, updated_at
    ) VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(safeOwnerId, now.toISOString(), trialEnds.toISOString()).run();
  return db.prepare(`
    SELECT owner_id, trial_started_at, trial_ends_at, referral_bonus_days, created_at, updated_at
    FROM billing_accounts WHERE owner_id = ? LIMIT 1
  `).bind(safeOwnerId).first();
}

export async function resolveEntitlement(db, ownerId = '') {
  const account = await ensureBillingAccount(db, ownerId);
  const rows = await db.prepare(`
    SELECT id, owner_id, product_code, channel, status, external_subscription_id,
           order_id, started_at, next_billing_at, expires_at, auto_renewing,
           verification_state, last_verified_at, created_at, updated_at
    FROM billing_subscriptions
    WHERE owner_id = ?
      AND product_code IN ('call_monthly', 'message_monthly', 'all_monthly')
      AND status IN ('active', 'grace', 'cancelled')
      AND (expires_at = '' OR julianday(expires_at) > julianday('now'))
    ORDER BY
      CASE product_code WHEN 'all_monthly' THEN 0 WHEN 'call_monthly' THEN 1 ELSE 2 END,
      CASE channel WHEN 'web' THEN 0 WHEN 'google_play' THEN 1 ELSE 2 END,
      updated_at DESC
  `).bind(text(ownerId, 120)).all();
  const active = Array.isArray(rows?.results) ? rows.results : [];
  let selected = active[0] || null;
  const hasCall = active.some((item) => item.product_code === 'call_monthly');
  const hasMessage = active.some((item) => item.product_code === 'message_monthly');
  if (!selected && hasCall && hasMessage) selected = {
    product_code: 'all_monthly',
    channel: 'mixed',
    status: 'active',
    started_at: '',
    next_billing_at: '',
    expires_at: '',
    updated_at: '',
  };

  const trialStartedAt = iso(account?.trial_started_at);
  const trialEndsAt = iso(account?.trial_ends_at);
  const bonusDays = clampInt(account?.referral_bonus_days, 0, REFERRAL_BONUS_DAYS);
  const trialRemaining = remainingDays(trialEndsAt);
  const trialActive = !selected && trialRemaining > 0;
  const productCode = selected?.product_code || 'all_monthly';
  const channel = selected?.channel || 'none';
  const activePaid = !!selected;
  const status = activePaid
    ? normalizeSubscriptionState(selected.status)
    : trialActive ? 'trial' : 'inactive';
  const blocked = activePaid;
  const blockReason = selected
    ? channel === 'web'
      ? 'WEB_SUBSCRIPTION_ACTIVE'
      : 'ACTIVE_SUBSCRIPTION_EXISTS'
    : '';

  return {
    active: activePaid || trialActive,
    status,
    productCode,
    plan: productCode,
    scope: productCode === 'call_monthly'
      ? 'call'
      : productCode === 'message_monthly'
        ? 'message'
        : 'all',
    channel,
    billingSource: channel,
    source: activePaid ? channel : 'trial',
    startsAt: activePaid ? iso(selected.started_at) : trialStartedAt,
    endsAt: activePaid ? iso(selected.expires_at) : trialEndsAt,
    expiresAt: activePaid ? iso(selected.expires_at) : trialEndsAt,
    nextBillingAt: activePaid ? iso(selected.next_billing_at) : '',
    remainingDays: activePaid ? remainingDays(selected.expires_at) : trialRemaining,
    purchaseBlocked: blocked,
    purchaseBlockReason: blockReason,
    purchase: { blocked, reason: blockReason },
    trial: {
      active: trialActive,
      scope: 'all',
      baseDays: TRIAL_BASE_DAYS,
      referralBonusDays: bonusDays,
      startsAt: trialStartedAt,
      endsAt: trialEndsAt,
      remainingDays: trialRemaining,
    },
    subscription: selected ? subscriptionPublic(selected) : null,
  };
}

export async function listSubscriptions(db, ownerId = '') {
  await ensureBillingAccount(db, ownerId);
  const rows = await db.prepare(`
    SELECT id, owner_id, product_code, channel, status, external_subscription_id,
           order_id, started_at, next_billing_at, expires_at, auto_renewing,
           verification_state, last_verified_at, created_at, updated_at
    FROM billing_subscriptions
    WHERE owner_id = ?
    ORDER BY updated_at DESC, id DESC
    LIMIT 50
  `).bind(text(ownerId, 120)).all();
  return (Array.isArray(rows?.results) ? rows.results : []).map(subscriptionPublic);
}

export async function ensureReferralCode(db, ownerId = '') {
  await ensureBillingAccount(db, ownerId);
  const safeOwnerId = text(ownerId, 120);
  const existing = await db.prepare(`
    SELECT owner_id, code, created_at, updated_at
    FROM referral_codes WHERE owner_id = ? LIMIT 1
  `).bind(safeOwnerId).first();
  if (existing?.code) return referralCodePublic(existing);
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomReferralCode();
    try {
      await db.prepare(`
        INSERT INTO referral_codes (owner_id, code, created_at, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(safeOwnerId, code).run();
      return referralCodePublic({ owner_id: safeOwnerId, code });
    } catch (error) {
      if (!String(error?.message || '').toLowerCase().includes('unique')) throw error;
    }
  }
  throw billingError('추천인 코드를 만들지 못했습니다.', 503, 'REFERRAL_CODE_GENERATION_FAILED');
}

export async function referralMe(db, ownerId = '') {
  const mine = await ensureReferralCode(db, ownerId);
  const applied = await db.prepare(`
    SELECT referral_code, bonus_days, status, applied_at
    FROM referrals WHERE referred_owner_id = ? LIMIT 1
  `).bind(text(ownerId, 120)).first();
  return {
    mine,
    code: mine.code,
    shareUrl: mine.shareUrl,
    applied: !!applied,
    appliedCode: text(applied?.referral_code, 20),
    bonusDays: Number(applied?.bonus_days || 0),
    appliedAt: iso(applied?.applied_at),
  };
}

export async function applyReferralCode(db, ownerId = '', rawCode = '') {
  await ensureBillingAccount(db, ownerId);
  const safeOwnerId = text(ownerId, 120);
  const code = normalizeReferralCode(rawCode);
  if (!code) throw billingError('추천인 코드를 정확히 입력해주세요.', 400, 'REFERRAL_CODE_REQUIRED');
  const existing = await db.prepare(`
    SELECT id FROM referrals WHERE referred_owner_id = ? LIMIT 1
  `).bind(safeOwnerId).first();
  if (existing) throw billingError('이미 추천인 등록을 완료했습니다.', 409, 'REFERRAL_ALREADY_APPLIED');
  const paid = await db.prepare(`
    SELECT id FROM billing_subscriptions
    WHERE owner_id = ? AND verification_state = 'verified'
      AND status IN ('active', 'grace', 'cancelled', 'expired')
    LIMIT 1
  `).bind(safeOwnerId).first();
  if (paid) throw billingError('첫 유료 결제 이후에는 추천인 코드를 등록할 수 없습니다.', 409, 'PAID_CONVERSION_COMPLETED');
  const referrer = await db.prepare(`
    SELECT owner_id, code FROM referral_codes WHERE code = ? LIMIT 1
  `).bind(code).first();
  if (!referrer?.owner_id) throw billingError('존재하지 않는 추천인 코드입니다.', 404, 'REFERRAL_CODE_NOT_FOUND');
  if (String(referrer.owner_id) === safeOwnerId) {
    throw billingError('본인 추천인 코드는 등록할 수 없습니다.', 409, 'SELF_REFERRAL');
  }

  const account = await ensureBillingAccount(db, safeOwnerId);
  const started = Date.parse(String(account?.trial_started_at || '')) || Date.now();
  const extendedEnds = new Date(started + (TRIAL_BASE_DAYS + REFERRAL_BONUS_DAYS) * DAY_MS).toISOString();
  await db.batch([
    db.prepare(`
      INSERT INTO referrals (
        referrer_owner_id, referred_owner_id, referral_code, bonus_days,
        status, applied_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'applied', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(String(referrer.owner_id), safeOwnerId, code, REFERRAL_BONUS_DAYS),
    db.prepare(`
      UPDATE billing_accounts
      SET referral_bonus_days = ?, trial_ends_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE owner_id = ?
    `).bind(REFERRAL_BONUS_DAYS, extendedEnds, safeOwnerId),
  ]);
  return {
    ...(await referralMe(db, safeOwnerId)),
    entitlement: await resolveEntitlement(db, safeOwnerId),
  };
}

export async function referralSummary(db, ownerId = '') {
  await ensureBillingAccount(db, ownerId);
  const safeOwnerId = text(ownerId, 120);
  const counts = await db.prepare(`
    SELECT
      COUNT(*) AS referred_count,
      SUM(CASE WHEN EXISTS (
        SELECT 1 FROM billing_subscriptions s
        WHERE s.owner_id = referrals.referred_owner_id
          AND s.verification_state = 'verified'
          AND s.status IN ('active', 'grace', 'cancelled')
          AND (s.expires_at = '' OR julianday(s.expires_at) > julianday('now'))
      ) THEN 1 ELSE 0 END) AS active_paid_count
    FROM referrals
    WHERE referrer_owner_id = ?
  `).bind(safeOwnerId).first();
  const month = new Date().toISOString().slice(0, 7);
  const revenue = await db.prepare(`
    SELECT
      SUM(CASE WHEN earned_month = ? AND status IN ('estimated', 'confirmed')
        THEN commission_amount_krw ELSE 0 END) AS estimated_revenue,
      SUM(CASE WHEN status = 'confirmed'
        THEN commission_amount_krw ELSE 0 END) AS confirmed_revenue
    FROM partner_commissions
    WHERE referrer_owner_id = ?
  `).bind(month, safeOwnerId).first();
  return {
    referredCount: Number(counts?.referred_count || 0),
    activePaidCount: Number(counts?.active_paid_count || 0),
    estimatedRevenueKrw: Number(revenue?.estimated_revenue || 0),
    confirmedRevenueKrw: Number(revenue?.confirmed_revenue || 0),
    partnerCenterUrl: 'https://pagero.kr/partner',
  };
}

export async function verifyGoogleSubscription(env = {}, db, ownerId = '', input = {}) {
  await ensureBillingAccount(db, ownerId);
  const packageName = text(input.packageName, 200);
  const productId = text(input.productId, 120);
  const purchaseToken = text(input.purchaseToken, 4096);
  if (packageName !== 'kr.pagero.calltag') {
    throw billingError('앱 결제정보가 올바르지 않습니다.', 400, 'PLAY_PACKAGE_INVALID');
  }
  if (!CALLTAG_PRODUCT_CODES.has(productId)) {
    throw billingError('지원하지 않는 구독 상품입니다.', 400, 'PLAY_PRODUCT_INVALID');
  }
  if (!purchaseToken) throw billingError('구매 확인정보가 없습니다.', 400, 'PLAY_TOKEN_REQUIRED');
  if (!playConfigured(env)) {
    throw billingError('Google Play 결제 검증 설정이 필요합니다.', 503, 'PLAY_VERIFICATION_NOT_CONFIGURED');
  }

  const purchase = await googlePlaySubscription(env, packageName, purchaseToken);
  const lineItems = Array.isArray(purchase?.lineItems) ? purchase.lineItems : [];
  const matched = lineItems.find((item) => text(item?.productId, 120) === productId);
  if (!matched) throw billingError('구매 상품이 일치하지 않습니다.', 409, 'PLAY_PRODUCT_MISMATCH');
  const mapped = mapPlayState(purchase?.subscriptionState);
  const expiresAt = iso(matched?.expiryTime);
  const active = ACTIVE_STATES.has(mapped) && (!expiresAt || Date.parse(expiresAt) > Date.now());
  if (!active && mapped !== 'pending') {
    throw billingError('활성 상태의 Google Play 구독이 아닙니다.', 409, 'PLAY_SUBSCRIPTION_INACTIVE', { state: mapped });
  }

  const tokenHash = await sha256(purchaseToken);
  const conflict = await db.prepare(`
    SELECT id, channel, product_code FROM billing_subscriptions
    WHERE owner_id = ? AND channel != 'google_play'
      AND status IN ('active', 'grace', 'cancelled')
      AND (expires_at = '' OR julianday(expires_at) > julianday('now'))
    LIMIT 1
  `).bind(text(ownerId, 120)).first();
  if (conflict) {
    throw billingError('다른 결제 경로에서 이미 구독 중입니다.', 409, 'DUPLICATE_CHANNEL_SUBSCRIPTION');
  }

  const startedAt = iso(purchase?.startTime);
  const autoRenewing = matched?.autoRenewingPlan?.autoRenewEnabled ? 1 : 0;
  const externalId = text(purchase?.latestOrderId || input.orderId, 240);
  await db.prepare(`
    INSERT INTO billing_subscriptions (
      owner_id, product_code, channel, status, external_subscription_id,
      purchase_token_hash, order_id, started_at, next_billing_at, expires_at,
      auto_renewing, verification_state, last_verified_at, created_at, updated_at
    ) VALUES (?, ?, 'google_play', ?, ?, ?, ?, ?, ?, ?, ?, 'verified', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(channel, purchase_token_hash) DO UPDATE SET
      owner_id = excluded.owner_id,
      product_code = excluded.product_code,
      status = excluded.status,
      external_subscription_id = excluded.external_subscription_id,
      order_id = excluded.order_id,
      started_at = excluded.started_at,
      next_billing_at = excluded.next_billing_at,
      expires_at = excluded.expires_at,
      auto_renewing = excluded.auto_renewing,
      verification_state = 'verified',
      last_verified_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    text(ownerId, 120), productId, mapped, externalId, tokenHash, externalId,
    startedAt, expiresAt, expiresAt, autoRenewing
  ).run();

  if (purchase?.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING' && active) {
    await acknowledgeGoogleSubscription(env, packageName, productId, purchaseToken);
  }
  return resolveEntitlement(db, ownerId);
}

export async function restoreGoogleSubscriptions(env = {}, db, ownerId = '', purchases = []) {
  const list = Array.isArray(purchases) ? purchases.slice(0, 10) : [];
  if (!list.length) throw billingError('복원할 구매 내역이 없습니다.', 400, 'PLAY_RESTORE_EMPTY');
  let verified = 0;
  let lastError = null;
  for (const item of list) {
    const products = Array.isArray(item?.products) ? item.products : [];
    for (const productId of products.slice(0, 3)) {
      try {
        await verifyGoogleSubscription(env, db, ownerId, {
          packageName: 'kr.pagero.calltag',
          productId,
          purchaseToken: item?.purchaseToken,
          orderId: item?.orderId,
        });
        verified++;
        break;
      } catch (error) {
        lastError = error;
      }
    }
  }
  if (!verified && lastError) throw lastError;
  return resolveEntitlement(db, ownerId);
}

export function playConfigured(env = {}) {
  return !!(text(env.GOOGLE_PLAY_CLIENT_EMAIL, 300) && text(env.GOOGLE_PLAY_PRIVATE_KEY, 12000));
}

function subscriptionPublic(row = {}) {
  return {
    id: Number(row.id || 0),
    productCode: text(row.product_code, 120),
    channel: text(row.channel, 40),
    status: normalizeSubscriptionState(row.status),
    externalSubscriptionId: text(row.external_subscription_id, 240),
    orderId: text(row.order_id, 240),
    startsAt: iso(row.started_at),
    nextBillingAt: iso(row.next_billing_at),
    expiresAt: iso(row.expires_at),
    autoRenewing: Number(row.auto_renewing || 0) === 1,
    verificationState: text(row.verification_state, 40),
    lastVerifiedAt: iso(row.last_verified_at),
    updatedAt: iso(row.updated_at),
  };
}

function referralCodePublic(row = {}) {
  const code = normalizeReferralCode(row.code);
  return {
    code,
    shareUrl: code ? `https://pagero.kr/?ref=${encodeURIComponent(code)}` : '',
    createdAt: iso(row.created_at),
  };
}

async function googlePlaySubscription(env, packageName, purchaseToken) {
  const token = await googlePlayAccessToken(env);
  let response;
  try {
    response = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }
    );
  } catch (error) {
    throw billingError('Google Play 구매 확인 서버에 연결하지 못했습니다.', 502, 'PLAY_VERIFICATION_NETWORK_FAILED');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw billingError('Google Play 구매를 확인하지 못했습니다.', 502, 'PLAY_VERIFICATION_FAILED', {
      googleStatus: Number(response.status || 0),
    });
  }
  return body;
}

async function acknowledgeGoogleSubscription(env, packageName, productId, purchaseToken) {
  const token = await googlePlayAccessToken(env);
  let response;
  try {
    response = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    );
  } catch (error) {
    throw billingError('Google Play 구매 승인 서버에 연결하지 못했습니다.', 502, 'PLAY_ACKNOWLEDGE_NETWORK_FAILED');
  }
  if (!response.ok) {
    throw billingError('Google Play 구매 승인을 완료하지 못했습니다.', 502, 'PLAY_ACKNOWLEDGE_FAILED', {
      googleStatus: Number(response.status || 0),
    });
  }
}

async function googlePlayAccessToken(env = {}) {
  if (cachedPlayAccessToken && cachedPlayAccessTokenExpiresAt > Date.now() + 60000) {
    return cachedPlayAccessToken;
  }
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signedJwt(env, {
    iss: text(env.GOOGLE_PLAY_CLIENT_EMAIL, 300),
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  let response;
  try {
    response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
  } catch (error) {
    throw billingError('Google Play 인증 서버에 연결하지 못했습니다.', 503, 'PLAY_AUTH_NETWORK_FAILED');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    throw billingError('Google Play 인증에 실패했습니다.', 503, 'PLAY_AUTH_FAILED', {
      googleStatus: Number(response.status || 0),
    });
  }
  cachedPlayAccessToken = String(body.access_token);
  cachedPlayAccessTokenExpiresAt = Date.now() + Math.max(60, Number(body.expires_in || 3600)) * 1000;
  return cachedPlayAccessToken;
}

async function signedJwt(env, payload) {
  const header = base64UrlJson({ alg: 'RS256', typ: 'JWT' });
  const body = base64UrlJson(payload);
  const unsigned = `${header}.${body}`;
  const key = await importPrivateKey(String(env.GOOGLE_PLAY_PRIVATE_KEY || ''));
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(unsigned)
  );
  return `${unsigned}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function importPrivateKey(value = '') {
  const pem = String(value || '').replace(/\\n/g, '\n');
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  if (!base64) throw billingError('Google Play 비공개 키가 없습니다.', 503, 'PLAY_PRIVATE_KEY_REQUIRED');
  const binary = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    binary,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

function base64UrlJson(value) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function mapPlayState(value = '') {
  const state = String(value || '').toUpperCase();
  if (state.includes('IN_GRACE_PERIOD')) return 'grace';
  if (state.includes('ACTIVE')) return 'active';
  if (state.includes('CANCELED')) return 'cancelled';
  if (state.includes('EXPIRED')) return 'expired';
  if (state.includes('PENDING')) return 'pending';
  if (state.includes('ON_HOLD') || state.includes('PAUSED')) return 'suspended';
  return 'pending';
}

function normalizeSubscriptionState(value = '') {
  const state = String(value || '').trim().toLowerCase();
  return ['pending', 'active', 'grace', 'cancelled', 'expired', 'suspended', 'refunded'].includes(state)
    ? state
    : 'pending';
}

function remainingDays(value = '') {
  const end = Date.parse(String(value || ''));
  if (!end || end <= Date.now()) return 0;
  return Math.ceil((end - Date.now()) / DAY_MS);
}

function randomReferralCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(7);
  crypto.getRandomValues(bytes);
  let value = '';
  for (const byte of bytes) value += alphabet[byte % alphabet.length];
  return value;
}

function normalizeReferralCode(value = '') {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function iso(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : raw;
}

function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}
