const ADAPTERS = Object.freeze({});

export function webBillingProviderAdapter(provider = '') {
  const key = normalizeProvider(provider);
  return key ? ADAPTERS[key] || null : null;
}

export function webBillingProviderAdapterReady(provider = '') {
  const adapter = webBillingProviderAdapter(provider);
  return Boolean(
    adapter
      && typeof adapter.verifyWebhook === 'function'
      && typeof adapter.verifyPayment === 'function'
      && typeof adapter.createCheckout === 'function',
  );
}

export function assertWebBillingProviderAdapter(provider = '') {
  const adapter = webBillingProviderAdapter(provider);
  if (!adapter || !webBillingProviderAdapterReady(provider)) {
    const error = new Error('웹 결제 제공자 어댑터가 아직 연결되지 않았습니다.');
    error.status = 503;
    error.details = {
      code: 'WEB_BILLING_PROVIDER_ADAPTER_REQUIRED',
      provider: normalizeProvider(provider),
    };
    throw error;
  }
  return adapter;
}

function normalizeProvider(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  return /^[a-z0-9._-]{1,48}$/.test(raw) ? raw : '';
}
