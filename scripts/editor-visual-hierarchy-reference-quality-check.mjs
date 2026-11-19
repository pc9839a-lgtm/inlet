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

assert(layout.includes('data-editor-layout="separate-workbench"')
  && layout.includes('data-editor-experience="separate-settings"')
  && layout.includes('className="editor-composition-panel"')
  && layout.includes('className="editor-properties-panel"')
  && layout.includes('data-inspector-side="right"')
  && layout.includes('<h2 tabIndex={-1}>블록 편집 <span className="editor-composition-total">')
  && layout.includes('editor-page-options-heading'),
  'editor must keep the block navigator and settings on the left, with the live page to the right');
assert(layout.includes('listOnly')
  && layout.includes('inspectorOpen && !showStartEditing && !fixedSelected')
  && layout.includes('inspectorOpen && fixedSelected')
  && layout.includes('<ScreenOrderList {...screenOrderListProps} inspectorNavigation={inspectorNavigation} />')
  && !layout.includes('inlineEditing={inlineNormalEditing}')
  && !layout.includes('renderInlineEditor={renderFixedInlineEditor}')
  && rows.includes('selectedId === block.id'),
  'wide desktop must mount one selected real widget editor in its own settings scroller');
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
  && !preview.includes('PREVIEW_WIDTHS')
  && preview.includes("'--editor-preview-content-width': '390px'")
  && previewCss.includes('--editor-preview-frame-width')
  && shell.includes('grid-template-columns: var(--editor-list-width) minmax(0, 1fr) var(--editor-settings-width)'),
  'real page preview must be a single 390px result while retaining exact block selection');
assert(reference.includes("referenceWidth")
  && reference.includes("'editor-visual-hierarchy-' + referenceWidth")
  && reference.includes('longInspector')
  && reference.includes('widthOptions === 0'),
  'Chrome reference must cover desktop, narrow laptop and independent inspector');
console.log('Independent editor settings and single real preview contracts passed');
