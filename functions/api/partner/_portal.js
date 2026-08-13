import { ensureBillingSchema, ensureReferralCode } from '../billing/_shared.js';
import {
  ensurePartnerFinanceSchema,
  resolvePartnerCommissionRateBps,
} from '../billing/_partnerFinance.js';
import { ensureCalllinkSchema } from '../call/_shared.js';
import { requireSettlementStepup } from './_security.js';

export const PARTNER_PORTAL_METHODS = 'GET, POST, PUT, OPTIONS';
export const MIN_PAYOUT_KRW = 10000;

const SERVICES = new Set(['ALL', 'CALLTAG', 'PAGERO']);
const PAYOUT_TYPES = new Set(['INDIVIDUAL', 'SOLE_PROPRIETOR', 'CORPORATION']);
let schemaPromise = null;

export function portalError(message, status = 400, code = 'PARTNER_PORTAL_ERROR', details = {}) {
  const error = new Error(message);
  error.status = status;
  error.details = { code, ...details };
  return error;
}

export async function partnerPortalContext(request, env) {
  const auth = await requireSettlementStepup(request, env);
  await Promise.all([
    ensureBillingSchema(env.DB),
    ensurePartnerFinanceSchema(env.DB),
    ensureCalllinkSchema(env.DB),
    ensurePartnerPortalSchema(env.DB),
  ]);
  const referral = await ensureReferralCode(env.DB, auth.ownerId);
  return { ...auth, db: env.DB, referral };
}

export async function ensurePartnerPortalSchema(db) {
  if (!db?.prepare) throw portalError('정산 데이터베이스가 연결되지 않았습니다.', 503, 'PARTNER_PORTAL_DB_REQUIRED');
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS partner_payout_profiles (
          owner_id TEXT PRIMARY KEY,
          payout_type TEXT NOT NULL DEFAULT 'INDIVIDUAL',
          account_holder TEXT NOT NULL DEFAULT '',
          bank_name TEXT NOT NULL DEFAULT '',
          account_number_ciphertext TEXT NOT NULL DEFAULT '',
          account_number_iv TEXT NOT NULL DEFAULT '',
          account_number_last4 TEXT NOT NULL DEFAULT '',
          settlement_email TEXT NOT NULL DEFAULT '',
          phone TEXT NOT NULL DEFAULT '',
          business_name TEXT NOT NULL DEFAULT '',
          business_number_ciphertext TEXT NOT NULL DEFAULT '',
          business_number_iv TEXT NOT NULL DEFAULT '',
          business_number_last4 TEXT NOT NULL DEFAULT '',
          tax_email TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CHECK(payout_type IN ('INDIVIDUAL','SOLE_PROPRIETOR','CORPORATION'))
        )
      `).run();
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS partner_payout_requests (
          request_id TEXT PRIMARY KEY,
          owner_id TEXT NOT NULL,
          settlement_month TEXT NOT NULL,
          service_scope TEXT NOT NULL DEFAULT 'ALL',
          amount_krw INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'requested',
          settlement_id TEXT NOT NULL DEFAULT '',
          requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          processed_at TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CHECK(service_scope IN ('ALL','CALLTAG','PAGERO')),
          CHECK(status IN ('requested','processing','paid','cancelled','review'))
        )
      `).run();
      await db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_partner_payout_requests_owner_status
        ON partner_payout_requests(owner_id, status, requested_at DESC)
      `).run();
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS partner_policy_consents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_id TEXT NOT NULL,
          policy_version TEXT NOT NULL,
          action TEXT NOT NULL,
          service_scope TEXT NOT NULL DEFAULT 'ALL',
          accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      await db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_partner_policy_consents_owner_created
        ON partner_policy_consents(owner_id, created_at DESC)
      `).run();
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

export function normalizeService(value = 'ALL') {
  const service = String(value || 'ALL').trim().toUpperCase();
  return SERVICES.has(service) ? service : 'ALL';
}

export function serviceForProduct(productCode = '') {
  const code = String(productCode || '').trim().toLowerCase();
  if (['pagero_monthly', 'pagero_pro_monthly', 'pagero_domain_monthly'].includes(code)) return 'PAGERO';
  if (['call_monthly', 'message_monthly', 'all_monthly'].includes(code)) return 'CALLTAG';
  return 'CALLTAG';
}

export function productLabel(productCode = '') {
  const code = String(productCode || '').trim().toLowerCase();
  const labels = {
    pagero_monthly: '페이지로 클래식',
    pagero_pro_monthly: '페이지로 프로',
    pagero_domain_monthly: '페이지로 SSL',
    call_monthly: '콜태그 클래식',
    message_monthly: '콜태그 프로',
    all_monthly: '페이지로 × 콜태그 통합권',
  };
  return labels[code] || code || '구독';
}

export function serviceCondition(alias = 's', service = 'ALL') {
  const normalized = normalizeService(service);
  if (normalized === 'PAGERO') {
    return `${alias}.product_code IN ('pagero_monthly','pagero_pro_monthly','pagero_domain_monthly')`;
  }
  if (normalized === 'CALLTAG') {
    return `${alias}.product_code IN ('call_monthly','message_monthly','all_monthly')`;
  }
  return '1=1';
}

export function amount(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(parsed)) : 0;
}

export function safeIso(value = '') {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

export function maskEmail(value = '') {
  const email = String(value || '').trim().toLowerCase();
  const at = email.indexOf('@');
  if (at <= 0) return '';
  const local = email.slice(0, at);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${'*'.repeat(Math.max(2, Math.min(6, local.length - head.length)))}${email.slice(at)}`;
}

export function maskName(value = '') {
  const name = String(value || '').trim();
  if (!name) return '';
  if (name.length === 1) return `${name}*`;
  if (name.length === 2) return `${name[0]}*`;
  return `${name[0]}${'*'.repeat(Math.max(1, name.length - 2))}${name[name.length - 1]}`;
}

export function maskPhone(value = '') {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 7) return digits ? '***' : '';
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

export function maskDigits(last4 = '', prefix = '****') {
  const tail = String(last4 || '').replace(/\D/g, '').slice(-4);
  return tail ? `${prefix}${tail}` : '';
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function nextSettlementAt() {
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  if (now.getUTCDate() >= 15) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }
  return new Date(Date.UTC(year, month, 15, 0, 0, 0)).toISOString();
}

export async function commissionRatePercent(db, ownerId) {
  const bps = await resolvePartnerCommissionRateBps(db, ownerId);
  return bps === 5000 ? 50 : 20;
}

export async function pendingPayoutRequest(db, ownerId, service = 'ALL') {
  const normalized = normalizeService(service);
  const row = await db.prepare(`
    SELECT request_id, service_scope, amount_krw, status, requested_at
    FROM partner_payout_requests
    WHERE owner_id = ?
      AND status IN ('requested','processing','review')
      AND (
        ? = 'ALL'
        OR service_scope = 'ALL'
        OR service_scope = ?
      )
    ORDER BY requested_at DESC
    LIMIT 1
  `).bind(ownerId, normalized, normalized).first();
  return row || null;
}

export async function availableCommissionAmount(db, ownerId, service = 'ALL') {
  const condition = serviceCondition('s', service);
  const row = await db.prepare(`
    SELECT COALESCE(SUM(pc.commission_amount_krw), 0) AS amount_krw
    FROM partner_commissions pc
    LEFT JOIN billing_subscriptions s ON s.id = pc.subscription_id
    WHERE pc.referrer_owner_id = ?
      AND pc.earned_month = ?
      AND pc.status = 'confirmed'
      AND ${condition}
      AND NOT EXISTS (
        SELECT 1
        FROM partner_settlement_items psi
        JOIN partner_settlements ps ON ps.settlement_id = psi.settlement_id
        WHERE psi.commission_id = pc.id
          AND ps.status IN ('processing','paid','review')
      )
  `).bind(ownerId, currentMonth()).first();
  return amount(row?.amount_krw);
}

export async function hasRecentConsent(db, ownerId, action) {
  const row = await db.prepare(`
    SELECT id
    FROM partner_policy_consents
    WHERE owner_id = ? AND action = ?
      AND julianday(created_at) >= julianday('now', '-30 minutes')
    ORDER BY id DESC
    LIMIT 1
  `).bind(ownerId, String(action || '').slice(0, 80)).first();
  return !!row?.id;
}

export async function recordPolicyConsent(db, ownerId, input = {}) {
  const version = String(input.version || '').trim().slice(0, 40);
  const action = String(input.action || '').trim().slice(0, 80);
  const service = normalizeService(input.service || 'ALL');
  if (!version || !action) throw portalError('약관 동의 정보가 올바르지 않습니다.', 400, 'PARTNER_POLICY_CONSENT_INVALID');
  const acceptedAt = safeIso(input.acceptedAt) || new Date().toISOString();
  await db.prepare(`
    INSERT INTO partner_policy_consents (
      owner_id, policy_version, action, service_scope, accepted_at, created_at
    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(ownerId, version, action, service, acceptedAt).run();
  return { version, action, service, acceptedAt };
}

export async function readPayoutProfile(db, ownerId, user = {}) {
  const row = await db.prepare(`
    SELECT payout_type, account_holder, bank_name, account_number_last4,
           settlement_email, phone, business_name, business_number_last4,
           tax_email, created_at, updated_at
    FROM partner_payout_profiles
    WHERE owner_id = ?
    LIMIT 1
  `).bind(ownerId).first();
  return {
    type: String(row?.payout_type || 'INDIVIDUAL'),
    accountHolder: String(row?.account_holder || ''),
    bankName: String(row?.bank_name || ''),
    accountNumberMasked: maskDigits(row?.account_number_last4, '****-****-'),
    settlementEmail: String(row?.settlement_email || user?.email || ''),
    phone: String(row?.phone || user?.phone || ''),
    businessName: String(row?.business_name || ''),
    businessNumberMasked: maskDigits(row?.business_number_last4, '***-**-'),
    taxEmail: String(row?.tax_email || ''),
    configured: !!row,
    updatedAt: safeIso(row?.updated_at),
  };
}

export async function savePayoutProfile(db, ownerId, input = {}, env = {}) {
  if (!(await hasRecentConsent(db, ownerId, 'payout-save'))) {
    throw portalError('파트너 약관과 개인정보 처리 동의가 필요합니다.', 403, 'PARTNER_PAYOUT_CONSENT_REQUIRED');
  }
  const type = String(input.type || 'INDIVIDUAL').trim().toUpperCase();
  if (!PAYOUT_TYPES.has(type)) throw portalError('정산 유형이 올바르지 않습니다.', 400, 'PARTNER_PAYOUT_TYPE_INVALID');
  const existing = await db.prepare(`
    SELECT account_number_ciphertext, account_number_iv, account_number_last4,
           business_number_ciphertext, business_number_iv, business_number_last4
    FROM partner_payout_profiles WHERE owner_id = ? LIMIT 1
  `).bind(ownerId).first();

  const accountHolder = clean(input.accountHolder, 80);
  const bankName = clean(input.bankName, 60);
  const settlementEmail = cleanEmail(input.settlementEmail);
  const phone = String(input.phone || '').replace(/[^0-9+]/g, '').slice(0, 20);
  const businessName = clean(input.businessName, 120);
  const taxEmail = cleanEmail(input.taxEmail);
  if (!accountHolder || !bankName || !settlementEmail) {
    throw portalError('예금주, 은행, 정산 이메일을 입력해주세요.', 400, 'PARTNER_PAYOUT_PROFILE_REQUIRED');
  }

  let accountCipher = String(existing?.account_number_ciphertext || '');
  let accountIv = String(existing?.account_number_iv || '');
  let accountLast4 = String(existing?.account_number_last4 || '');
  const accountNumber = String(input.accountNumber || '').replace(/\D/g, '').slice(0, 40);
  if (accountNumber) {
    if (accountNumber.length < 8) throw portalError('계좌번호를 확인해주세요.', 400, 'PARTNER_BANK_ACCOUNT_INVALID');
    const encrypted = await encryptSensitive(accountNumber, env, 'bank-account');
    accountCipher = encrypted.ciphertext;
    accountIv = encrypted.iv;
    accountLast4 = accountNumber.slice(-4);
  }
  if (!accountCipher) throw portalError('계좌번호를 입력해주세요.', 400, 'PARTNER_BANK_ACCOUNT_REQUIRED');

  let businessCipher = String(existing?.business_number_ciphertext || '');
  let businessIv = String(existing?.business_number_iv || '');
  let businessLast4 = String(existing?.business_number_last4 || '');
  const businessNumber = String(input.businessNumber || '').replace(/\D/g, '').slice(0, 20);
  if (businessNumber) {
    const encrypted = await encryptSensitive(businessNumber, env, 'business-number');
    businessCipher = encrypted.ciphertext;
    businessIv = encrypted.iv;
    businessLast4 = businessNumber.slice(-4);
  }
  if (type !== 'INDIVIDUAL' && (!businessName || !businessCipher)) {
    throw portalError('사업자 정보가 필요합니다.', 400, 'PARTNER_BUSINESS_PROFILE_REQUIRED');
  }

  await db.prepare(`
    INSERT INTO partner_payout_profiles (
      owner_id, payout_type, account_holder, bank_name,
      account_number_ciphertext, account_number_iv, account_number_last4,
      settlement_email, phone, business_name,
      business_number_ciphertext, business_number_iv, business_number_last4,
      tax_email, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(owner_id) DO UPDATE SET
      payout_type = excluded.payout_type,
      account_holder = excluded.account_holder,
      bank_name = excluded.bank_name,
      account_number_ciphertext = excluded.account_number_ciphertext,
      account_number_iv = excluded.account_number_iv,
      account_number_last4 = excluded.account_number_last4,
      settlement_email = excluded.settlement_email,
      phone = excluded.phone,
      business_name = excluded.business_name,
      business_number_ciphertext = excluded.business_number_ciphertext,
      business_number_iv = excluded.business_number_iv,
      business_number_last4 = excluded.business_number_last4,
      tax_email = excluded.tax_email,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    ownerId, type, accountHolder, bankName,
    accountCipher, accountIv, accountLast4,
    settlementEmail, phone, businessName,
    businessCipher, businessIv, businessLast4,
    taxEmail,
  ).run();
  return readPayoutProfile(db, ownerId, { email: settlementEmail, phone });
}

export async function createPayoutRequest(db, ownerId, service = 'ALL') {
  const normalized = normalizeService(service);
  if (!(await hasRecentConsent(db, ownerId, 'settlement-request'))) {
    throw portalError('정산정책 동의가 필요합니다.', 403, 'PARTNER_SETTLEMENT_CONSENT_REQUIRED');
  }
  const profile = await db.prepare(`SELECT owner_id FROM partner_payout_profiles WHERE owner_id = ? LIMIT 1`).bind(ownerId).first();
  if (!profile?.owner_id) throw portalError('먼저 정산정보를 저장해주세요.', 409, 'PARTNER_PAYOUT_PROFILE_REQUIRED');
  const pending = await pendingPayoutRequest(db, ownerId, normalized);
  if (pending) throw portalError('이미 처리 중인 지급 요청이 있습니다.', 409, 'PARTNER_PAYOUT_REQUEST_PENDING');
  const available = await availableCommissionAmount(db, ownerId, normalized);
  if (available < MIN_PAYOUT_KRW) {
    throw portalError(`${MIN_PAYOUT_KRW.toLocaleString('ko-KR')}원 이상부터 지급 요청할 수 있습니다.`, 409, 'PARTNER_PAYOUT_MINIMUM_NOT_MET', { availableAmount: available });
  }
  const requestId = payoutRequestId();
  const month = currentMonth();
  await db.prepare(`
    INSERT INTO partner_payout_requests (
      request_id, owner_id, settlement_month, service_scope, amount_krw,
      status, requested_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'requested', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(requestId, ownerId, month, normalized, available).run();
  return { requestId, month, service: normalized, amount: available, status: 'REQUESTED', requestedAt: new Date().toISOString() };
}

function clean(value = '', max = 120) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanEmail(value = '') {
  const email = String(value || '').trim().toLowerCase().slice(0, 240);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function payoutRequestId() {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `ptr_${Date.now().toString(36)}_${token}`;
}

async function encryptSensitive(value, env, purpose) {
  const configured = String(env.PARTNER_PAYOUT_ENCRYPTION_KEY || env.PARTNER_TOTP_ENCRYPTION_KEY || '').trim();
  if (configured.length < 32) {
    throw portalError('정산정보 암호화 키 설정이 필요합니다.', 503, 'PARTNER_PAYOUT_ENCRYPTION_KEY_REQUIRED');
  }
  const material = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`calltag-partner-payout:v1:${purpose}:${configured}`),
  );
  const key = await crypto.subtle.importKey('raw', material, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value));
  return {
    ciphertext: bytesToBase64Url(new Uint8Array(cipher)),
    iv: bytesToBase64Url(iv),
  };
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
