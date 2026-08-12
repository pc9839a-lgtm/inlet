import { billingError, playConfigured } from './_shared.js';

const DISABLED_VALUES = new Set(['1', 'true', 'yes', 'on', 'disabled']);

/**
 * Google Play 결제 준비 상태.
 *
 * 과거에는 GOOGLE_PLAY_BILLING_ENABLED / GOOGLE_PLAY_PRODUCTS_READY 두 수동 플래그를
 * 모두 1로 맞춰야 했지만, 실제 Play 카탈로그와 Publisher API 접근을 운영 환경에서
 * 검증한 뒤에는 credential 존재 여부를 단일 준비 조건으로 사용한다.
 *
 * 긴급 중지는 GOOGLE_PLAY_BILLING_DISABLED=1 로 명시적으로 수행한다.
 */
export function googlePlayBillingReadiness(env = {}) {
  const credentialsConfigured = playConfigured(env);
  const explicitlyDisabled = disabled(env.GOOGLE_PLAY_BILLING_DISABLED);
  const available = credentialsConfigured && !explicitlyDisabled;

  let reasonCode = '';
  let stage = 'available';
  let message = 'Google Play 결제를 이용할 수 있습니다.';

  if (explicitlyDisabled) {
    reasonCode = 'PLAY_RELEASE_DISABLED';
    stage = 'disabled';
    message = '앱 결제 기능을 일시적으로 사용할 수 없습니다.';
  } else if (!credentialsConfigured) {
    reasonCode = 'PLAY_VERIFICATION_NOT_CONFIGURED';
    stage = 'server_setup';
    message = '앱 결제 확인 기능을 준비하고 있습니다.';
  }

  return {
    available,
    stage,
    reasonCode,
    message,
  };
}

export function assertGooglePlayBillingReady(env = {}) {
  const readiness = googlePlayBillingReadiness(env);
  if (!readiness.available) {
    throw billingError(
      readiness.message,
      503,
      'PLAY_BILLING_NOT_READY',
      { stage: readiness.stage, reasonCode: readiness.reasonCode },
    );
  }
  return readiness;
}

function disabled(value) {
  return DISABLED_VALUES.has(String(value ?? '').trim().toLowerCase());
}
