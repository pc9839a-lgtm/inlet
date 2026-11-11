import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const shell = read('src/styles/editor-workspace.css');
const layout = read('src/editor/EditPanelLayout.css');
const editor = read('src/editor/EditPanelLayout.jsx');
const items = read('src/editor/editPanelParts/ScreenOrderListItems.jsx');
const fixed = read('src/editor/editPanelParts/GlobalFixedBlocks.jsx');
const previewSelection = read('src/runtime/useWorkspaceShellActions.js');
const previewFocus = read('src/screens/WorkspaceEditorScreen.jsx');
const browser = read('scripts/editor-browser-regression-check.mjs');
const preview = read('src/screens/workspace/WorkspacePreviewPane.css');

assert.ok(shell.includes('--editor-edit-width: clamp(500px, 42vw, 660px);')
  && shell.includes('grid-template-columns: var(--editor-edit-width) minmax(0, 1fr)'),
  'the editing stack must have readable width while preserving the mobile preview');
assert.ok(shell.includes('@media (max-width: 899px)')
  && shell.includes('grid-template-columns: minmax(0, 1fr) !important;'),
  'zoomed desktop must preserve both the editor and phone without horizontal clipping');
assert.ok(shell.includes('overflow: hidden !important;'),
  'the shared work panel must never act as a second scrolling form');
assert.ok(layout.includes('.editor-composition-content')
  && layout.includes('overflow-y: auto !important;')
  && layout.includes('overscroll-behavior: contain;'),
  'the block stack must own one native vertical scroller');
assert.ok(layout.includes('.editor-inspector-panel.editor-inline-settings')
  && layout.includes('overflow: visible !important;')
  && !layout.includes('.editor-inspector-panel {\n  overflow-y: auto !important;'),
  'expanded settings must scroll with their block rather than create nested inspector scrollbars');
assert.ok(layout.includes('.editor-composition-footer')
  && editor.includes('<footer className="editor-composition-footer">'),
  'page settings must stay pinned below the long block list');
assert.ok(editor.includes('className="editor-composition-content" role="region" aria-label="블록 목록과 편집" tabIndex={0}'),
  'the block list and its expanded editor must be keyboard reachable as one region');
assert.ok(items.includes('selectedId === block.id') && items.includes('<ScreenOrderSettings')
  && fixed.includes('props.renderInlineEditor?.(cardProps.block)'),
  'the selected normal or fixed block must open the real editor beside its own list item');
assert.ok(editor.includes("document.querySelector('.canvas-editor-shell .editor-composition-content')"),
  'previous/next block selection must use the same list scroller');
assert.ok(previewSelection.includes("document.querySelector('.canvas-editor-shell .editor-composition-content')"),
  'preview selection must reveal the matching row in the stack');
assert.ok(previewFocus.includes("document.querySelector('.editor-composition-content')"),
  'photo/form/link/CTA focus watchers must observe a stable stack parent across lazy selections');
assert.ok(preview.includes('--landing-runtime-width: 390px'),
  'real editor and public page must keep the same 390px landing content width');
assert.ok(browser.includes('long-page navigator and Inspector must remain isolated'),
  'real Chrome still needs the 36-block long-page stress scenario (with updated geometry checks)');
console.log('Littly-style editor block stack geometry and focus contract passed');
