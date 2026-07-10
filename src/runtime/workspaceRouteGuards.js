export function isProtectedWorkspacePath(path = '') {
  if (typeof location === 'undefined' && !path) return false;
  const pathname = String(path || location.pathname || '/').replace(/\/+$/, '') || '/';
  return /^\/(?:dashboard|app|account)(?:\/|$)/.test(pathname);
}

export function routeUsesWorkspaceTabs({ publicLandingSlug, staticPage, inviteToken, adminRoute, authRouteMode } = {}) {
  return !publicLandingSlug && !staticPage && !inviteToken && !adminRoute && !authRouteMode;
}
