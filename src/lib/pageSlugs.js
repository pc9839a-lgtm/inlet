const TEMPLATE_BASE_SLUGS = new Set([
  'my-page',
  'restart-law-care',
  'our-wedding-day',
  'lumiere-riverpark',
]);

export function sanitizePageSlug(value = '', fallback = 'page') {
  const cleaned = String(value || '').trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned || fallback;
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
