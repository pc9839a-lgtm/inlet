import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(path, 'utf8');
const layout = read('src/editor/EditPanelLayout.jsx');
const layoutCss = read('src/editor/EditPanelLayout.css');
const rows = read('src/editor/editPanelParts/ScreenOrderListItems.jsx');
const rowCss = read('src/editor/editPanelParts/ScreenOrder.css');
const fixedCss = read('src/editor/editPanelParts/FixedBlocksSection.css');
const fixed = read('src/editor/editPanelParts/GlobalFixedBlocks.jsx');
const gallery = read('src/editor/editPanelParts/AddBlockPanel.jsx');
const dock = read('src/editor/editPanelParts/AddBlockDock.jsx');
const toggle = read('src/editor/editPanelParts/AddBlockDockToggle.jsx');
const preview = read('src/screens/workspace/WorkspacePreviewPane.jsx');
const previewCss = read('src/screens/workspace/WorkspacePreviewPane.css');
const shell = read('src/styles/editor-workspace.css');
const reference = read('scripts/editor-reference-browser-check.mjs');

// The selected design replaces the old detached Inspector with a real stack.
assert(layout.includes('data-editor-layout="littly-block-stack"')
  && layout.includes('<h2>블록 편집</h2>')
  && layout.includes('editor-composition-total')
  && layout.includes('editor-page-options-heading')
  && !layout.includes('inspectorOnly'),
  'editor must render one block-stack workbench and no detached Inspector');
assert(rows.includes('selectedId === block.id')
  && rows.includes('<ScreenOrderSettings')
  && rows.includes('editor-inline-settings')
  && rows.includes('renderBlockEditor={renderBlockEditor}')
  && fixed.includes('props.renderInlineEditor?.(cardProps.block)'),
  'normal and pinned blocks must reveal real editors directly under their selected rows');
assert(layoutCss.includes('.editor-composition-content')
  && layoutCss.includes('overflow-y: auto !important;')
  && layoutCss.includes('overflow: visible !important;')
  && layoutCss.includes('.editor-inspector-panel.editor-inline-settings')
  && !layoutCss.includes('grid-template-columns: var(--editor-list-width) minmax(0, 1fr)'),
  'a single block-list scroller must replace independent nested panel scrolls');
assert(rowCss.includes('min-height: 61px !important;')
  && rowCss.includes('grid-template-columns: 20px minmax(0,1fr) 35px !important;')
  && fixedCss.includes('min-height: 61px !important;')
  && fixedCss.includes('grid-template-columns: 20px minmax(0, 1fr) 35px !important;'),
  'ordinary and fixed blocks must use consistent compact 61px rows');
assert(toggle.includes('<strong>블록 추가</strong>')
  && toggle.includes('aria-expanded={open}')
  && layoutCss.includes('background: #202b4d !important;')
  && layout.includes('<AddBlockDock {...addBlockDockProps} compact />'),
  'adding a block must be the most visible action and keep accessible state');
assert(dock.includes('role="dialog" aria-modal="true"')
  && dock.includes('createPortal(')
  && gallery.includes("['form', '문의 폼'"),
  'the same searchable, keyboard accessible block catalog must remain available');
assert(preview.includes('selectedBlockId={selectedBlockId}')
  && preview.includes('onSelectBlock={onSelectPreviewBlock}')
  && preview.includes('role="toolbar"')
  && preview.indexOf('className="editor-canvas-tools"') < preview.indexOf('className="phone-frame"')
  && !preview.includes('toolsTop'),
  'the real phone must have one contextual toolbar above rather than overlapping the page');
assert(previewCss.includes('--landing-runtime-width: 390px')
  && shell.includes('grid-template-columns: var(--editor-edit-width) minmax(0, 1fr)')
  && !shell.includes('editor-inspector-pane'),
  'the mobile page must remain exactly 390px with the edit stack at left');
assert(reference.includes("referenceWidth") && reference.includes("'editor-visual-hierarchy-' + referenceWidth"),
  'Chrome screenshots must still exercise reference desktop and narrow desktop views');
console.log('Block-stack editor visual contracts passed');
