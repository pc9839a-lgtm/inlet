const DEFAULT_PLATFORM_MASTER_EMAILS = Object.freeze([
  'admin@pagero.kr',
  'roadfor@kakao.com',
  'pc9839a@naver.com',
]);

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function platformMasterEmails(env = {}) {
  const configured = String(env.INLET_PLATFORM_MASTER_EMAILS || '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);
  return [...new Set([...DEFAULT_PLATFORM_MASTER_EMAILS, ...configured])];
}

export function isPlatformMasterIdentity(identity = null, env = {}) {
  const email = normalizeEmail(identity?.email || '');
  return !!email && platformMasterEmails(env).includes(email);
}

export function withPlatformMaster(user = {}, env = {}) {
  return {
    ...user,
    platformMaster: isPlatformMasterIdentity(user, env),
  };
}

export { DEFAULT_PLATFORM_MASTER_EMAILS };
