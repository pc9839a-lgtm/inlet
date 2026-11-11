import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(path, 'utf8');
const renderer = read('src/preview/LandingRenderer.jsx');
const image = read('src/preview/renderers/MediaBlocks.jsx');
const screen = read('src/screens/WorkspaceEditorScreen.jsx');
const pane = read('src/screens/workspace/WorkspacePreviewPane.jsx');
const bottomCard = read('src/editor/blockEditors/BottomBarButtonCard.jsx');
const bottomLink = read('src/editor/blockEditors/BottomLinkCompact.jsx');
const modeTabs = read('src/editor/blockEditors/BottomLinkModeTabs.jsx');
const target = read('src/editor/targetControlModel.js');
const imageInput = read('src/editor/imageControls.jsx');
const browser = read('scripts/editor-browser-regression-check.mjs');

assert.ok(image.includes("editorPreview && selected && s.mode !== 'gallery'"),
  'direct photo action must appear only on a selected non-gallery edit preview image');
assert.ok(image.includes('onReplaceImage(block.id)'), 'photo action routes by exact block ID');
assert.ok(renderer.includes('selected={selectedBlockId===block.id}'), 'selection is scoped to the image block');
assert.ok(renderer.includes('onReplaceImage={onReplacePreviewImage}'), 'image action uses editor callback');
assert.ok(screen.includes(".querySelector('.image-input-upload-action:not([disabled])')"),
  'photo replace action must reuse the guarded existing file picker');
assert.ok(screen.includes('button.click()'), 'photo replacement requires a user-triggered current input');
assert.ok(imageInput.includes('onClick={openPicker}'), 'existing picker retains upload optimization safeguards');
assert.ok(imageInput.includes('onClick={() => setLibraryOpen(true)}'), 'media library remains accessible in Inspector');
assert.ok(renderer.includes('editorPreview ? ()=>onEditButton?.(block.id,b.editorIndex) : ()=>go(b.target,b.url,b.label)'),
  'editor CTA must never trigger live navigation or call handlers');
assert.ok(renderer.includes('editorIndex:index'), 'disabled CTA entries must not cause wrong button-index routing');
assert.ok(screen.includes('onSelectPreviewBlock?.(id)'), 'CTA selection must reuse existing selected block workflow');
assert.ok(screen.includes('data-bottom-button-label-index'), 'button-specific focus must not select the first button');
assert.ok(bottomCard.includes('data-bottom-button-label-index={index}'), 'each Inspector label must have stable position');
assert.ok(bottomCard.includes('index={index}'), 'target settings are associated with the same CTA');
assert.ok(bottomLink.includes('data-bottom-button-target-index={index}') && bottomLink.includes('<span>누르면</span>'),
  'CTA editor exposes a short actionable label and exact matching target');
assert.ok(modeTabs.includes('aria-pressed={mode === key}'), 'CTA target state remains accessible');
assert.ok(target.includes('invalidWidgetTarget'), 'invalid target must not fall back to first widget');
assert.ok(pane.includes('onReplacePreviewImage={onReplacePreviewImage}')
  && pane.includes('onEditPreviewBottomButton={onEditPreviewBottomButton}'),
  'editing callbacks must reach only the preview renderer');
const formRender = read('src/preview/renderers/FormBlocks.jsx');
const formCss = read('src/screens/workspace/WorkspacePreviewPane.css');
assert.ok(formRender.includes("editorPreview && selected && !done")
  && formRender.includes("className=\"editor-preview-submit-edit\"")
  && formRender.includes('onEditSubmit(block.id)'),
  'preview-only form button edit action must be visible only for selected form and cannot submit leads');
assert.ok(renderer.includes("onSelectBlock?.(id, { focusField: 'submit' })")
  && renderer.includes('onSelectBlock?.(id, { imageClick, galleryIndex, focusField })'),
  'form preview heading and button must route by exact block id');
assert.ok(screen.includes('focusPreviewFormField(id, interaction.focusField)')
  && screen.includes(".form-editor-flow > .field-title input")
  && screen.includes(".form-basic-grid .field-title input"),
  'direct edit targets existing title/submit fields without a duplicate save path');
assert.ok(formCss.includes('.form .editor-preview-submit-edit'),
  'in-canvas affordance styling must stay owned by the preview pane');
assert.ok(browser.includes('form submit-copy shortcut focuses exact existing field'),
  'Chrome must exercise the selected-preview CTA without form submission');
assert.ok(browser.includes('selected image displays replace action')
  && browser.includes('selected CTA opens exact button label setting')
  && browser.includes('CTA changes to URL target mode'),
  'real Chrome regression covers replacement and exact target editor');
console.log('Editor preview photo and bottom CTA action contracts passed');