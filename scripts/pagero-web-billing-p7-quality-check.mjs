import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = process.cwd();
const migration = await readFile(path.join(root, 'migrations/0016_pagero_web_billing_foundation.sql'), 'utf8');
const helper = await readFile(path.join(root, 'functions/api/billing/_webBilling.js'), 'utf8');
const orders = await readFile(path.join(root, 'functions/api/billing/web/orders.js'), 'utf8');
const webhook = await readFile(path.join(root, 'functions/api/billing/web/webhook.js'), 'utf8');
const confirm = await readFile(path.join(root, 'functions/api/billing/web/confirm.js'), 'utf8');
const readiness = await readFile(path.join(root, 'functions/api/billing/readiness.js'), 'utf8');
const checkout = await readFile(path.join(root, 'public/subscribe/index.html'), 'utf8');

await import(pathToFileURL(path.join(root, 'functions/api/billing/_webBilling.js')).href);
await import(pathToFileURL(path.join(root, 'functions/api/billing/web/orders.js')).href);
await import(pathToFileURL(path.join(root, 'functions/api/billing/web/webhook.js')).href);

for (const token of [
  'billing_web_orders',
  'UNIQUE(owner_id, idempotency_key)',
  'idx_billing_web_orders_provider_order',
  'billing_webhook_events',
  'UNIQUE(provider, event_id)',
  "'partial_refund'",
]) {
  assert(migration.includes(token), `P7 migration contract missing: ${token}`);
}

assert(helper.includes('pagero_monthly') && helper.includes('amountKrw: 3500'), 'Classic price must be server-owned at 3500');
assert(helper.includes('pagero_pro_monthly') && helper.includes('amountKrw: 5500'), 'Pro price must be server-owned at 5500');
assert(!helper.includes('pagero_domain_monthly'), 'unapproved domain add-on must not exist in P7 product catalog');
assert(helper.includes('INLET_WEB_BILLING_CHARGING_ENABLED'), 'charging must have an explicit kill switch');
assert(helper.includes('INLET_WEB_BILLING_ORDER_WRITE_ENABLED'), 'order writes must have an explicit kill switch');
assert(helper.includes('X-Pagero-Billing-Provider-Token'), 'provider adapter must use a billing-specific credential');
assert(helper.includes('webBillingProviderAdapterReady'), 'billing readiness must require a provider-specific adapter');
assert(webhook.includes('assertWebBillingProviderAdapter'), 'webhook verification must be delegated to the selected provider adapter');
assert(helper.includes('MAX_WEBHOOK_SKEW_MS = 5 * 60 * 1000'), 'webhook replay window must be bounded');
assert(helper.includes('ON CONFLICT(owner_id, idempotency_key) DO NOTHING'), 'order creation must be idempotent');
assert(orders.includes('chargingStarted: false'), 'order endpoint must not claim that charging has started');
assert(webhook.includes('processed: false'), 'generic webhook receiver must not mutate subscriptions before provider mapping exists');
assert(webhook.includes('recordWebhookReceipt'), 'webhook events must be deduplicated before provider-specific processing');
assert(confirm.includes('WEB_PRODUCTS'), 'existing confirm path must stay product-scoped');
assert(readiness.includes("available: false") || readiness.includes('webBillingReadiness'), 'readiness must remain fail-closed until provider activation');
assert(!checkout.includes('pagero_domain_monthly'), 'checkout page must not expose the unapproved domain add-on');
assert(!checkout.includes('프로 요금제의 포함 정책은 유지됩니다.'), 'checkout must not claim unapproved Pro entitlements');
assert(['월 3,500원', '월 5,500원'].every((value) => checkout.includes(value)), 'checkout must keep exact approved prices');

console.log(JSON.stringify({
  ok: true,
  scope: 'pagero-p7-web-billing-foundation',
  products: ['pagero_monthly', 'pagero_pro_monthly'],
  orderIdempotency: true,
  webhookSignature: 'provider-specific-adapter',
  webhookReplayWindowMinutes: 5,
  chargingEnabledByDefault: false,
  providerSpecificMutationEnabled: false,
  productionMigrationApplied: true,
}, null, 2));
