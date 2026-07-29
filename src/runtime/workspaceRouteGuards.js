export function isProtectedWorkspacePath(path = '') {
  if (typeof location === 'undefined' && !path) return false;
  const pathname = String(path || location.pathname || '/').replace(/\/+$/, '') || '/';
  return /^\/(?:dashboard|app|account)(?:\/|$)/.test(pathname);
}

export function initialWorkspaceOpen(path = '', storedOpen = false) {
  const pathname = String(path || '/').replace(/\/+$/, '') || '/';
  if (/^\/app(?:\/|$)/.test(pathname)) return true;
  if (/^\/(?:dashboard|account)(?:\/|$)/.test(pathname)) return false;
  return !!storedOpen;
}
export function routeUsesWorkspaceTabs({ publicLandingSlug, staticPage, inviteToken, adminRoute, authRouteMode } = {}) {
  return !publicLandingSlug && !staticPage && !inviteToken && !adminRoute && !authRouteMode;
}
