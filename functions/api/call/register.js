import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import {
  AUTH_METHODS,
  authError,
  createSessionToken,
  loginAccount,
  normalizePhone,
  registerAccount,
} from '../auth/_auth.js';
import {
  ensurePendingEntitlement,
  entitlementPublic,
  getCallProfile,
  profilePublic,
  upsertCallProfile,
} from './_shared.js';
import {
  applyCallTagSignupReferralCode,
  normalizeSignupReferralCode,
  validateSignupReferralCode,
} from '../referrals/_calltag-signup.js';
import {
  enforceCallTagTrialPolicy,
  resolveCallTagEntitlement,
} from '../billing/trial-policy.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);
  try {
    const db = assertD1(env);
    const input = await readJson(request);
    const name = String(input.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    const phone = normalizePhone(input.phone || '');
    const brandName = String(input.brandName || '').trim().replace(/\s+/g, ' ').slice(0, 100) || '개인';
    const industry = String(input.industry || '').trim().replace(/\s+/g, ' ').slice(0, 100) || '기타';
    const referralCode = normalizeSignupReferralCode(input.referralCode || input.partnerCode || '');

    if (!name) {
      throw authError('이름을 입력해주세요.', 400, { code: 'AUTH_NAME_REQUIRED', field: 'name' });
    }
    if (!phone) {
      throw authError('연락처를 정확히 입력해주세요.', 400, { code: 'AUTH_PHONE_REQUIRED', field: 'phone' });
    }
    if (referralCode) {
      await validateSignupReferralCode(db, referralCode);
    }

    let user;
    let recovered = false;
    try {
      user = await registerAccount({
        name,
        phone,
        email: input.email,
        password: input.password,
        token: input.token || input.verificationToken,
        source: 'calllink_app',
      }, env);
    } catch (error) {
      if (String(error?.details?.code || '') !== 'AUTH_EMAIL_DUPLICATE') throw error;

      const existing = await loginAccount({
        email: input.email,
        password: input.password,
        projectId: 'calllink',
        role: 'calllink_user',
      }, env);
      const existingOwnerId = String(existing.user?.ownerId || existing.user?.id || '');
      const existingProfile = await getCallProfile(env.DB, existingOwnerId);

      if (existingProfile) throw error;
      if (normalizePhone(existing.user?.phone || '') !== phone) {
        throw authError('기존 가입 연락처와 일치하지 않습니다.', 409, {
          code: 'AUTH_PHONE_MISMATCH',
          field: 'phone',
        });
      }

      user = existing.user;
      recovered = true;
    }

    const profile = await upsertCallProfile(env.DB, {
      ownerId: user.ownerId,
      email: user.email,
      name,
      phone,
      brandName,
      industry,
    });

    await enforceCallTagTrialPolicy(db, user.ownerId);
    const referral = referralCode
      ? await applyCallTagSignupReferralCode(db, user.ownerId, referralCode)
      : null;
    const billingEntitlement = await resolveCallTagEntitlement(db, user.ownerId);
    const entitlement = await ensurePendingEntitlement(env.DB, user.ownerId);
    const session = await createSessionToken({
      ownerId: user.ownerId,
      projectId: 'calllink',
      role: 'calllink_user',
      email: user.email,
    }, env);
    return jsonResponse(request, env, 200, {
      ok: true,
      recovered,
      user,
      profile: profilePublic(profile, user),
      entitlement: entitlementPublic(entitlement),
      billingEntitlement,
      referral,
      session,
    }, AUTH_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, AUTH_METHODS);
  }
}
