import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const shell = read('src/styles/editor-workspace.css');
const layout = read('src/editor/EditPanelLayout.css');
const workflow = read('src/editor/EditorWorkflow.css');
const editor = read('src/editor/EditPanelLayout.jsx');
const items = read('src/editor/editPanelParts/ScreenOrderListItems.jsx');
const previewFocus = read('src/screens/WorkspaceEditorScreen.jsx');
const preview = read('src/screens/workspace/WorkspacePreviewPane.css');
const browser = read('scripts/editor-reference-browser-check.mjs');

// On desktop, list and settings are TWO tasks occupying the SAME left column.
// Their scroll positions stay separate while only one is visually exposed.
assert.ok(shell.includes('grid-template-columns: var(--editor-workspace-width) minmax(0, 1fr) !important;')
  && shell.includes('--editor-workspace-width: clamp(402px, 33vw, 468px);')
  && editor.includes('data-inspector-side="left"')
  && editor.includes('const [inspectorOpen, setInspectorOpen] = React.useState(false);')
  && editor.includes('data-inspector-open={inspectorOpen')
  && layout.includes("[data-inspector-open='true'] > .editor-composition-panel")
  && layout.includes("[data-inspector-open='false'] > .editor-properties-panel"),
  'beginner list and selected settings must replace each other inside one readable task column');
assert.ok(layout.includes('.editor-composition-content')
  && layout.includes('overflow-y: auto !important;')
  && layout.includes('overscroll-behavior: contain;')
  && layout.includes('.editor-properties-content')
  && layout.includes('overflow-y: auto;')
  && layout.includes('scrollbar-gutter: stable;'),
  'the visible task owns a native scrolling region, without nesting duplicate widgets');
assert.ok(editor.includes('className="editor-composition-content" role="region" aria-label="블록 순서" tabIndex={0}')
  && editor.includes('className="editor-properties-content" role="region" aria-label="선택 항목 편집" tabIndex={0}')
  && editor.includes('className="editor-properties-panel"')
  && editor.includes('className="editor-composition-panel"'),
  'both tasks must retain labeled keyboard-accessible regions');
assert.ok(editor.includes('listOnly')
  && editor.includes('inspectorOpen && fixedSelected')
  && editor.includes('inspectorOpen && !showStartEditing && !fixedSelected')
  && !editor.includes('inlineEditing={inlineNormalEditing}')
  && !editor.includes('renderInlineEditor={renderFixedInlineEditor}')
  && items.includes('className="screen-order-v2-list"'),
  'navigation remains list-only; one existing widget editor mounts for the selected block');
assert.ok(editor.includes('<footer className="editor-composition-footer">')
  && editor.includes('className="editor-page-more"')
  && workflow.includes('.editor-page-more-actions'),
  'global settings stay reachable without cluttering the initial list');
assert.ok(previewFocus.includes("document.querySelector('.canvas-editor-shell .edit-layout')")
  && layout.includes('.editor-properties-content')
  && preview.includes('width: var(--editor-preview-frame-width, 394px) !important;'),
  'photo, form, CTA and media must target the existing selected block editor');
assert.ok(browser.includes('verifyDesktop')
  && browser.includes('listShown !== open && m.inspectorShown === open')
  && browser.includes('contentWidth === 390')
  && browser.includes('initialPhoneX')
  && browser.includes('beginner-compact-page-673'),
  'Chrome regression must verify task replacement, fixed 390px preview and compact zoom fallback');

console.log('Beginner one-task editor, isolated scroll, keyboard and real-preview contract passed');
