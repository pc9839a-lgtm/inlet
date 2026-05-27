import { apiFetch } from './apiClient.js';

export function normalizeExternalUrl(url = '') {
  const raw = String(url || '').trim();
  if (!raw || raw === 'https://' || raw === 'http://') return '';
  if (/^tel:/i.test(raw)) return raw;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export function linkThumbnailFromUrl(url = '') {
  try {
    const normalized = normalizeExternalUrl(url);
    if (!/^https?:\/\//i.test(normalized)) return '';
    const host = new URL(normalized).hostname;
    if (!host) return '';
    return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(normalized)}&sz=128`;
  } catch {
    return '';
  }
}

export function linkHostLabel(raw = '') {
  const normalized = normalizeExternalUrl(raw || '');
  if (!normalized) return '';
  try {
    const url = new URL(normalized);
    return (url.hostname || '').replace(/^www\./, '').toUpperCase();
  } catch {
    return '';
  }
}

export function isProductLink(raw = '') {
  const normalized = normalizeExternalUrl(raw || '');
  try {
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    const path = url.pathname.toLowerCase();
    return (
      host.includes('coupang') ||
      host.includes('smartstore') ||
      host.includes('shopping.naver') ||
      host.includes('brand.naver') ||
      path.includes('/products/') ||
      path.includes('/vp/products/')
    );
  } catch {
    return false;
  }
}

export function svgThumbDataUrl(text = 'SHOP', bg = '#111827') {
  const safeText = String(text || 'SHOP').slice(0, 12);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
      <rect width="600" height="600" rx="88" fill="${bg}"/>
      <text x="300" y="318" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="76" font-weight="900">${safeText}</text>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function fallbackProductThumb(raw = '') {
  const host = linkHostLabel(raw);
  if (host.includes('COUPANG')) return svgThumbDataUrl('COUPANG', '#e52528');
  if (host.includes('NAVER')) return svgThumbDataUrl('NAVER', '#03c75a');
  return svgThumbDataUrl('SHOP', '#111827');
}

export async function fetchLinkPreview(url = '') {
  const normalized = normalizeExternalUrl(url);
  if (!/^https?:\/\//i.test(normalized)) {
    return { image: '', title: '', description: '', site: '' };
  }

  const fallback = isProductLink(normalized)
    ? fallbackProductThumb(normalized)
    : linkThumbnailFromUrl(normalized);

  try {
    const res = await apiFetch(`/api/link-preview?url=${encodeURIComponent(normalized)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (res.ok) {
      const data = await res.json();
      return {
        image: data?.image || fallback,
        title: data?.title || '',
        description: data?.description || '',
        site: data?.site || linkHostLabel(normalized),
      };
    }
  } catch {}

  try {
    const endpoint = `https://api.microlink.io/?screenshot=false&url=${encodeURIComponent(normalized)}`;
    const res = await fetch(endpoint);
    if (!res.ok) return { image: fallback, title: '', description: '', site: linkHostLabel(normalized) };
    const json = await res.json();
    const data = json?.data || {};
    return {
      image: data?.image?.url || data?.logo?.url || fallback,
      title: data?.title || '',
      description: data?.description || '',
      site: data?.publisher || data?.author || linkHostLabel(normalized),
    };
  } catch {
    return { image: fallback, title: '', description: '', site: linkHostLabel(normalized) };
  }
}

export async function fetchLinkThumbnail(url = '') {
  const preview = await fetchLinkPreview(url);
  return preview.image || '';
}
