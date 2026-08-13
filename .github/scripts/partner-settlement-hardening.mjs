import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const portal = read('functions/api/partner/_portal.js');
const middleware = read('functions/api/partner/_middleware.js');
const payout = read('functions/api/partner/payout-profile.js');
const request = read('functions/api/partner/settlements/request.js');
const logout = read('functions/api/partner/logout.js');
const security = read('functions/api/partner/_security.js');
const fresh = read('functions/api/partner/_fresh.js');
const commissions = read('functions/api/billing/_commissions.js');
const partnerRate = read('functions/api/call/admin/partner-rate.js');
const settlementPay = read('functions/api/call/admin/settlement-pay.js');

function includesAll(source, values, label) {
  for (const value of values) assert.ok(source.includes(value), `${label}: missing ${value}`);
}

function parseProducts(source, service, fnName) {
  const fnStart = source.indexOf(`function ${fnName}`) >= 0
    ? source.indexOf(`function ${fnName}`)
    : source.indexOf(`export function ${fnName}`);
  assert.ok(fnStart >= 0, `missing ${fnName}`);
  const chunk = source.slice(fnStart, fnStart + 1800);
  const marker = service === 'PAGERO' ? "service === 'PAGERO'" : "service === 'CALLTAG'";
  const altMarker = service === 'PAGERO' ? "normalized === 'PAGERO'" : "normalized === 'CALLTAG'";
  const markerPos = Math.max(chunk.indexOf(marker), chunk.indexOf(altMarker));
  assert.ok(markerPos >= 0, `${fnName}: missing ${service} branch`);
  const tail = chunk.slice(markerPos, markerPos + 420);
  const match = tail.match(/IN \(([^)]+)\)/);
  assert.ok(match, `${fnName}: missing ${service} product IN clause`);
  return match[1].split(',').map((v) => v.replace(/[\s'"`]/g, '')).filter(Boolean).sort();
}

// 1) Partner finance APIs are step-up protected by default.
includesAll(portal, ['requireSettlementStepup', 'partnerPortalContext'], 'portal step-up');
for (const endpoint of ['/api/partner/dashboard', '/api/partner/referrals', '/api/partner/earnings', '/api/partner/settlements', '/api/partner/payout-profile', '/api/partner/policies']) {
  assert.ok(!middleware.includes(`'${endpoint}'`), `sensitive endpoint must not be public: ${endpoint}`);
}
includesAll(middleware, ['requireSettlementStepup(request, env)'], 'middleware');

// 2) Payout profile changes and payout requests require a fresh TOTP (5-minute window).
includesAll(payout, ['requireFreshSensitiveStepup(request, env)', "request.method === 'PUT'"], 'payout fresh TOTP');
includesAll(request, ['requireFreshSensitiveStepup(request, env)', 'createPayoutRequest'], 'request fresh TOTP');
includesAll(fresh, ['PARTNER_FRESH_TTL_SECONDS = 5 * 60', 'PARTNER_TOTP_FRESH_REQUIRED'], 'fresh session');

// 3) Logout destroys all settlement-side reusable sessions and cookies.
includesAll(logout, [
  'revokeSettlementSessions(env.DB, auth.ownerId)',
  'revokeFreshSensitiveSessions(env.DB, auth.ownerId)',
  'clearPartnerAuthCookie(request)',
  'clearPartnerStepupCookie(request)',
  'clearPartnerFreshCookie(request)',
], 'logout');

// 4) Admin/email recovery TOTP reset removes secret material and invalidates old step-up sessions.
includesAll(security, [
  "secret_ciphertext = ''",
  "secret_iv = ''",
  "pending_secret_ciphertext = ''",
  "pending_secret_iv = ''",
  "enabled_at = ''",
  'last_used_counter = -1',
  'await revokeSettlementSessions(db, ownerId)',
  'adminResetPartnerTotp',
  'recoverTotpByEmail',
], 'TOTP reset');

// 5) CALLTAG/PAGERO service partitions must be disjoint and identical between request and admin payout paths.
const portalCalltag = parseProducts(portal, 'CALLTAG', 'serviceCondition');
const portalPagero = parseProducts(portal, 'PAGERO', 'serviceCondition');
const adminCalltag = parseProducts(settlementPay, 'CALLTAG', 'serviceSql');
const adminPagero = parseProducts(settlementPay, 'PAGERO', 'serviceSql');
assert.deepEqual(portalCalltag, adminCalltag, 'CALLTAG products differ between request and payout');
assert.deepEqual(portalPagero, adminPagero, 'PAGERO products differ between request and payout');
assert.equal(portalCalltag.filter((x) => portalPagero.includes(x)).length, 0, 'CALLTAG/PAGERO product sets overlap');
assert.deepEqual(portalCalltag, ['all_monthly', 'call_monthly', 'message_monthly']);
assert.deepEqual(portalPagero, ['pagero_domain_monthly', 'pagero_monthly', 'pagero_pro_monthly']);

// 6) A payout is tied to the immutable payout request snapshot, not arbitrary current payable balance.
includesAll(settlementPay, [
  'const requestId = payoutRequestIdInput',
  'WHERE request_id = ? AND owner_id = ?',
  "String(payoutRequest.status || '') !== 'requested'",
  'requestedAmountKrw !== expectedAmountKrw',
  'payoutRequest.requested_at',
  "status = CASE",
  'processed_at',
], 'payout request binding');

// 7) 20%/50% changes affect future commission creation only.
includesAll(commissions, [
  'resolvePartnerCommissionRateBps(db, referrerOwnerId)',
  'commissionAmountKrw = Math.floor(baseAmountKrw * commissionRateBps / 10000)',
  'INSERT OR IGNORE INTO partner_commissions',
], 'commission snapshot');
includesAll(partnerRate, [
  "appliesTo: 'future_commissions'",
  'commission_rate_bps = excluded.commission_rate_bps',
], 'rate update');
assert.ok(!partnerRate.includes('UPDATE partner_commissions'), 'rate update must not rewrite historical commissions');

// 8) Minimum payout is explicitly enforced server-side.
includesAll(portal, ['export const MIN_PAYOUT_KRW = 10000', 'available < MIN_PAYOUT_KRW', 'PARTNER_PAYOUT_MINIMUM_NOT_MET'], 'minimum payout');

console.log('partner settlement hardening contract: OK');
console.log(JSON.stringify({
  protectedByStepup: true,
  freshTotpForSensitiveWrites: true,
  logoutRevokesAllSettlementSessions: true,
  totpResetRevokesOldCodes: true,
  calltagProducts: portalCalltag,
  pageroProducts: portalPagero,
  rateChangeFutureOnly: true,
  minimumPayoutKrw: 10000,
}, null, 2));
