import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(path, 'utf8');
const layout = read('src/editor/EditPanelLayout.jsx');
const layoutCss = read('src/editor/EditPanelLayout.css');
const toggle = read('src/editor/editPanelParts/AddBlockDockToggle.jsx');
const catalogCss = read('src/styles/editor-widget-add-dock.css');
const textCss = read('src/editor/blockEditors/TextEditor.css');
const rowsCss = read('src/editor/editPanelParts/ScreenOrder.css');
const reference = read('scripts/editor-reference-browser-check.mjs');
const baseline = read('src/screens/workspace/WorkspacePreviewPane.css');

assert(layout.includes('<h2>블록 구성</h2>') && layout.includes('editor-composition-total')
  && layout.includes('editor-page-options-heading'),
  'navigator and global design inspector must present distinct, readable tasks');
assert(layout.includes('<AddBlockDock {...addBlockDockProps} compact />')
  && layout.includes('<BlockNavigatorSearch blocks='),
  'the existing add catalog and selection search stay in the same visible navigator');
assert(toggle.includes('<strong>블록 추가</strong>')
  && !toggle.includes("compact ? 'editor-visually-hidden'"),
  'add affordance must be visible text, not only an icon or screen-reader label');
assert(toggle.includes('aria-expanded={open}') && toggle.includes('aria-label="블록 추가"'),
  'add catalog expansion state and accessible name must remain exposed');
assert(layoutCss.includes('min-height: 128px;')
  && layoutCss.includes('.editor-composition-title-row')
  && layoutCss.includes('background: #f7f9fc !important;'),
  'heading must separate composition identity, the primary add action and scrolling layers');
assert(catalogCss.includes('.editor-composition-heading .add-dock-compact .add-toggle')
  && catalogCss.includes('width: 100% !important;')
  && catalogCss.includes('background: #edf2ff !important;'),
  'reference action must occupy navigator width with a light, readable surface');
assert(catalogCss.includes('top: calc(100% - 2px) !important;')
  && catalogCss.includes('max-height: min(62dvh, 620px) !important;'),
  'existing add catalog should open beneath the taller heading without overflowing the viewport');
assert(layoutCss.includes('--editor-ui-row-size: 14px;')
  && rowsCss.includes('font-size: var(--editor-ui-row-size, 14px)'),
  'normal row names must use legible 14px typography without a new override stylesheet');
assert(read('src/editor/editPanelParts/FixedBlocksSection.css')
  .includes('font-size: var(--editor-ui-row-size, 12px)'),
  'fixed and normal block names must share the same readable type token');
assert(layoutCss.includes('margin: 0 0 26px;')
  && layoutCss.includes('.editor-inspector-section-label')
  && layoutCss.includes('.editor-inspector-selected-copy'),
  'Inspector must have a recognizable selected-block identity and its own visual rhythm');
assert(textCss.includes('.text-editor-design-controls .editor-theme-source')
  && textCss.includes('flex-wrap: wrap;')
  && textCss.includes('.text-editor-design-controls .editor-theme-align-notice'),
  'text controls retain accurate color/theme origin in compact responsive form');
assert(reference.includes("'editor-visual-hierarchy-' + referenceWidth")
  && reference.includes("visual.labelVisible")
  && reference.includes("visual.listNameSize === '14px'")
  && reference.includes("visual.stageHeading === '실시간 미리보기'"),
  'real Chrome must compare 1672px and 900px legibility, geometry and full-width add');
assert(baseline.includes('--landing-runtime-width: 390px'),
  'editing layout refinements must not change public mobile rendering width');
console.log('Reference editor visual hierarchy contracts passed');
