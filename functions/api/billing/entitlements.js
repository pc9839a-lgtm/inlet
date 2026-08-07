import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../_shared.js';
import { CALL_METHODS, callSession } from '../call/_shared.js';
import { googlePlayBillingReadiness } from './_readiness.js';
import { resolveEntitlement } from './_shared.js';
import { resolveCallTagEntitlement } from './trial-policy.js';

const DAY_MS = 24 * 60 * 60 * 1000;

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
    const entitlement = productClient === 'calltag'
      ? await resolveCallTagEntitlement(db, session.ownerId)
      : await resolveEntitlement(db, session.ownerId);
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

function featureAccess(entitlement = {}) {
  const active = entitlement.active === true;
  const product = String(entitlement.productCode || entitlement.plan || 'all_monthly');
  return {
    customerDataRead: true,
    customerDataWrite: true,
    consultationHistoryRead: true,
    callManagement: active && (product === 'call_monthly' || product === 'all_monthly'),
    messageAutomation: active && (product === 'message_monthly' || product === 'all_monthly'),
  };
}

function lifecycleNotice(entitlement = {}, now = Date.now()) {
  const endsAt = Date.parse(String(entitlement.endsAt || entitlement.expiresAt || ''));
  const active = entitlement.active === true;
  const status = String(entitlement.status || 'inactive');
  const trial = status === 'trial' || String(entitlement.source || '') === 'trial';

  if (trial && active && Number.isFinite(endsAt)) {
    const remainingMs = endsAt - now;
    if (remainingMs > 0 && remainingMs <= DAY_MS) {
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
