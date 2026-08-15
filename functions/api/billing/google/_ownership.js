import { billingError, ensureBillingSchema } from '../_shared.js';

let cachedPlayAccessToken = '';
let cachedPlayAccessTokenExpiresAt = 0;

export async function assertGooglePurchaseOwnership(
  env = {},
  db,
  ownerId = '',
  email = '',
  purchaseToken = '',
) {
  await ensureBillingSchema(db);
  const safeOwnerId = String(ownerId || '').trim();
  const safeEmail = String(email || '').trim().toLowerCase();
  const token = String(purchaseToken || '').trim();
  if (!safeOwnerId || !token) return null;

  const tokenHash = await sha256(token);
  const existing = await db.prepare(`
    SELECT owner_id, product_code, status, order_id, external_subscription_id
    FROM billing_subscriptions
    WHERE channel = 'google_play' AND purchase_token_hash = ?
    LIMIT 1
  `).bind(tokenHash).first();

  if (!existing?.owner_id) {
    await assertGoogleAccountIdentifier(env, safeEmail, token);
    return null;
  }

  if (String(existing.owner_id) === safeOwnerId) {
    return existing;
  }

  // A token must never move merely because another CallTag account is currently signed in.
  // The only safe recovery path is when Google itself says this purchase was created with
  // the current CallTag account's obfuscatedAccountId.
  const matchesGoogleAccount = await googlePurchaseMatchesAccount(env, safeEmail, token);
  if (!matchesGoogleAccount) {
    throw billingError(
      '이 Google Play 구독은 다른 콜태그 계정에 이미 연결되어 있습니다.',
      409,
      'PLAY_PURCHASE_OWNED_BY_ANOTHER_ACCOUNT',
    );
  }

  await db.prepare(`
    UPDATE billing_subscriptions
    SET owner_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE channel = 'google_play' AND purchase_token_hash = ?
  `).bind(safeOwnerId, tokenHash).run();

  return {
    ...existing,
    owner_id: safeOwnerId,
    recovered: true,
  };
}

export async function filterGooglePurchasesForOwner(
  env = {},
  db,
  ownerId = '',
  email = '',
  purchases = [],
) {
  const safeOwnerId = String(ownerId || '').trim();
  const safeEmail = String(email || '').trim().toLowerCase();
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
      await assertGooglePurchaseOwnership(env, db, safeOwnerId, safeEmail, token);
      allowed.push(purchase);
    } catch (error) {
      if (error?.details?.code === 'PLAY_PURCHASE_OWNED_BY_ANOTHER_ACCOUNT'
          || error?.details?.code === 'PLAY_ACCOUNT_MISMATCH') {
        blockedCount++;
        continue;
      }
      throw error;
    }
  }

  if (!allowed.length && blockedCount > 0) {
    throw billingError(
      '복원하려는 Google Play 구독이 현재 콜태그 계정에서 구매한 구독이 아닙니다.',
      409,
      'PLAY_PURCHASE_OWNED_BY_ANOTHER_ACCOUNT',
    );
  }
  return allowed;
}

/**
 * Best-effort cleanup for rows that were historically moved to the wrong CallTag account.
 * It only deletes a row when Google returns an explicit obfuscated account id and that id
 * differs from the current signed-in account. Legacy purchases without the identifier are
 * left untouched to avoid false revocation.
 */
export async function pruneMismatchedGoogleSubscriptions(
  env = {},
  db,
  ownerId = '',
  email = '',
) {
  await ensureBillingSchema(db);
  const safeOwnerId = String(ownerId || '').trim();
  const safeEmail = String(email || '').trim().toLowerCase();
  if (!safeOwnerId || !safeEmail) return { checked: 0, removed: 0 };

  const rows = await db.prepare(`
    SELECT id, order_id
    FROM billing_subscriptions
    WHERE owner_id = ?
      AND channel = 'google_play'
      AND status IN ('active', 'grace', 'cancelled')
      AND order_id != ''
    ORDER BY updated_at DESC, id DESC
    LIMIT 6
  `).bind(safeOwnerId).all();
  const subscriptions = Array.isArray(rows?.results) ? rows.results : [];
  if (!subscriptions.length) return { checked: 0, removed: 0 };

  const expected = await sha256(safeEmail);
  let checked = 0;
  let removed = 0;

  for (const row of subscriptions) {
    const orderId = String(row?.order_id || '').trim();
    if (!orderId) continue;
    try {
      const order = await googlePlayOrder(env, orderId);
      const purchaseToken = String(order?.purchaseToken || '').trim();
      if (!purchaseToken) continue;
      const purchase = await googlePlaySubscription(env, purchaseToken);
      const actual = String(
        purchase?.externalAccountIdentifiers?.obfuscatedExternalAccountId || '',
      ).trim().toLowerCase();
      if (!actual) continue;
      checked++;
      if (actual === expected) continue;

      const result = await db.prepare(`
        DELETE FROM billing_subscriptions
        WHERE id = ? AND owner_id = ? AND channel = 'google_play'
      `).bind(Number(row.id || 0), safeOwnerId).run();
      if (Number(result?.meta?.changes ?? result?.changes ?? 0) > 0) removed++;
    } catch (error) {
      // Entitlement reads must not fail because Google is temporarily unavailable.
      // The row remains and will be checked again on the next refresh.
      console.warn('google play ownership audit skipped', {
        code: String(error?.details?.code || error?.message || 'PLAY_OWNERSHIP_AUDIT_FAILED').slice(0, 120),
      });
    }
  }

  return { checked, removed };
}

async function assertGoogleAccountIdentifier(env, email, purchaseToken) {
  if (!email) return;
  const purchase = await googlePlaySubscription(env, purchaseToken);
  const actual = String(
    purchase?.externalAccountIdentifiers?.obfuscatedExternalAccountId || '',
  ).trim().toLowerCase();
  if (!actual) return;
  const expected = await sha256(email);
  if (actual !== expected) {
    throw billingError(
      '이 Google Play 구독은 현재 콜태그 계정에서 구매한 구독이 아닙니다.',
      409,
      'PLAY_ACCOUNT_MISMATCH',
    );
  }
}

async function googlePurchaseMatchesAccount(env, email, purchaseToken) {
  if (!email) return false;
  const purchase = await googlePlaySubscription(env, purchaseToken);
  const actual = String(
    purchase?.externalAccountIdentifiers?.obfuscatedExternalAccountId || '',
  ).trim().toLowerCase();
  if (!actual) return false;
  const expected = await sha256(email);
  return actual === expected;
}

async function googlePlayOrder(env, orderId) {
  const accessToken = await googlePlayAccessToken(env);
  let response;
  try {
    response = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/kr.pagero.calltag/orders/${encodeURIComponent(orderId)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      },
    );
  } catch (error) {
    throw billingError(
      'Google Play 주문 확인 서버에 연결하지 못했습니다.',
      502,
      'PLAY_ORDER_NETWORK_FAILED',
    );
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw billingError(
      'Google Play 주문을 확인하지 못했습니다.',
      502,
      'PLAY_ORDER_LOOKUP_FAILED',
      { googleStatus: Number(response.status || 0) },
    );
  }
  return body;
}

async function googlePlaySubscription(env, purchaseToken) {
  const accessToken = await googlePlayAccessToken(env);
  let response;
  try {
    response = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/kr.pagero.calltag/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      },
    );
  } catch (error) {
    throw billingError(
      'Google Play 구매 확인 서버에 연결하지 못했습니다.',
      502,
      'PLAY_VERIFICATION_NETWORK_FAILED',
    );
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw billingError(
      'Google Play 구매를 확인하지 못했습니다.',
      502,
      'PLAY_VERIFICATION_FAILED',
      { googleStatus: Number(response.status || 0) },
    );
  }
  return body;
}

async function googlePlayAccessToken(env = {}) {
  if (cachedPlayAccessToken && cachedPlayAccessTokenExpiresAt > Date.now() + 60000) {
    return cachedPlayAccessToken;
  }
  const clientEmail = String(env.GOOGLE_PLAY_CLIENT_EMAIL || '').trim();
  const privateKey = String(env.GOOGLE_PLAY_PRIVATE_KEY || '');
  if (!clientEmail || !privateKey) {
    throw billingError('Google Play 결제 검증 설정이 필요합니다.', 503, 'PLAY_VERIFICATION_NOT_CONFIGURED');
  }

  const now = Math.floor(Date.now() / 1000);
  const assertion = await signedJwt(privateKey, {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });

  let response;
  try {
    response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
  } catch (error) {
    throw billingError('Google Play 인증 서버에 연결하지 못했습니다.', 503, 'PLAY_AUTH_NETWORK_FAILED');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    throw billingError(
      'Google Play 인증에 실패했습니다.',
      503,
      'PLAY_AUTH_FAILED',
      { googleStatus: Number(response.status || 0) },
    );
  }
  cachedPlayAccessToken = String(body.access_token);
  cachedPlayAccessTokenExpiresAt = Date.now()
    + Math.max(60, Number(body.expires_in || 3600)) * 1000;
  return cachedPlayAccessToken;
}

async function signedJwt(privateKey, payload) {
  const header = base64UrlJson({ alg: 'RS256', typ: 'JWT' });
  const body = base64UrlJson(payload);
  const unsigned = `${header}.${body}`;
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function importPrivateKey(value = '') {
  const pem = String(value || '').replace(/\\n/g, '\n');
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  if (!base64) {
    throw billingError('Google Play 비공개 키가 없습니다.', 503, 'PLAY_PRIVATE_KEY_REQUIRED');
  }
  const binary = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    binary,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

function base64UrlJson(value) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function sha256(value = '') {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
