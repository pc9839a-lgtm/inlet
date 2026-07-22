const PLAN_ALIASES = {
  free: 'free',
  trial: 'free',
  basic: 'free',
  starter: 'free',
  classic: 'classic',
  standard: 'classic',
  paid: 'classic',
  premium: 'pro',
  business: 'pro',
  agency: 'pro',
  enterprise: 'pro',
  platform: 'unlimited',
  unlimited: 'unlimited',
  pro: 'pro',
};

const PLAN_FEATURES = {
  free: {
    pageDuplication: false,
    customDomain: false,
    editableEmailRecipient: false,
    leadRetentionDays: 31,
    paidPageLimit: 0,
    totalPageLimit: 1,
  },
  classic: {
    pageDuplication: true,
    customDomain: false,
    editableEmailRecipient: true,
    leadRetentionDays: null,
    paidPageLimit: 1,
    totalPageLimit: 2,
  },
  pro: {
    pageDuplication: true,
    customDomain: true,
    editableEmailRecipient: true,
    leadRetentionDays: null,
    paidPageLimit: 3,
    totalPageLimit: 4,
  },
  unlimited: {
    pageDuplication: true,
    customDomain: true,
    editableEmailRecipient: true,
    leadRetentionDays: null,
    paidPageLimit: Number.MAX_SAFE_INTEGER,
    totalPageLimit: Number.MAX_SAFE_INTEGER,
  },
};

export function normalizedPlanKey(...sources) {
  for (const source of sources) {
    if (!source) continue;
    if (typeof source === 'string') {
      const key = source.trim().toLowerCase();
      if (key) return PLAN_ALIASES[key] || key;
      continue;
    }
    if (typeof source === 'object') {
      const key = String(
        source.planKey
        || source.plan
        || source.id
        || source.code
        || source.name
        || ''
      ).trim().toLowerCase();
      if (key) return PLAN_ALIASES[key] || key;
    }
  }
  return 'free';
}

export function projectPlanKey(page = {}, authUser = null) {
  return normalizedPlanKey(
    page?.plan,
    page?.billingPlan,
    page?.billing?.plan,
    page?.subscription?.plan,
    authUser?.plan,
    authUser?.billingPlan,
    authUser?.billing?.plan,
  );
}

export function isFreePlan(page = {}, authUser = null) {
  return projectPlanKey(page, authUser) === 'free';
}

const UNLIMITED_ACCOUNT_EMAILS = new Set(['pc9839a@naver.com']);

export function planFeatures(page = {}, authUser = null) {
  const email = String(authUser?.email || page?.ownerEmail || '').trim().toLowerCase();
  if (UNLIMITED_ACCOUNT_EMAILS.has(email)) return PLAN_FEATURES.unlimited;
  return PLAN_FEATURES[projectPlanKey(page, authUser)] || PLAN_FEATURES.free;
}

export function canUseFeature(page = {}, authUser = null, feature = '') {
  if (!feature) return false;
  const direct =
    page?.features?.[feature]
    ?? page?.plan?.features?.[feature]
    ?? page?.billing?.features?.[feature]
    ?? page?.entitlements?.[feature]
    ?? authUser?.features?.[feature]
    ?? authUser?.entitlements?.[feature];
  if (direct !== undefined) return !!direct;
  return !!planFeatures(page, authUser)[feature];
}

export function shouldLockEmailRecipient(page = {}, authUser = null) {
  return !planFeatures(page, authUser).editableEmailRecipient;
}

export function planPageLimit(page = {}, authUser = null) {
  const limit = Number(planFeatures(page, authUser).totalPageLimit || 1);
  return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 1;
}

export function planLeadRetentionDays(page = {}, authUser = null) {
  const value = planFeatures(page, authUser).leadRetentionDays;
  if (value == null) return null;
  const days = Number(value);
  return Number.isFinite(days) && days > 0 ? Math.floor(days) : null;
}
