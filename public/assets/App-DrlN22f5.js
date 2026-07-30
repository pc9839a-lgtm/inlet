const reloadLatestPageroRuntime = () => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('__fresh', String(Date.now()));
  window.location.replace(url.toString());
};

if (typeof caches !== 'undefined') {
  caches.keys()
    .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
    .catch(() => undefined)
    .finally(reloadLatestPageroRuntime);
} else {
  reloadLatestPageroRuntime();
}

export default function StalePageroAppChunk() {
  return null;
}
