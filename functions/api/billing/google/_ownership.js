import { billingError, ensureBillingSchema } from '../_shared.js';

export async function assertGooglePurchaseOwnership(db, ownerId = '', purchaseToken = '') {
  await ensureBillingSchema(db);
  const safeOwnerId = String(ownerId || '').trim();
  const token = String(purchaseToken || '').trim();
  if (!safeOwnerId || !token) return null;

  const tokenHash = await sha256(token);
  const existing = await db.prepare(`
    SELECT owner_id, product_code, status, order_id, external_subscription_id
    FROM billing_subscriptions
    WHERE channel = 'google_play' AND purchase_token_hash = ?
    LIMIT 1
  `).bind(tokenHash).first();

  if (existing?.owner_id && String(existing.owner_id) !== safeOwnerId) {
    throw billingError(
      '이 Google Play 구독은 다른 콜태그 계정에 이미 연결되어 있습니다.',
      409,
      'PLAY_PURCHASE_OWNED_BY_ANOTHER_ACCOUNT',
    );
  }
  return existing || null;
}

export async function filterGooglePurchasesForOwner(db, ownerId = '', purchases = []) {
  const safeOwnerId = String(ownerId || '').trim();
  const list = Array.isArray(purchases) ? purchases.slice(0, 10) : [];
  const allowed = [];
  let blockedCount = 0;

  for (const purchase of list) {
    const token = String(purchase?.purchaseToken || '').trim();
    if (!token) {
      allowed.push(purchase);
      continue;
    }
    try {
      await assertGooglePurchaseOwnership(db, safeOwnerId, token);
      allowed.push(purchase);
    } catch (error) {
      if (error?.details?.code === 'PLAY_PURCHASE_OWNED_BY_ANOTHER_ACCOUNT') {
        blockedCount++;
        continue;
      }
      throw error;
    }
  }

  if (!allowed.length && blockedCount > 0) {
    throw billingError(
      '복원하려는 Google Play 구독이 다른 콜태그 계정에 연결되어 있습니다.',
      409,
      'PLAY_PURCHASE_OWNED_BY_ANOTHER_ACCOUNT',
    );
  }
  return allowed;
}

async function sha256(value = '') {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
