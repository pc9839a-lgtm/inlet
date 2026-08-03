const DEFAULT_MASTER_EMAILS = ['admin@pagero.kr', 'roadfor@kakao.com', 'pc9839a@naver.com'];

function normalizedRole(value = '') {
  return String(value || '').trim().toLowerCase().replace(/[-\s]/g, '_');
}

export function platformMasterEmails(env = {}) {
  const configured = String(env.INLET_PLATFORM_MASTER_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_MASTER_EMAILS, ...configured])];
}

export function assertPlatformMaster(identity = null, env = {}) {
  const email = String(identity?.email || '').trim().toLowerCase();
  const role = normalizedRole(identity?.role);
  if (
    platformMasterEmails(env).includes(email)
    || ['platformmaster', 'platform_master', 'superadmin', 'serviceadmin'].includes(role)
  ) return identity;

  const error = new Error('전체 관리자 권한이 필요합니다.');
  error.status = identity ? 403 : 401;
  error.code = 'PLATFORM_MASTER_REQUIRED';
  error.details = { code: 'PLATFORM_MASTER_REQUIRED' };
  throw error;
}
