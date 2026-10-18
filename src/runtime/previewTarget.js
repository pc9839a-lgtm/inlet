import { isServerPageMode, publicLandingUrl } from '../config/runtimeConfig.js';
import { getVideoSource } from '../lib/youtubeEmbed.js';

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

// Editor preview executes neither custom HTML nor third-party video embeds.
// A same-origin file download may load media metadata, but cannot execute JS.
export function isEditorPreviewSafeMediaBlock(block, currentOrigin = '') {
  if (block?.type !== 'code' || block.s?.widgetMode !== 'youtube') return false;
  const source = getVideoSource(block.s.videoUrl || block.s.youtubeUrl || '');
  if (source?.kind !== 'file') return false;
  if (/^data:video\//i.test(source.src)) return true;
  if (!currentOrigin) return false;
  try {
    const address = new URL(source.src);
    return address.origin === new URL(currentOrigin).origin
      && address.pathname === '/api/files/download';
  } catch {
    return false;
  }
}
