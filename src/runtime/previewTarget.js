import { isServerPageMode, publicLandingUrl } from '../config/runtimeConfig.js';

export function localPreviewUrl(slug = '') {
  const safeSlug = String(slug || '').replace(/^\/+/, '');
  if (typeof location === 'undefined') return `/${safeSlug}`;
  return `${location.origin}/${safeSlug}`;
}

export function previewUrlForPage(page = {}) {
  const slug = page?.slug || '';
  return isServerPageMode() ? publicLandingUrl(slug) : localPreviewUrl(slug);
}

export function createPreviewPage({ page, stylePreviewTheme = null, stylePreviewBlocks = null, mapSiteId = '' } = {}) {
  const basePage = page || {};
  const nextPage = {
    ...basePage,
    theme: stylePreviewTheme ? { ...basePage.theme, ...stylePreviewTheme } : basePage.theme,
    blocks: stylePreviewBlocks || basePage.blocks,
  };
  return { ...nextPage, mapSiteId };
}
