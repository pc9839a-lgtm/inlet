import { readOrCreateWorkspaceId, workspaceIdForAuthUser } from './authIdentity.js';

function safeId(value, fallback) {
  const cleaned = String(value || '').replace(/[^a-zA-Z0-9-_]/g, '');
  return cleaned || fallback;
}

export function projectContext(page = {}, authUser = null) {
  const slug = safeId(page.slug, 'my-page');
  const workspaceId = authUser ? '' : readOrCreateWorkspaceId();
  const legacyOwnerId = safeId(authUser?.email || authUser?.id || authUser?.name || '', '');
  const ownerSource = authUser ? workspaceIdForAuthUser(authUser) : workspaceId;
  const ownerId = safeId(ownerSource, 'local-user');
  const projectId = safeId(page.projectId || `${ownerId}_${slug}`, `${ownerId}_${slug}`);

  return {
    ownerId,
    projectId,
    slug,
    session: authUser?.session || '',
    legacyOwnerId,
    legacyProjectId: legacyOwnerId ? safeId(`${legacyOwnerId}-${slug}`, '') : '',
  };
}
