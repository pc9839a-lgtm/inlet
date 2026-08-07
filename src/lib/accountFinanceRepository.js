import { ApiError, apiFetch, postJson } from './apiClient.js';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'grace', 'cancelled']);
const PRICING = Object.freeze({
  pagero: [
    {
      code: 'pagero_free',
      name: '무료',
      amountKrw: 0,
      description: '기본 페이지 제작과 운영',
      included: true,
    },
    {
      code: 'pagero_monthly',
      name: '클래식',
      amountKrw: 3500,
      description: '페이지 운영과 고객 접수 관리',
    },
    {
      code: 'pagero_pro_monthly',
      name: '프로',
      amountKrw: 5500,
      description: '고급 연동과 확장 운영 기능',
    },
  ],
  calltag: [
    {
      code: 'all_monthly',
      name: '통합',
      amountKrw: 6000,
      description: '통화 고객관리와 문자 자동화 통합',
    },
  ],
});

function sessionHeaders(authUser = null) {
  const session = String(authUser?.session || '').trim();
  return session ? { 'X-Inlet-Session': session } : {};
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

function planName(productCode = '') {
  if (['all_monthly', 'call_monthly', 'message_monthly'].includes(productCode)) return '통합';
  for (const plans of Object.values(PRICING)) {
    const found = plans.find((plan) => plan.code === productCode);
    if (found) return found.name;
  }
  return productCode || '구독';
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
    planCode: service === 'calltag' ? 'all_monthly' : selected.productCode,
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
  const subscriptions = [
    subscriptionForService(rawSubscriptions, 'pagero'),
    subscriptionForService(rawSubscriptions, 'calltag'),
  ].filter(Boolean);

  return {
    account: {
      id: String(authUser?.ownerId || authUser?.id || ''),
      email: String(authUser?.email || ''),
      name: String(authUser?.name || ''),
    },
    pricing: PRICING,
    subscriptions,
    entitlement: subscriptionsData?.entitlement || null,
    referral: {
      code: String(referral.code || referral.mine?.code || ''),
      shareUrl: String(referral.shareUrl || referral.mine?.shareUrl || ''),
      registeredCode: String(referral.appliedCode || ''),
      bonusDays: Number(referral.bonusDays || 0),
      locked: referral.applied === true,
      referralCount: Number(summary.referredCount || 0),
      activePaidCount: Number(summary.activePaidCount || 0),
      commissionRatePercent: 20,
    },
    settlement: {
      combined: {
        estimatedRevenueKrw: Number(summary.estimatedRevenueKrw || 0),
        confirmedRevenueKrw: Number(summary.confirmedRevenueKrw || 0),
        referredCount: Number(summary.referredCount || 0),
        activePaidCount: Number(summary.activePaidCount || 0),
      },
    },
  };
}

export async function fetchAccountFinance(authUser = null) {
  if (!authUser?.session) throw new ApiError('로그인이 필요합니다.', 401);
  const [subscriptionsData, referralData, summaryData] = await Promise.all([
    getJson('/api/billing/subscriptions', authUser, '구독 정보를 불러오지 못했습니다.'),
    getJson('/api/referrals/me', authUser, '추천인 정보를 불러오지 못했습니다.'),
    getJson('/api/referrals/summary', authUser, '파트너 정산 정보를 불러오지 못했습니다.'),
  ]);
  return normalizeFinance({ authUser, subscriptionsData, referralData, summaryData });
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
