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
    const parsed = new URL(text, 'https://pagero.local');
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

export function trafficChannelFromReferrer(referrer = '') {
  const text = String(referrer || '').trim();
  if (!text) return 'direct';
  try {
    const host = new URL(text).hostname.toLowerCase();
    if (host.includes('naver.')) return 'naver';
    if (host.includes('google.')) return 'google';
    if (host.includes('kakao.') || host.includes('daum.')) return 'kakao';
    if (host.includes('instagram.')) return 'instagram';
    if (host.includes('facebook.') || host.includes('fb.')) return 'meta';
    if (host.includes('youtube.') || host.includes('youtu.be')) return 'youtube';
    return 'referral';
  } catch {
    return 'direct';
  }
}

export function currentTrafficAttribution() {
  const sourceUrl = typeof location !== 'undefined' ? location.href : '';
  const referrer = typeof document !== 'undefined' ? document.referrer : '';
  const urlTraffic = trafficAttributionFromUrl(sourceUrl);
  const referrerChannel = trafficChannelFromReferrer(referrer);
  const channel = urlTraffic.channel !== 'direct' ? urlTraffic.channel : referrerChannel;
  return {
    ...urlTraffic,
    channel,
    sourceUrl,
    referrer,
    sourceLabel: trafficSourceLabel({ ...urlTraffic, channel, referrer, sourceUrl }),
  };
}

export function trafficChannelFromItem(item = {}) {
  const fromExplicitUtm = normalizeUtmValue(item.utmSource || item.utm_source);
  if (fromExplicitUtm) return fromExplicitUtm;
  const fromSourceUrl = trafficAttributionFromUrl(item.sourceUrl || item.source_url || item.url || '').utmSource;
  if (fromSourceUrl) return fromSourceUrl;
  const channel = normalizeUtmValue(item.channel || item.source || '');
  if (channel) return channel;
  return trafficChannelFromReferrer(item.referrer || '');
}

export function trafficSourceLabel(item = {}) {
  const channel = trafficChannelFromItem(item);
  const labels = {
    direct: '직접 유입',
    referral: '외부 링크',
    naver: '네이버',
    google: '구글',
    kakao: '카카오',
    instagram: '인스타그램',
    meta: '페이스북/메타',
    youtube: '유튜브',
  };
  if (item.utmCampaign) return `${labels[channel] || channel} · ${item.utmCampaign}`;
  return labels[channel] || channel || '직접 유입';
}
