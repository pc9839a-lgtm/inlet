import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../_shared.js';
import { CALL_METHODS, callSession } from '../call/_shared.js';
import { getCalltagAdminEntitlement } from './_adminEntitlements.js';
import { googlePlayBillingReadiness } from './_readiness.js';
import { listSubscriptions, resolveEntitlement } from './_shared.js';
import { pruneMismatchedGoogleSubscriptions } from './google/_ownership.js';
import { resolveCallTagEntitlement } from './trial-policy.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_SUBSCRIPTION_STATES = new Set(['active', 'grace', 'cancelled']);
const PHONE_PRODUCT = 'call_monthly';
const MESSAGE_PRODUCT = 'message_monthly';
const BUNDLE_PRODUCT = 'all_monthly';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, CALL_METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(request, env, 405, {
      ok: false,
      error: '허용되지 않는 요청 방식입니다.',
    }, CALL_METHODS);
  }
  try {
    const db = assertD1(env);
    const session = await callSession(request, env);
    const serverNow = new Date();
    const productClient = String(request.headers.get('X-Pagero-Product') || '').trim().toLowerCase();

    if (productClient === 'calltag') {
      try {
        await pruneMismatchedGoogleSubscriptions(
          env,
          db,
          session.ownerId,
          session.profile?.email || session.user?.email || '',
        );
      } catch (error) {
        // Ownership cleanup is fail-open for transient Google/API errors; a mismatch is
        // only removed after Google explicitly proves it belongs to a different account.
        console.warn('calltag google ownership cleanup skipped', {
          code: String(error?.details?.code || error?.message || 'PLAY_OWNERSHIP_CLEANUP_FAILED').slice(0, 120),
        });
      }
    }

    const entitlement = productClient === 'calltag'
      ? await resolveCallTagEntitlement(db, session.ownerId)
      : await resolveEntitlement(db, session.ownerId);

    let adminGrant = null;
    if (productClient === 'calltag') {
      adminGrant = await getCalltagAdminEntitlement(db, session.ownerId, { activeOnly: true });
      if (adminGrant) applyCallTagAdminGrant(entitlement, adminGrant, serverNow.getTime());
      const subscriptions = await listSubscriptions(db, session.ownerId);
      applyCallTagProductState(entitlement, subscriptions, serverNow.getTime(), adminGrant);
    }

    entitlement.serverNow = serverNow.toISOString();
    entitlement.billingAvailability = {
      googlePlay: googlePlayBillingReadiness(env),
    };
    entitlement.featureAccess = featureAccess(entitlement);
    entitlement.notice = lifecycleNotice(entitlement, serverNow.getTime());
    return jsonResponse(request, env, 200, {
      ok: true,
      serverNow: serverNow.toISOString(),
      entitlement,
    }, CALL_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, CALL_METHODS);
  }
}

function applyCallTagAdminGrant(entitlement = {}, grant = {}, now = Date.now()) {
  if (grant?.active !== true) return;
  entitlement.adminGrant = {
    active: true,
    status: 'active',
    scope: String(grant.scope || 'all'),
    startsAt: String(grant.startsAt || ''),
    expiresAt: String(grant.expiresAt || ''),
    note: String(grant.note || ''),
    grantedAt: String(grant.grantedAt || ''),
  };

  // Paid subscriptions and an active trial keep their existing top-level lifecycle.
  // The admin grant is additive and becomes the primary lifecycle only when neither
  // paid access nor trial access is currently active.
  if (entitlement.active === true) return;

  const productCode = grant.scope === 'call'
    ? PHONE_PRODUCT
    : grant.scope === 'message'
      ? MESSAGE_PRODUCT
      : BUNDLE_PRODUCT;
  const expiresAt = String(grant.expiresAt || '');
  const expiresMs = Date.parse(expiresAt);
  entitlement.active = true;
  entitlement.status = 'active';
  entitlement.productCode = productCode;
  entitlement.plan = productCode;
  entitlement.scope = String(grant.scope || 'all');
  entitlement.channel = 'admin';
  entitlement.billingSource = 'admin';
  entitlement.source = 'admin_grant';
  entitlement.startsAt = String(grant.startsAt || '');
  entitlement.endsAt = expiresAt;
  entitlement.expiresAt = expiresAt;
  entitlement.nextBillingAt = '';
  entitlement.remainingDays = Number.isFinite(expiresMs)
    ? Math.max(0, Math.ceil((expiresMs - now) / DAY_MS))
    : 0;
  entitlement.subscription = null;
}

function applyCallTagProductState(entitlement = {}, subscriptions = [], now = Date.now(), adminGrant = null) {
  const current = (Array.isArray(subscriptions) ? subscriptions : []).filter((item) => {
    const status = String(item?.status || '').trim().toLowerCase();
    if (!ACTIVE_SUBSCRIPTION_STATES.has(status)) return false;
    const expiresAt = Date.parse(String(item?.expiresAt || ''));
    return !Number.isFinite(expiresAt) || expiresAt > now;
  });

  const bundle = current.find((item) => item.productCode === BUNDLE_PRODUCT) || null;
  const paidPhone = bundle || current.find((item) => item.productCode === PHONE_PRODUCT) || null;
  const paidMessage = bundle || current.find((item) => item.productCode === MESSAGE_PRODUCT) || null;
  const grantPhone = adminGrant?.active === true && ['call', 'all'].includes(String(adminGrant.scope || ''));
  const grantMessage = adminGrant?.active === true && ['message', 'all'].includes(String(adminGrant.scope || ''));
  const phone = paidPhone || (grantPhone ? adminProductState(adminGrant) : null);
  const message = paidMessage || (grantMessage ? adminProductState(adminGrant) : null);
  const activeProducts = [];
  if (phone) activeProducts.push(PHONE_PRODUCT);
  if (message) activeProducts.push(MESSAGE_PRODUCT);

  const activeWeb = current.some((item) => item.channel === 'web');
  entitlement.activeProducts = activeProducts;
  entitlement.productAccess = {
    [PHONE_PRODUCT]: productState(phone),
    [MESSAGE_PRODUCT]: productState(message),
  };
  entitlement.purchaseOptions = {
    [PHONE_PRODUCT]: {
      available: !activeWeb && !phone,
      reason: activeWeb
        ? 'WEB_SUBSCRIPTION_ACTIVE'
        : paidPhone
          ? 'PRODUCT_ALREADY_ACTIVE'
          : grantPhone ? 'ADMIN_ENTITLEMENT_ACTIVE' : '',
    },
    [MESSAGE_PRODUCT]: {
      available: !activeWeb && !message,
      reason: activeWeb
        ? 'WEB_SUBSCRIPTION_ACTIVE'
        : paidMessage
          ? 'PRODUCT_ALREADY_ACTIVE'
          : grantMessage ? 'ADMIN_ENTITLEMENT_ACTIVE' : '',
    },
  };

  // A Google Play subscription for one CallTag product must not block the other product.
  // Web subscriptions still block Play purchases to prevent cross-channel duplicate billing.
  entitlement.purchaseBlocked = activeWeb;
  entitlement.purchaseBlockReason = activeWeb ? 'WEB_SUBSCRIPTION_ACTIVE' : '';
  entitlement.purchase = {
    blocked: activeWeb,
    reason: activeWeb ? 'WEB_SUBSCRIPTION_ACTIVE' : '',
  };
}

function adminProductState(grant = {}) {
  return {
    status: 'active',
    channel: 'admin',
    nextBillingAt: '',
    expiresAt: String(grant.expiresAt || ''),
    autoRenewing: false,
  };
}

function productState(subscription) {
  if (!subscription) {
    return {
      active: false,
      status: 'inactive',
      channel: 'none',
      nextBillingAt: '',
      expiresAt: '',
      autoRenewing: false,
    };
  }
  return {
    active: true,
    status: String(subscription.status || 'active'),
    channel: String(subscription.channel || 'none'),
    nextBillingAt: String(subscription.nextBillingAt || ''),
    expiresAt: String(subscription.expiresAt || ''),
    autoRenewing: subscription.autoRenewing === true,
  };
}

function featureAccess(entitlement = {}) {
  const active = entitlement.active === true;
  const status = String(entitlement.status || 'inactive');
  const trial = active && status === 'trial';
  const products = new Set(Array.isArray(entitlement.activeProducts) ? entitlement.activeProducts : []);
  const product = String(entitlement.productCode || entitlement.plan || BUNDLE_PRODUCT);
  const bundle = product === BUNDLE_PRODUCT && active;
  return {
    customerDataRead: true,
    customerDataWrite: true,
    consultationHistoryRead: true,
    callManagement: trial || bundle || products.has(PHONE_PRODUCT),
    messageAutomation: trial || bundle || products.has(MESSAGE_PRODUCT),
  };
}

function lifecycleNotice(entitlement = {}, now = Date.now()) {
  const endsAt = Date.parse(String(entitlement.endsAt || entitlement.expiresAt || ''));
  const active = entitlement.active === true;
  const status = String(entitlement.status || 'inactive');
  const trial = status === 'trial' || String(entitlement.source || '') === 'trial';
  const adminAllEndsAt = entitlement.adminGrant?.active === true && entitlement.adminGrant?.scope === 'all'
    ? Date.parse(String(entitlement.adminGrant.expiresAt || ''))
    : 0;

  if (trial && active && Number.isFinite(endsAt)) {
    const remainingMs = endsAt - now;
    const coveredByAdminGrant = Number.isFinite(adminAllEndsAt) && adminAllEndsAt > endsAt;
    if (!coveredByAdminGrant && remainingMs > 0 && remainingMs <= DAY_MS) {
      return {
        code: 'TRIAL_ENDING_24H',
        severity: 'warning',
        title: '무료 이용이 곧 종료됩니다.',
        message: '종료 후에도 고객·상담 기록은 그대로 보관되며 통화 후 정리와 문자 자동화만 중지됩니다.',
      };
    }
  }

  if (!active && Number.isFinite(endsAt) && endsAt <= now) {
    return {
      code: 'TRIAL_EXPIRED',
      severity: 'action',
      title: '무료 이용이 종료되었습니다.',
      message: '고객·상담 기록은 그대로 보관됩니다. 이용권을 시작하면 통화 후 정리와 문자 자동화를 다시 사용할 수 있습니다.',
    };
  }

  return { code: 'NONE', severity: 'none', title: '', message: '' };
}
