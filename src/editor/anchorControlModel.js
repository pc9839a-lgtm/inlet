import { slugifyAnchor } from '../lib/pageModel.js';

export function anchorClipboardText(value = '') {
  return `#${value || ''}`;
}

export function anchorPatch(nextValue, blockType) {
  return { anchorId: slugifyAnchor(nextValue, blockType) };
}

export async function copyAnchorText(value = '') {
  try {
    await navigator.clipboard?.writeText(anchorClipboardText(value));
  } catch {
    // Clipboard can be blocked in some browser contexts.
  }
}