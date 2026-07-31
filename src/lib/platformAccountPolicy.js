const DEFAULT_PLATFORM_MASTER_EMAILS = new Set([
  'admin@pagero.kr',
  'roadfor@kakao.com',
  'pc9839a@naver.com',
]);

export const GENERAL_ACCOUNT_PAGE_LIMIT = 1;

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function isPlatformMasterUser(user = null) {
  if (!user) return false;
  if (user.platformMaster === true || user.isPlatformMaster === true) return true;
  return DEFAULT_PLATFORM_MASTER_EMAILS.has(normalizeEmail(user.email || ''));
}

export function canCreateLandingPage(user = null, currentPageCount = 0) {
  if (isPlatformMasterUser(user)) return true;
  return Math.max(0, Number(currentPageCount || 0)) < GENERAL_ACCOUNT_PAGE_LIMIT;
}
