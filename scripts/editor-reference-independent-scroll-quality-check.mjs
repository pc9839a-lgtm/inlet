import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const shell = read('src/styles/editor-workspace.css');
const layout = read('src/editor/EditPanelLayout.css');
const editor = read('src/editor/EditPanelLayout.jsx');
const items = read('src/editor/editPanelParts/ScreenOrderListItems.jsx');
const fixed = read('src/editor/editPanelParts/GlobalFixedBlocks.jsx');
const previewFocus = read('src/screens/WorkspaceEditorScreen.jsx');
const preview = read('src/screens/workspace/WorkspacePreviewPane.css');
const browser = read('scripts/editor-reference-browser-check.mjs');

// Every desktop size has a navigation-only scroller and a separate settings
// scroller. Selecting a block never inserts inputs beneath its list row.
assert.ok(shell.includes('grid-template-columns:var(--editor-list-width) var(--editor-settings-width) minmax(0,1fr)')
  && shell.includes('--editor-list-width:276px;')
  && shell.includes('--editor-settings-width:394px;')
   && shell.includes('--editor-preview-grid-column:3;')
   && editor.includes('data-inspector-side="left"')
  && shell.includes("data-editor-density='wide']")
  && editor.includes('const [inspectorOpen, setInspectorOpen] = React.useState(false);')
  && editor.includes('data-inspector-open={inspectorOpen'),
  'the persistent navigator must share the first screen with the full page, and settings open on demand');
assert.ok(layout.includes('.editor-composition-content')
  && layout.includes('overflow-y: auto !important;')
  && layout.includes('overscroll-behavior: contain;')
  && layout.includes('.editor-properties-content')
  && layout.includes('overflow-y: auto;')
  && layout.includes('scrollbar-gutter: stable;'),
  'both navigator and selected block settings must keep independent native scrollers');
assert.ok(editor.includes('className="editor-composition-content" role="region" aria-label="블록 순서" tabIndex={0}')
  && editor.includes('className="editor-properties-content" role="region" aria-label="선택 항목 편집" tabIndex={0}')
  && editor.includes('className="editor-properties-panel"')
  && editor.includes('className="editor-composition-panel"'),
  'both independent panel regions must be labeled and keyboard reachable');
assert.ok(editor.includes('listOnly')
  && editor.includes('inspectorOpen && fixedSelected')
  && editor.includes('inspectorOpen && !showStartEditing && !fixedSelected')
  && !editor.includes('inlineEditing={inlineNormalEditing}')
  && !editor.includes('renderInlineEditor={renderFixedInlineEditor}')
  && items.includes('className="screen-order-v2-list"'),
  'the navigator must stay list-only while fixed and normal settings mount in one separate inspector');
assert.ok(editor.includes('<footer className="editor-composition-footer">')
  && layout.includes('.editor-composition-footer'),
  'page-wide design and settings must remain discoverable below the navigation');
assert.ok(previewFocus.includes("document.querySelector('.canvas-editor-shell .edit-layout')")
  && layout.includes('.editor-properties-content')
  && preview.includes('width: var(--editor-preview-frame-width, 394px) !important;'),
  'photo, form, CTA and media focus must resolve the active block editor in the stable layout');
assert.ok(browser.includes('longInspector') && browser.includes('inspectorOverflow')
  && browser.includes('navigatorOverflow') && browser.includes('widthOptions === 0'),
  'Chrome regression must verify long-page independence and one fixed 390px preview');
console.log('Separate block navigator and selected settings scrollers contract passed');
