import { isServerPageMode, publicLandingUrl } from '../config/runtimeConfig.js';

// The current workspace draft is ephemeral and is never written to a public URL.
// App.jsx already constructs this model on every draft change, including style previews.
let currentEditorDraftPreview = null;

export function getEditorDraftPreviewPage() {
  return currentEditorDraftPreview;
}

export function visiblePreviewBlocks(page = {}) {
  const suppressTopNav = page.slug === 'our-wedding-day' || page.title === '모바일 청첩장';
  return (page.blocks || []).filter((block) => block.visible && !(block.type === 'topnav' && (suppressTopNav || block.s?.omitRender)));
}

// FormBlocks checks the original lead's isTest flag before firing its legacy
// conversion event. Set that flag on the same object, without persisting it.
export function simulateEditorPreviewLead(lead = {}) {
  if (lead && typeof lead === 'object') lead.isTest = true;
  return Promise.resolve({ ...lead, isTest: true });
}

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
  const draft = { ...nextPage, mapSiteId };
  currentEditorDraftPreview = draft;
  return draft;
}
