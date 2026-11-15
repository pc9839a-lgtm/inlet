import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(path, 'utf8');
const layout = read('src/editor/EditPanelLayout.jsx');
const layoutCss = read('src/editor/EditPanelLayout.css');
const rows = read('src/editor/editPanelParts/ScreenOrderListItems.jsx');
const rowCss = read('src/editor/editPanelParts/ScreenOrder.css');
const fixedCss = read('src/editor/editPanelParts/FixedBlocksSection.css');
const gallery = read('src/editor/editPanelParts/AddBlockPanel.jsx');
const dock = read('src/editor/editPanelParts/AddBlockDock.jsx');
const toggle = read('src/editor/editPanelParts/AddBlockDockToggle.jsx');
const dockCss = read('src/styles/editor-widget-add-dock.css');
const preview = read('src/screens/workspace/WorkspacePreviewPane.jsx');
const previewCss = read('src/screens/workspace/WorkspacePreviewPane.css');
const shell = read('src/styles/editor-workspace.css');
const reference = read('scripts/editor-reference-browser-check.mjs');

assert(layout.includes('data-editor-layout="three-pane"')
  && layout.includes('className="editor-composition-panel"')
  && layout.includes('className="editor-properties-panel"')
  && layout.includes('<h2>블록 편집 <span className="editor-composition-total">')
  && layout.includes('editor-page-options-heading'),
  'approved editor must show left block navigator, center canvas and right inspector');
assert(rows.includes('!listOnly && selectedId === block.id')
  && rows.includes('<ScreenOrderSettings')
  && rows.includes('renderBlockEditor={renderBlockEditor}')
  && layout.includes('<ScreenOrderList {...screenOrderListProps} inspectorNavigation={inspectorNavigation} />'),
  'the actual normal block editor must render in inspector mode without expanding list rows');
assert(layoutCss.includes('.editor-composition-content')
  && layoutCss.includes('.editor-properties-content')
  && layoutCss.includes('overflow-y: auto;')
  && layoutCss.includes('scrollbar-gutter: stable;'),
  'navigation and selected settings must scroll independently without nested scrollers');
assert(rowCss.includes('min-height: 55px !important;')
  && fixedCss.includes('min-height: 55px !important;'),
  'normal and pinned rows must use the same readable 55px geometry');
assert(toggle.includes('<strong>블록 추가</strong>')
  && toggle.includes('aria-expanded={open}')
  && dockCss.includes('background: #1759ee !important;')
  && dockCss.includes('height: 44px !important;')
  && layout.includes('<AddBlockDock {...addBlockDockProps} compact />'),
  'accessible block creation must be a full-width action in the navigator');
assert(dock.includes('role="dialog" aria-modal="true"')
  && dock.includes('createPortal(')
  && gallery.includes("['form', '문의 폼'"),
  'the original searchable, keyboard accessible block catalog must still work');
assert(preview.includes('selectedBlockId={selectedBlockId}')
  && preview.includes('onSelectBlock={onSelectPreviewBlock}')
  && preview.includes('role="toolbar"')
  && preview.includes('PREVIEW_WIDTHS = [360, 390, 430]')
  && preview.includes('setPreviewWidth(width)')
  && previewCss.includes('--editor-preview-frame-width')
  && shell.includes('grid-template-columns: var(--editor-list-width) minmax(0, 1fr) var(--editor-settings-width)'),
  'real page preview must support 360/390/430 width while retaining exact block selection');
assert(reference.includes("referenceWidth")
  && reference.includes("'editor-visual-hierarchy-' + referenceWidth")
  && reference.includes('longInspector')
  && reference.includes('widthOptions === 3'),
  'Chrome reference must cover desktop, narrow laptop and independent inspector');
console.log('Approved three-pane editor visual contracts passed');
