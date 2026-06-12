export const RESERVED_PAGE_SLUGS = new Set(['admin', 'api', 'invite', 'login', 'signup', 'terms', 'privacy', 'contact']);

export function sanitizePageSlug(value = '', fallback = 'page') {
  const cleaned = String(value || '').trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned || fallback;
}

export function pageSlugIssues(value = '') {
  const raw = String(value || '').trim();
  const slug = sanitizePageSlug(raw, '');
  const issues = [];
  if (!slug) issues.push('URL을 입력해주세요.');
  if (slug.length < 3) issues.push('URL은 3자 이상 입력해주세요.');
  if (slug.length > 48) issues.push('URL은 48자 이하로 입력해주세요.');
  if (RESERVED_PAGE_SLUGS.has(slug)) issues.push('예약어는 URL로 사용할 수 없습니다.');
  if (raw && slug !== raw.toLowerCase()) issues.push('영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.');
  return issues;
}

export function shortStableSlugHash(value = '') {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(6, '0').slice(0, 6);
}

export function createUniquePageSlug(base = 'page', authUser = null) {
  return sanitizePageSlug(base || authUser?.slug || 'page', 'page').slice(0, 48);
}

export function shouldAutoReplaceSlug(slug = '') {
  return false;
}
