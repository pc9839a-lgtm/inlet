import { billingError, playConfigured } from './_shared.js';

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled']);

export function googlePlayBillingReadiness(env = {}) {
  const releaseEnabled = enabled(env.GOOGLE_PLAY_BILLING_ENABLED);
  const productsReady = enabled(env.GOOGLE_PLAY_PRODUCTS_READY);
  const credentialsConfigured = playConfigured(env);
  const available = releaseEnabled && productsReady && credentialsConfigured;

  let reasonCode = '';
  let stage = 'available';
  let message = 'Google Play 결제를 이용할 수 있습니다.';
  if (!releaseEnabled) {
    reasonCode = 'PLAY_RELEASE_DISABLED';
    stage = 'pre_registration';
    message = '앱 결제 기능을 준비하고 있습니다.';
  } else if (!productsReady) {
    reasonCode = 'PLAY_PRODUCTS_NOT_READY';
    stage = 'catalog_setup';
    message = '앱 결제 상품을 준비하고 있습니다.';
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

function enabled(value) {
  return ENABLED_VALUES.has(String(value ?? '').trim().toLowerCase());
}
