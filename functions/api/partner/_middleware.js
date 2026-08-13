import { handleApiError } from '../_shared.js';
import { PARTNER_SECURITY_METHODS, requireSettlementStepup } from './_security.js';

const PUBLIC_SECURITY_PATHS = new Set([
  '/api/partner/login',
  '/api/partner/logout',
  '/api/partner/sso-exchange',
  '/api/partner/me',
  '/api/partner/security',
  '/api/partner/totp/setup',
  '/api/partner/totp/enable',
  '/api/partner/totp/verify',
  '/api/partner/totp/fresh',
  '/api/partner/totp/recovery-email',
  '/api/partner/totp/recover',
]);

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return context.next();
  const pathname = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
  if (PUBLIC_SECURITY_PATHS.has(pathname)) return context.next();
  try {
    await requireSettlementStepup(request, env);
    return context.next();
  } catch (error) {
    return handleApiError(request, env, error, PARTNER_SECURITY_METHODS);
  }
}
