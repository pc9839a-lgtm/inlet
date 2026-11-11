import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const shell = read('src/styles/editor-workspace.css');
const layout = read('src/editor/EditPanelLayout.css');
const editor = read('src/editor/EditPanelLayout.jsx');
const previewSelection = read('src/runtime/useWorkspaceShellActions.js');
const browser = read('scripts/editor-browser-regression-check.mjs');
const preview = read('src/screens/workspace/WorkspacePreviewPane.css');

assert.ok(shell.includes('clamp(220px, 15.6vw, 264px)'), 'page-first navigator stays compact at the reference width');
assert.ok(shell.includes('calc(var(--editor-list-width) + 376px)') && shell.includes('640px'),
  'selected-content Inspector must remain usable beside the enlarged canvas');
assert.ok(shell.includes('calc(100vw - 410px)') && shell.includes('clamp(500px,'),
  '900px editor must reserve a 400px preview stage');
assert.ok(shell.includes('overflow: hidden !important;'),
  'shared work panel cannot be an additional vertical scroller');
assert.ok(layout.includes('grid-template-rows: minmax(0, 1fr)'),
  'editor must give both scroll regions a bounded viewport');
assert.ok(layout.includes('.editor-composition-content {\n  flex: 1 1 auto;\n  min-height: 0;\n  overflow-y: auto !important;'),
  'only composition rows scroll, preserving fixed list actions');
assert.ok(layout.includes('.editor-inspector-panel {\n  overflow-y: auto !important;'),
  'Inspector gets its own native vertical scroll');
assert.ok(layout.includes('.editor-composition-footer') && layout.includes('border-top: 1px solid #e4e9f2;'),
  'page settings must be pinned below block rows');
assert.ok(editor.includes('className="editor-composition-content" role="region" aria-label="블록 목록" tabIndex={0}'),
  'navigator scroll is keyboard-reachable');
assert.ok(editor.includes('<div className="editor-composition-footer">'),
  'page settings are outside long scrolling block rows');
assert.ok(editor.includes("document.querySelector('.canvas-editor-shell .editor-composition-content')"),
  'previous/next block selection scrolls only the navigator, not shared work panel');
assert.ok(editor.includes("inspector.scrollTop = 0"),
  'newly selected Inspector resets to the top of its settings without changing list scroll');
assert.ok(previewSelection.includes("document.querySelector('.canvas-editor-shell .editor-composition-content')"),
  'preview selection reaches matching navigator row');
assert.ok(preview.includes('--landing-runtime-width: 390px'),
  'public and editor phone keep the same 390px content contract');
assert.ok(browser.includes('long-page navigator and Inspector must remain isolated')
  && browser.includes('900px long-page keeps two independently reachable editing regions'),
  'real Chrome must exercise both scrollers on the 36-block page');
assert.ok(browser.includes('const expectedComposition = Math.min(264, Math.max(220, width * 0.156));'),
  'Chrome checks actual page-first navigator geometry at desktop widths');
assert.ok(browser.includes("inspectorScroll.footerPinned && inspectorScroll.innerOverflowY === 'visible'"),
  'Chrome checks pinned page settings and no third nested settings scrollbar');
console.log('Editor reference panel geometry and independent scrolling quality check passed');
