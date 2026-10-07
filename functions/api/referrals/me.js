import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../_shared.js';
import { CALL_METHODS, callSession } from '../call/_shared.js';
import { referralMe } from '../billing/_shared.js';
import { ensureCallTagReferralSchema } from './_calltag-store.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, CALL_METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(request, env, 405, {
      ok: false,
      error: '허용되지 않는 요청 방식입니다.',
    }, CALL_METHODS);
  }
  try {
    const db = assertD1(env);
    const session = await callSession(request, env);
    const referral = await referralMe(db, session.ownerId);
    const productClient = String(request.headers.get('X-Pagero-Product') || '').trim().toLowerCase();
    if (productClient === 'calltag') {
      await ensureCallTagReferralSchema(db);
      const applied = await db.prepare(`
        SELECT referral_code, bonus_days, status, applied_at
        FROM calltag_referrals
        WHERE referred_owner_id = ?
        LIMIT 1
      `).bind(session.ownerId).first();
      referral.applied = !!applied;
      referral.appliedCode = String(applied?.referral_code || '').trim();
      referral.bonusDays = Number(applied?.bonus_days || 0);
      referral.appliedAt = String(applied?.applied_at || '').trim();
    }
    const code = String(referral.code || referral.mine?.code || '').trim();
    const shareUrl = code ? `https://pagero.kr/r/${encodeURIComponent(code)}` : '';
    referral.shareUrl = shareUrl;
    if (referral.mine) referral.mine.shareUrl = shareUrl;
    return jsonResponse(request, env, 200, { ok: true, referral }, CALL_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, CALL_METHODS);
  }
}
