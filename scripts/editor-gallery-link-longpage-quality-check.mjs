import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { updateGalleryImage } from '../src/editor/blockEditors/imageEditorModel.js';

const original = ['first.png', '', 'third.png'];
const changed = updateGalleryImage(original, 2, 'updated.png');
assert.deepEqual(changed, ['first.png', '', 'updated.png'], 'blank gallery slots must not shift the replacement target');
assert.deepEqual(original, ['first.png', '', 'third.png'], 'source gallery remains untouched');
assert.deepEqual(updateGalleryImage(original, 0, 'new.png'), ['new.png', '', 'third.png']);

const read = (path) => readFileSync(path, 'utf8');
const gallery = read('src/preview/renderers/MediaBlocks.jsx');
const galleryEditor = read('src/editor/blockEditors/ImageGalleryEditor.jsx');
const links = read('src/preview/renderers/LinkBlocks.jsx');
const linksEditor = read('src/editor/blockEditors/LinksEditor.jsx');
const linkFields = read('src/editor/blockEditors/LinkItemFields.jsx');
const screen = read('src/screens/WorkspaceEditorScreen.jsx');
const pane = read('src/screens/workspace/WorkspacePreviewPane.jsx');
const renderer = read('src/preview/LandingRenderer.jsx');
const browser = read('scripts/editor-browser-regression-check.mjs');

assert.ok(gallery.includes('.map((src, index) => ({ src, index })).filter'), 'gallery preview must retain raw image index before filtering blanks');
assert.ok(gallery.includes('data-preview-gallery-index={editorPreview ? galleryItem.index : undefined}'),
  'grid image must carry original slot ID in editor only');
assert.ok(gallery.includes('data-preview-gallery-index={editorPreview && s.mode === \'gallery\' ? galleryItems[idx]?.index : undefined}'),
  'slide image must carry original slot ID in editor only');
assert.ok(gallery.includes('onReplaceImage(block.id, galleryItem.index)'),
  'grid replace must pass raw gallery slot');
assert.ok(gallery.includes('onReplaceImage(block.id, galleryItems[idx].index)'),
  'slide replace must pass raw gallery slot');
assert.ok(galleryEditor.includes('data-editor-gallery-item-index={item.index}'),
  'gallery Inspector uploader must have exact raw slot identity');
assert.ok(screen.includes('block.s?.gallery?.[galleryIndex]'),
  'unavailable or empty gallery slot must fail closed');
assert.ok(screen.includes('data-editor-gallery-item-index'),
  'preview must invoke matching existing ImageInput, not append to gallery');

assert.ok(links.includes('if (editorPreview) { onEditItem?.(blockId, itemIndex); return; }'),
  'editor link click must stop before real navigation and analytics');
assert.ok(links.includes('data-preview-link-index={editorPreview ? itemIndex : undefined}'),
  'preview-only link identity must not affect public output');
assert.ok(linksEditor.includes('<LinkItemFields item={item} index={index}'),
  'Inspector must pass the true source index');
assert.ok(linkFields.includes('data-link-item-label-index={index}'),
  'Inspector link input must preserve item identity');
assert.ok(screen.includes('const editPreviewLinkItem = (id, index)'),
  'link preview must only focus a validated source item');
assert.ok(screen.includes("button.textContent.trim() === '링크 목록'"),
  'existing link items tab must be used without duplicate editor');
assert.ok(renderer.includes('onEditItem={onEditPreviewLinkItem}'),
  'actual link rendering must receive only editor-preview callback');
assert.ok(pane.includes('onEditPreviewLinkItem={onEditPreviewLinkItem}'),
  'workspace must forward link editing callback into preview renderer');
assert.ok(browser.includes("editor-vnext-36-blocks-1672") && browser.includes("editor-vnext-36-blocks-900"),
  'Chrome must inspect long mixed pages at both target viewports');
assert.ok(browser.includes('third raw gallery slot focuses correct uploader despite blank second slot'),
  'Chrome must verify blank-slot image identity');
assert.ok(browser.includes('second link preview focuses its own Inspector input'),
  'Chrome must verify item-specific link editing');
console.log('Editor gallery/link preview and long-page contracts passed');
