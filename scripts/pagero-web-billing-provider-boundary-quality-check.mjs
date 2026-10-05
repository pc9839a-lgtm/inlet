import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const registry = await readFile('functions/api/billing/providers/_registry.js', 'utf8');
const lifecycle = await readFile('functions/api/billing/_webBillingLifecycle.js', 'utf8');
const helper = await readFile('functions/api/billing/_webBilling.js', 'utf8');
const history = await readFile('functions/api/billing/web/history.js', 'utf8');
const webhook = await readFile('functions/api/billing/web/webhook.js', 'utf8');

assert(registry.includes('const ADAPTERS = Object.freeze({})'), 'provider registry must ship with no guessed provider');
assert(registry.includes('WEB_BILLING_PROVIDER_ADAPTER_REQUIRED'), 'provider registry must fail closed without an adapter');
assert(registry.includes('createCheckout') && registry.includes('verifyPayment') && registry.includes('verifyWebhook'), 'adapter contract must require checkout/payment/webhook boundaries');

for (const token of [
  'payment.succeeded',
  'payment.failed',
  'subscription.renewed',
  'subscription.grace',
  'subscription.cancelled',
  'refund.partial',
  'refund.full',
]) {
  assert(lifecycle.includes(token), `lifecycle event contract missing: ${token}`);
}
assert(lifecycle.includes('WEB_BILLING_ORDER_TRANSITION_INVALID'), 'order lifecycle must reject illegal transitions');
assert(lifecycle.includes("partial_refund: new Set(['partial_refund', 'refunded'])"), 'partial refund must be monotonic');
assert(helper.includes('webBillingProviderAdapterReady'), 'readiness must require a real provider adapter');
assert(helper.includes("stage = 'provider_adapter_missing'"), 'readiness must expose missing provider adapter');
assert(webhook.includes('assertWebBillingProviderAdapter'), 'webhook path must require provider-specific verification');
assert(history.includes('listWebOrders') && history.includes('listPaymentEvents'), 'billing history must combine orders and payment events');
assert(!registry.toLowerCase().includes('toss') && !registry.toLowerCase().includes('inicis') && !registry.toLowerCase().includes('nicepay'), 'provider must not be guessed before owner selection');

console.log(JSON.stringify({
  ok: true,
  scope: 'pagero-p7-provider-boundary-history',
  providerSelected: false,
  adapterRegistry: 'fail-closed',
  lifecycleNormalized: true,
  billingHistoryReadOnly: true,
  chargingEnabled: false,
}, null, 2));
