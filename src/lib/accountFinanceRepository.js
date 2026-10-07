import { ApiError, apiFetch, postJson } from './apiClient.js';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'grace', 'cancelled']);
const FINANCE_CACHE_TTL_MS = 20 * 1000;
const FINANCE_CACHE_STALE_MS = 5 * 60 * 1000;
const financeCache = new Map();

const PRICING = Object.freeze({
  pagero: [
    {
      code: 'pagero_free',
      name: '무료',
      amountKrw: 0,
      included: true,
    },
    {
      code: 'pagero_monthly',
      name: '클래식',
      amountKrw: 3500,
    },
    {
      code: 'pagero_pro_monthly',
      name: '프로',
      amountKrw: 5500,
    },
  ],
  calltag: [
    {
      code: 'all_monthly',
      name: '통합권',
      amountKrw: 6000,
      description: '콜태그 통합 이용권',
    },
  ],
});

function financeProductScope() {
  if (typeof window === 'undefined') return 'legacy';
  const host = String(window.location?.hostname || '').trim().toLowerCase();
  return host === 'calltag.pagero.kr' || host.endsWith('.calltag.pagero.kr')
    ? 'calltag'
    : 'legacy';
}

function sessionHeaders(authUser = null) {
  const session = String(authUser?.session || '').trim();
  const headers = session ? { 'X-Inlet-Session': session } : {};
  if (financeProductScope() === 'calltag') headers['X-Pagero-Product'] = 'calltag';
  return headers;
}

function financeCacheKey(authUser = null) {
  const account = String(authUser?.ownerId || authUser?.id || authUser?.email || '').trim().toLowerCase();
  const session = String(authUser?.session || '').trim();
  const scope = financeProductScope();
  return account && session ? `${scope}:${account}:${session.slice(-24)}` : '';
}

async function readJsonResponse(response, fallback) {
  const text = await response.text().catch(() => '');
  if (!text) {
    if (!response.ok) throw new ApiError(fallback, response.status);
    return {};
  }
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    if (!response.ok) throw new ApiError(text || fallback, response.status);
    return {};
  }
  if (!response.ok) {
    throw new ApiError(data?.message || data?.error || fallback, response.status, data);
  }
  return data;
}

async function getJson(path, authUser, fallback) {
  const response = await apiFetch(path, {
    cache: 'no-store',
    headers: {
      ...sessionHeaders(authUser),
      'Cache-Control': 'no-store',
    },
  });
  return readJsonResponse(response, fallback);
}

function isSubscriptionActive(subscription = {}) {
  if (!ACTIVE_SUBSCRIPTION_STATUSES.has(String(subscription.status || '').toLowerCase())) return false;
  const expiresAt = Date.parse(String(subscription.expiresAt || ''));
  return !Number.isFinite(expiresAt) || expiresAt > Date.now();
}

function pricingPlan(productCode = '') {
  for (const [service, plans] of Object.entries(PRICING)) {
    const found = plans.find((plan) => plan.code === productCode);
    if (found) return { ...found, service };
  }
  const legacy = {
    call_monthly: { name: '전화관리', amountKrw: 0, service: 'calltag' },
    message_monthly: { name: '문자자동화', amountKrw: 0, service: 'calltag' },
  };
  return legacy[productCode] || { name: productCode || '구독', amountKrw: 0, service: '' };
}

function planName(productCode = '') {
  return pricingPlan(productCode).name;
}

function subscriptionForService(subscriptions = [], service = '') {
  const candidates = subscriptions.filter(isSubscriptionActive);
  const productPriority = service === 'pagero'
    ? ['pagero_pro_monthly', 'pagero_monthly']
    : ['all_monthly', 'call_monthly', 'message_monthly'];
  const selected = productPriority
    .map((productCode) => candidates.find((item) => item.productCode === productCode))
    .find(Boolean);
  if (!selected) return null;
  return {
    ...selected,
    service,
    planCode: selected.productCode,
    planName: planName(selected.productCode),
    status: 'active',
    rawStatus: selected.status,
  };
}

function normalizeFinance({ authUser, subscriptionsData, referralData, summaryData }) {
  const rawSubscriptions = Array.isArray(subscriptionsData?.subscriptions)
    ? subscriptionsData.subscriptions
    : [];
  const referral = referralData?.referral || {};
  const summary = summaryData?.summary || {};
  const activeRaw = rawSubscriptions.filter(isSubscriptionActive);
  const calltagActivePlanCodes = activeRaw
    .filter((item) => ['call_monthly', 'message_monthly', 'all_monthly'].includes(item.productCode))
    .map((item) => item.productCode);
  const bundleSubscription = activeRaw.find((item) => item.productCode === 'all_monthly') || null;
  const pageroSubscription = subscriptionForService(rawSubscriptions, 'pagero');
  const calltagSubscription = subscriptionForService(rawSubscriptions, 'calltag');
  const subscriptions = [pageroSubscription, calltagSubscription].filter(Boolean);
  const subscriptionHistory = rawSubscriptions.map((item) => {
    const plan = pricingPlan(item.productCode);
    return {
      ...item,
      planName: plan.name,
      service: plan.service,
      amountKrw: Number(plan.amountKrw || 0),
    };
  });

  return {
    account: {
      id: String(authUser?.ownerId || authUser?.id || ''),
      email: String(authUser?.email || ''),
      name: String(authUser?.name || ''),
    },
    pricing: PRICING,
    subscriptions,
    subscriptionHistory,
    entitlement: subscriptionsData?.entitlement || null,
    calltag: {
      activePlanCodes: calltagActivePlanCodes,
      bundleActive: !!bundleSubscription,
      bundleIncludes: ['call_monthly', 'message_monthly'],
    },
    referral: {
      code: String(referral.code || referral.mine?.code || ''),
      shareUrl: String(referral.shareUrl || referral.mine?.shareUrl || ''),
      registeredCode: String(referral.appliedCode || ''),
      bonusDays: Number(referral.bonusDays || 0),
      locked: referral.applied === true,
      referralCount: Number(summary.referredCount || 0),
      activePaidCount: Number(summary.activePaidCount || 0),
      commissionRatePercent: Number(summary.commissionRatePercent || 0),
      friendBonusDays: Number(summary.friendBonusDays || 0),
      programEnabled: summary.programEnabled !== false,
      signupEnabled: summary.signupEnabled !== false,
      commissionEnabled: summary.commissionEnabled !== false,
      minimumPayoutKrw: Number(summary.minimumPayoutKrw || 0),
      partnerCenterUrl: String(summary.partnerCenterUrl || ''),
      shareMessage: String(summary.shareMessage || ''),
      benefitMessage: String(summary.benefitMessage || ''),
      recurringMessage: String(summary.recurringMessage || ''),
    },
    settlement: {
      scope: String(summary.scope || 'legacy'),
      partnerCenterUrl: String(summary.partnerCenterUrl || ''),
      minimumPayoutKrw: Number(summary.minimumPayoutKrw || 0),
      commissionRatePercent: Number(summary.commissionRatePercent || 0),
      programEnabled: summary.programEnabled !== false,
      combined: {
        estimatedRevenueKrw: Number(summary.estimatedRevenueKrw || 0),
        confirmedRevenueKrw: Number(summary.confirmedRevenueKrw || 0),
        referredCount: Number(summary.referredCount || 0),
        activePaidCount: Number(summary.activePaidCount || 0),
      },
    },
  };
}

export function getCachedAccountFinance(authUser = null) {
  const key = financeCacheKey(authUser);
  if (!key) return null;
  const entry = financeCache.get(key);
  if (!entry?.data) return null;
  if (Date.now() - Number(entry.updatedAt || 0) > FINANCE_CACHE_STALE_MS) {
    financeCache.delete(key);
    return null;
  }
  return entry.data;
}

export async function fetchAccountFinance(authUser = null, options = {}) {
  if (!authUser?.session) throw new ApiError('로그인이 필요합니다.', 401);
  const key = financeCacheKey(authUser);
  const force = options?.force === true;
  const existing = key ? financeCache.get(key) : null;
  const age = Date.now() - Number(existing?.updatedAt || 0);

  if (!force && existing?.data && age <= FINANCE_CACHE_TTL_MS) return existing.data;
  if (existing?.promise) return existing.promise;

  const request = getJson('/api/billing/finance', authUser, '서비스 정보를 불러오지 못했습니다.')
    .then((data) => {
      const next = normalizeFinance({
        authUser,
        subscriptionsData: data,
        referralData: data,
        summaryData: data,
      });
      if (key) financeCache.set(key, { data: next, updatedAt: Date.now(), promise: null });
      return next;
    })
    .catch((error) => {
      if (key) {
        const stale = financeCache.get(key);
        if (stale?.data) financeCache.set(key, { ...stale, promise: null });
        else financeCache.delete(key);
      }
      throw error;
    });

  if (key) financeCache.set(key, { data: existing?.data || null, updatedAt: existing?.updatedAt || 0, promise: request });
  return request;
}

export async function applyAccountReferralCode() {
  throw new ApiError('추천인 코드는 회원가입할 때만 입력할 수 있습니다.', 409, {
    code: 'REFERRAL_SIGNUP_ONLY',
  });
}

export async function createAccountCheckout(authUser = null, service = '', planCode = '') {
  if (!authUser?.session) throw new ApiError('로그인이 필요합니다.', 401);
  const productCode = String(planCode || '').trim();
  const selectedPlan = (PRICING[service] || []).find((plan) => plan.code === productCode);
  if (!selectedPlan) throw new ApiError('결제할 요금제를 확인해주세요.', 400);
  if (selectedPlan.included || selectedPlan.amountKrw <= 0) {
    throw new ApiError('무료 요금제는 별도 결제가 필요하지 않습니다.', 400);
  }

  const data = await postJson('/api/billing/web/precheck', { productCode }, {
    headers: sessionHeaders(authUser),
  });
  const decision = data?.checkoutDecision || {};
  if (decision.allowed === false) {
    throw new ApiError(decision.message || '이미 이용 중인 구독이 있습니다.', 409, decision);
  }

  if (service === 'pagero') {
    return `/subscribe?product=${encodeURIComponent(productCode)}`;
  }
  return `https://calltag.pagero.kr/subscribe?product=${encodeURIComponent(productCode)}`;
}
