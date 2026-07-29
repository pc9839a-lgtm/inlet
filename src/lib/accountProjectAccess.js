const rememberedProjects = new Set();

function accessKey(page = {}) {
  const projectId = String(page.projectId || page.id || '').trim();
  if (!projectId) return '';
  const ownerId = String(page.ownerId || page.ownerAccountId || '').trim();
  const slug = String(page.slug || '').trim();
  return `${projectId}|${ownerId}|${slug}`;
}

export function rememberAccountProjectAccess(page = {}) {
  const key = accessKey(page);
  if (key) rememberedProjects.add(key);
}

export function hasAccountProjectAccess(page = {}) {
  if (page.__accountProjectAccess === true) return true;
  const key = accessKey(page);
  return !!key && rememberedProjects.has(key);
}
