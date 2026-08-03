import { assertD1 } from '../../_shared.js';
import {
  createGoogleLoginTicket,
  exchangeGoogleCode,
  findOrCreateGoogleAccount,
  googleAppRedirect,
  verifyGoogleState,
} from './_shared.js';

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  let state = { returnScheme: 'calltag' };
  try {
    state = await verifyGoogleState(url.searchParams.get('state') || '', env);
    const providerError = String(url.searchParams.get('error') || '').trim();
    if (providerError) {
      return Response.redirect(googleAppRedirect(state, {
        error: 'GOOGLE_LOGIN_CANCELLED',
        message: 'Google 로그인이 취소되었습니다.',
      }), 302);
    }
    const code = String(url.searchParams.get('code') || '').trim();
    if (!code) throw new Error('Google 인증 코드가 없습니다.');
    const db = assertD1(env);
    const googleProfile = await exchangeGoogleCode(code, env);
    const user = await findOrCreateGoogleAccount(db, googleProfile);
    const ticket = await createGoogleLoginTicket(db, user);
    return Response.redirect(googleAppRedirect(state, { ticket }), 302);
  } catch (error) {
    const code = String(error?.details?.code || 'GOOGLE_LOGIN_FAILED');
    const message = String(error?.message || 'Google 로그인을 완료하지 못했습니다.').slice(0, 180);
    return Response.redirect(googleAppRedirect(state, { error: code, message }), 302);
  }
}
