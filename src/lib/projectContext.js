import { hasAccountProjectAccess } from './accountProjectAccess.js';
import { readOrCreateWorkspaceId, workspaceIdForAuthUser } from './authIdentity.js';
import { sanitizePageSlug } from './pageSlugs.js';

function safeId(value, fallback) {
  const cleaned = String(value || '').replace(/[^a-zA-Z0-9-_]/g, '');
  return cleaned || fallback;
}

function pageProjectIdForOwner(page = {}, ownerId = '') {
  const current = safeId(page.projectId || page.id || '', '');
  const currentOwner = safeId(page.ownerId || page.ownerAccountId || '', '');
  if (!current) return '';
  if (hasAccountProjectAccess(page)) return current;
  if (!ownerId) return current;
  if (currentOwner && currentOwner !== ownerId) return '';
  if (current.startsWith(`${ownerId}_`)) return current;
  if (currentOwner === ownerId) return current;
  return '';
}

export function projectContext(page = {}, authUser = null) {
  if (authUser?.projectId && authUser?.ownerId) {
    const slug = safeId(sanitizePageSlug(page.slug || authUser.slug, 'my-page'), 'my-page');
    const authOwnerId = safeId(authUser.ownerId, 'local-user');
    const ownerId = hasAccountProjectAccess(page)
      ? safeId(page.ownerId || page.ownerAccountId, authOwnerId)
      : authOwnerId;
    const defaultProjectSlug = safeId(sanitizePageSlug(authUser.defaultProject?.slug || authUser.slug || '', ''), '');
    const defaultProjectId = defaultProjectSlug && defaultProjectSlug === slug ? safeId(authUser.defaultProject?.projectId || authUser.projectId, '') : '';
    const sessionProjectId = defaultProjectSlug && defaultProjectSlug === slug ? safeId(authUser.projectId, '') : '';
    return {
      ownerId,
      projectId: safeId(pageProjectIdForOwner(page, ownerId) || defaultProjectId || sessionProjectId || `${ownerId}_${slug}`, `${ownerId}_${slug}`),
      slug,
      session: authUser.session || '',
      legacyOwnerId: safeId(authUser.legacyOwnerId || '', ''),
      legacyProjectId: safeId(authUser.legacyProjectId || '', ''),
    };
  }

  const slug = safeId(sanitizePageSlug(page.slug, 'my-page'), 'my-page');
  const publicProjectId = safeId(page.projectId || page.id || '', '');
  if (!authUser && publicProjectId) {
    return {
      ownerId: '',
      projectId: publicProjectId,
      slug,
      session: '',
      legacyOwnerId: '',
      legacyProjectId: '',
    };
  }

  const workspaceId = authUser ? '' : readOrCreateWorkspaceId();
  const legacyOwnerId = safeId(authUser?.email || authUser?.id || authUser?.name || '', '');
  const ownerSource = authUser ? workspaceIdForAuthUser(authUser) : workspaceId;
  const authOwnerId = safeId(ownerSource, 'local-user');
  const ownerId = hasAccountProjectAccess(page)
    ? safeId(page.ownerId || page.ownerAccountId, authOwnerId)
    : authOwnerId;
  const projectId = safeId(pageProjectIdForOwner(page, ownerId) || `${ownerId}_${slug}`, `${ownerId}_${slug}`);

  return {
    ownerId,
    projectId,
    slug,
    session: authUser?.session || '',
    legacyOwnerId,
    legacyProjectId: legacyOwnerId ? safeId(`${legacyOwnerId}-${slug}`, '') : '',
  };
}
