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

// The list, canvas and property editor scroll independently; selecting a new
// block must not unmount the navigator or reparent the real widget editor.
assert.ok(shell.includes('grid-template-columns: var(--editor-list-width) minmax(0, 1fr) var(--editor-settings-width)')
  && shell.includes('--editor-list-width: 246px;')
  && shell.includes('--editor-settings-width: 340px;'),
  'desktop editor must preserve separate navigation, real page and settings widths');
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
assert.ok(items.includes('!listOnly && selectedId === block.id')
  && items.includes('<ScreenOrderSettings')
  && editor.includes('listOnly')
  && fixed.includes('props.renderInlineEditor?.(cardProps.block)'),
  'list mode never expands settings, while the real normal and fixed editors remain reusable');
assert.ok(editor.includes('<footer className="editor-composition-footer">')
  && layout.includes('.editor-composition-footer'),
  'page-wide design and settings must remain discoverable below the navigation');
assert.ok(previewFocus.includes("document.querySelector('.editor-properties-content')")
  && preview.includes('width: var(--editor-preview-frame-width, 394px) !important;'),
  'photo, form, CTA and media focus must target the stable settings area, not the list');
assert.ok(browser.includes('longInspector') && browser.includes('inspectorOverflow')
  && browser.includes('navigatorOverflow') && browser.includes('widthOptions === 3'),
  'Chrome regression must verify long-page independence and responsive preview width options');
console.log('Three-pane editor navigator and inspector independent scroll contract passed');
