export function normalizeUtmValue(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 80);
}

export function trafficAttributionFromUrl(url = '') {
  const text = String(url || '').trim();
  if (!text) return { utmSource: '', utmMedium: '', utmCampaign: '', channel: 'direct' };
  try {
    const parsed = new URL(text, 'https://inlet.local');
    const utmSource = normalizeUtmValue(parsed.searchParams.get('utm_source'));
    const utmMedium = normalizeUtmValue(parsed.searchParams.get('utm_medium'));
    const utmCampaign = normalizeUtmValue(parsed.searchParams.get('utm_campaign'));
    return {
      utmSource,
      utmMedium,
      utmCampaign,
      channel: utmSource || 'direct',
    };
  } catch {
    return { utmSource: '', utmMedium: '', utmCampaign: '', channel: 'direct' };
  }
}

export function currentTrafficAttribution() {
  const sourceUrl = typeof location !== 'undefined' ? location.href : '';
  return {
    ...trafficAttributionFromUrl(sourceUrl),
    sourceUrl,
  };
}

export function trafficChannelFromItem(item = {}) {
  const fromExplicitUtm = normalizeUtmValue(item.utmSource || item.utm_source);
  if (fromExplicitUtm) return fromExplicitUtm;
  const fromSourceUrl = trafficAttributionFromUrl(item.sourceUrl || item.source_url || item.url || '').utmSource;
  return fromSourceUrl || 'direct';
}
