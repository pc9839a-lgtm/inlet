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
  && layout.includes('data-inspector-side="left"')
  && layout.includes('<h2 tabIndex={-1}>블록</h2>')
  && layout.includes('const returnToBlocks = (event) =>')
  && layout.includes('editor-page-options-heading'),
  'editor must show one readable task on the left and the real page on the right');
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
  && dockCss.includes('height: 52px !important;')
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
  && shell.includes('grid-template-columns: var(--editor-workspace-width) minmax(0, 1fr) !important;'),
  'real page preview must be a single 390px result beside the task editor');
assert(reference.includes('verifyDesktop')
  && reference.includes('beginner-block-list-1672')
  && reference.includes('beginner-edit-')
  && reference.includes('beginner-compact-page-673')
  && reference.includes('initialPhoneX'),
  'Chrome reference must compare list/edit tasks across desktop, laptop and zoom while preserving phone position');
console.log('Independent editor settings and single real preview contracts passed');
