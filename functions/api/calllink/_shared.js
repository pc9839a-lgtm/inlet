import { assertD1 } from '../_shared.js';

const encoder = new TextEncoder();

export function normalizePhone(value = '') {
  return String(value || '').replace(/[^0-9]/g, '');
}

export function randomId(prefix = 'cl') {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${token}`;
}

export function randomConnectionCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 1000000).padStart(6, '0');
}

export async function sha256Hex(value = '') {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function codeHash(code, env = {}) {
  const pepper = String(env.CALLLINK_CODE_PEPPER || env.INLET_SESSION_SECRET || env.INLET_API_TOKEN || 'pagero-calllink-code').trim();
  return sha256Hex(`${pepper}:${String(code || '').trim()}`);
}

export async function deviceTokenHash(token, env = {}) {
  const pepper = String(env.CALLLINK_DEVICE_PEPPER || env.INLET_SESSION_SECRET || env.INLET_API_TOKEN || 'pagero-calllink-device').trim();
  return sha256Hex(`${pepper}:${String(token || '').trim()}`);
}

export async function requireCallLinkDevice(request, env = {}) {
  const auth = String(request.headers.get('Authorization') || '').trim();
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!bearer || !bearer.startsWith('cl_')) {
    const error = new Error('CALLLINK_DEVICE_AUTH_REQUIRED');
    error.status = 401;
    throw error;
  }
  const db = assertD1(env);
  const tokenHash = await deviceTokenHash(bearer, env);
  const row = await db.prepare(`
    SELECT
      d.id AS device_id,
      d.project_id,
      d.account_id,
      d.device_name,
      d.status AS device_status,
      p.slug,
      p.title,
      p.plan,
      p.billing_status,
      p.status AS project_status,
      s.status AS subscription_status,
      s.current_period_end
    FROM calllink_devices d
    INNER JOIN projects p ON p.id = d.project_id
    LEFT JOIN subscriptions s ON s.project_id = p.id
    WHERE d.token_hash = ?
    LIMIT 1
  `).bind(tokenHash).first();
  if (!row || row.device_status !== 'active') {
    const error = new Error('CALLLINK_DEVICE_AUTH_INVALID');
    error.status = 401;
    throw error;
  }
  if (row.project_status !== 'active' || !isBillingActive(row)) {
    const error = new Error('CALLLINK_SUBSCRIPTION_INACTIVE');
    error.status = 402;
    throw error;
  }
  await db.prepare(`
    UPDATE calllink_devices
    SET last_seen_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(new Date().toISOString(), new Date().toISOString(), row.device_id).run();
  return {
    deviceId: row.device_id,
    projectId: row.project_id,
    accountId: row.account_id || '',
    deviceName: row.device_name || '',
    project: {
      projectId: row.project_id,
      slug: row.slug || '',
      title: row.title || '',
      plan: row.plan || 'free',
      billingStatus: row.billing_status || '',
      subscriptionStatus: row.subscription_status || '',
      currentPeriodEnd: row.current_period_end || '',
    },
  };
}

export function isBillingActive(row = {}) {
  const projectBilling = String(row.billing_status || '').toLowerCase();
  const subscription = String(row.subscription_status || '').toLowerCase();
  return ['active', 'trial'].includes(projectBilling)
    || ['active', 'trialing'].includes(subscription);
}

export async function projectConnectionPayload(db, projectId) {
  const project = await db.prepare(`
    SELECT id, slug, title, plan, billing_status, status
    FROM projects
    WHERE id = ?
    LIMIT 1
  `).bind(projectId).first();
  if (!project) return null;
  const pagesResult = await db.prepare(`
    SELECT slug, title, published_at
    FROM pages
    WHERE project_id = ?
    ORDER BY updated_at DESC
    LIMIT 20
  `).bind(projectId).all();
  const subscription = await db.prepare(`
    SELECT status, current_period_end
    FROM subscriptions
    WHERE project_id = ?
    LIMIT 1
  `).bind(projectId).first();
  return {
    projectId: project.id,
    slug: project.slug || '',
    title: project.title || '',
    plan: project.plan || 'free',
    billingStatus: project.billing_status || '',
    status: project.status || '',
    subscriptionStatus: subscription?.status || '',
    currentPeriodEnd: subscription?.current_period_end || '',
    pages: (pagesResult?.results || []).map((page) => ({
      slug: page.slug || '',
      title: page.title || page.slug || '',
      url: `https://pagero.kr/${page.slug || ''}`,
      publishedAt: page.published_at || '',
    })),
  };
}

export async function channelConfig(db, projectId) {
  const row = await db.prepare(`
    SELECT project_id, solapi_enabled, sender_number, kakao_channel_id,
           kakao_template_id, fallback_sms_enabled, status, updated_at
    FROM calllink_channels
    WHERE project_id = ?
    LIMIT 1
  `).bind(projectId).first();
  return row ? {
    projectId: row.project_id,
    solapiEnabled: row.solapi_enabled === 1,
    senderNumber: row.sender_number || '',
    kakaoChannelId: row.kakao_channel_id || '',
    kakaoTemplateId: row.kakao_template_id || '',
    fallbackSmsEnabled: row.fallback_sms_enabled !== 0,
    status: row.status || 'not_configured',
    updatedAt: row.updated_at || '',
  } : {
    projectId,
    solapiEnabled: false,
    senderNumber: '',
    kakaoChannelId: '',
    kakaoTemplateId: '',
    fallbackSmsEnabled: true,
    status: 'not_configured',
    updatedAt: '',
  };
}

export async function walletBalance(db, projectId) {
  const row = await db.prepare(`
    SELECT balance, currency, low_balance_threshold, updated_at
    FROM calllink_wallets
    WHERE project_id = ?
    LIMIT 1
  `).bind(projectId).first();
  return {
    balance: Number(row?.balance || 0),
    currency: row?.currency || 'KRW',
    lowBalanceThreshold: Number(row?.low_balance_threshold || 1000),
    updatedAt: row?.updated_at || '',
  };
}

export function estimateMessageCost(channel, messages = [], env = {}) {
  const prices = {
    sms: Number(env.CALLLINK_SMS_PRICE || 18),
    lms: Number(env.CALLLINK_LMS_PRICE || 45),
    mms: Number(env.CALLLINK_MMS_PRICE || 110),
    alimtalk: Number(env.CALLLINK_ALIMTALK_PRICE || 13),
  };
  return Math.max(0, Math.ceil(Number(prices[channel] || prices.sms) * messages.length));
}

export async function debitWallet(db, projectId, amount, referenceId, memo = '') {
  const cost = Math.max(0, Math.ceil(Number(amount || 0)));
  const wallet = await walletBalance(db, projectId);
  if (wallet.balance < cost) {
    const error = new Error('CALLLINK_BALANCE_INSUFFICIENT');
    error.status = 402;
    throw error;
  }
  const next = wallet.balance - cost;
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`
      UPDATE calllink_wallets
      SET balance = ?, updated_at = ?
      WHERE project_id = ?
    `).bind(next, now, projectId),
    db.prepare(`
      INSERT INTO calllink_wallet_transactions (
        id, project_id, transaction_type, amount, balance_after,
        reference_type, reference_id, memo, created_at
      ) VALUES (?, ?, 'debit', ?, ?, 'message', ?, ?, ?)
    `).bind(randomId('cltx'), projectId, -cost, next, referenceId, memo, now),
  ]);
  return next;
}

export async function solapiRequest(env, path, options = {}) {
  const apiKey = String(env.SOLAPI_API_KEY || '').trim();
  const apiSecret = String(env.SOLAPI_API_SECRET || '').trim();
  if (!apiKey || !apiSecret) {
    const error = new Error('CALLLINK_SOLAPI_NOT_CONFIGURED');
    error.status = 503;
    throw error;
  }
  const date = new Date().toISOString();
  const salt = randomId('salt').replace(/^salt_/, '');
  const signature = await hmacHex(`${date}${salt}`, apiSecret);
  const response = await fetch(`https://api.solapi.com${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  if (!response.ok) {
    const error = new Error(payload?.errorMessage || payload?.message || `SOLAPI_${response.status}`);
    error.status = response.status >= 400 && response.status < 500 ? 400 : 502;
    error.details = payload;
    throw error;
  }
  return payload;
}

async function hmacHex(message, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const result = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(result), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
