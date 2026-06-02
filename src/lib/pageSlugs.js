const TEMPLATE_BASE_SLUGS = new Set([
  'my-page',
  'restart-law-care',
  'our-wedding-day',
  'lumiere-riverpark',
]);

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

export function randomSlugSuffix() {
  const time = Date.now().toString(36).slice(-4);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(2);
    crypto.getRandomValues(bytes);
    return `${time}${Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0')).join('').slice(0, 4)}`;
  }
  return `${time}${Math.random().toString(36).slice(2, 6)}`;
}

export function createUniquePageSlug(base = 'page', authUser = null) {
  const safeBase = sanitizePageSlug(base, 'page').slice(0, 42);
  const identity = authUser?.workspaceId || authUser?.email || authUser?.id || '';
  const ownerPart = shortStableSlugHash(identity || randomSlugSuffix());
  return sanitizePageSlug(`${safeBase}-${ownerPart}-${randomSlugSuffix()}`, 'page');
}

export function shouldAutoReplaceSlug(slug = '') {
  return TEMPLATE_BASE_SLUGS.has(sanitizePageSlug(slug, 'my-page'));
}
