export function tabFromLocation(tabKeys, fallback = 'edit') {
  if (typeof location === 'undefined') return fallback;
  const requested = new URLSearchParams(location.search).get('tab') || '';
  return tabKeys.has(requested) ? requested : fallback;
}

export function hasTabDeepLink(tabKeys) {
  if (typeof location === 'undefined') return false;
  return tabKeys.has(new URLSearchParams(location.search).get('tab') || '');
}

export function replaceLocationTab(tabKeys, nextTab) {
  if (typeof location === 'undefined' || typeof history === 'undefined') return;
  if (!tabKeys.has(nextTab)) return;
  const url = new URL(location.href);
  url.searchParams.set('tab', nextTab);
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}
