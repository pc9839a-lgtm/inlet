export const SETTINGS_LOCKED_INITIAL = { basic: false, managers: false, seo: false, tracking: false };

export function createBasicDraft(page = {}) {
  return {
    title: page.title || '',
    slug: page.slug || '',
  };
}

export function createSeoDraft(page = {}) {
  const meta = page.meta || {};
  return {
    title: meta.title || '',
    desc: meta.desc || '',
    favicon: meta.favicon || '',
    og: meta.og || '',
    naverWebmaster: meta.naverWebmaster || '',
    console: meta.console || '',
  };
}

export function createTrackingDraft(page = {}) {
  const meta = page.meta || {};
  return {
    gtm: meta.gtm || '',
    ga4: meta.ga4 || '',
    googleAdsTag: meta.googleAdsTag || '',
    pixel: meta.pixel || '',
    naver: meta.naver || '',
    kakao: meta.kakao || '',
  };
}

export function createConversionReady(page = {}) {
  const meta = page.meta || {};
  return {
    ads: !!String(meta.ads || '').trim(),
    pixel: !!String(meta.pixel || '').trim(),
    naver: !!String(meta.naver || '').trim(),
    kakao: !!String(meta.kakao || '').trim(),
  };
}

export function hasConversionMeta(page = {}) {
  const ready = createConversionReady(page);
  return Object.values(ready).some(Boolean);
}

export function hasAnyConversionValue(conversionReady = {}) {
  return Object.values(conversionReady).some(Boolean);
}

export function isBasicDraftDirty(draft = {}, source = {}) {
  return (draft.title || '') !== (source.title || '') || (draft.slug || '') !== (source.slug || '');
}