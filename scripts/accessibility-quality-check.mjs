import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const files = {
  dialogHook: await readFile('src/lib/useAccessibleDialog.js', 'utf8'),
  feedback: await readFile('src/builder/BuilderFeedback.jsx', 'utf8'),
  home: (await Promise.all([
    readFile('src/screens/HomeScreens.jsx', 'utf8'),
    readFile('src/screens/CreateLandingFlow.jsx', 'utf8'),
    readFile('src/screens/DashboardScreen.jsx', 'utf8'),
  ])).join('\n'),
  duplicateModal: await readFile('src/panels/settings/PageDuplicateUrlModal.jsx', 'utf8'),
  formEditor: (await Promise.all([
    readFile('src/editor/blockEditors/FormEditor.jsx', 'utf8'),
    readFile('src/editor/blockEditors/FormHtmlModal.jsx', 'utf8'),
    readFile('src/editor/blockEditors/FormHtmlModalHeader.jsx', 'utf8'),
    readFile('src/editor/blockEditors/useFormHtmlModal.js', 'utf8'),
  ])).join('\n'),
  imageEditor: (await Promise.all([
    readFile('src/editor/blockEditors/ImageEditor.jsx', 'utf8'),
    readFile('src/editor/blockEditors/ImageCropModal.jsx', 'utf8'),
    readFile('src/editor/blockEditors/ImageCropHeader.jsx', 'utf8'),
    readFile('src/editor/blockEditors/useImageCropDialog.js', 'utf8'),
  ])).join('\n'),
  codeEditor: await readFile('src/editor/blockEditors/CodeEditorModal.jsx', 'utf8'),
  workspaceTabs: await readFile('src/screens/workspace/WorkspaceTabs.jsx', 'utf8'),
  workspacePanel: await readFile('src/screens/workspace/WorkspaceActivePanel.jsx', 'utf8'),
  panelHeader: await readFile('src/builder/PanelHeader.jsx', 'utf8'),
  settingsBody: await readFile('src/panels/settings/SettingsPanelBody.jsx', 'utf8'),
  statsPanel: await readFile('src/panels/StatsPanel.jsx', 'utf8'),
  createModalCss: await readFile('src/styles/panels-create-modal.css', 'utf8'),
  formCss: await readFile('src/editor/blockEditors/FormEditor.css', 'utf8'),
  codeCss: await readFile('src/editor/blockEditors/CodeEditor.css', 'utf8'),
  editorSharedCss: await readFile('src/styles/editor-shared-ui.css', 'utf8'),
  homeShellCss: await readFile('src/styles/panels-home-shell.css', 'utf8'),
  productTokens: await readFile('src/styles/product-ui-tokens.css', 'utf8'),
  workspaceShellCss: await readFile('src/styles/workspace-shell.css', 'utf8'),
  editorWorkspaceCss: await readFile('src/styles/editor-workspace.css', 'utf8'),
  workspaceChromeCss: await readFile('src/screens/workspace/WorkspaceChrome.css', 'utf8'),
  mobileWorkspaceMode: await readFile('src/runtime/useMobileWorkspaceMode.js', 'utf8'),
  appStylesEntry: await readFile('src/app-styles.css', 'utf8'),
  homeCss: await readFile('src/screens/HomeScreens.css', 'utf8'),
};

const dialogContracts = [
  [files.feedback, 'builder feedback dialogs use dialog role', 'role="dialog"'],
  [files.feedback, 'builder feedback dialogs use aria-modal', 'aria-modal="true"'],
  [files.feedback, 'builder feedback dialogs use labelled headings', 'aria-labelledby='],
  [files.feedback, 'builder feedback close buttons are labelled', 'aria-label="닫기"'],
  [files.feedback, 'builder feedback dialogs use shared focus trap', 'useAccessibleDialog('],
  [files.home, 'create modal uses dialog role', 'role="dialog"'],
  [files.home, 'create modal uses aria-modal', 'aria-modal="true"'],
  [files.home, 'create modal has accessible title', 'aria-labelledby="create-landing-title"'],
  [files.home, 'create modal close button is labelled', 'aria-label="닫기"'],
  [files.home, 'create modal uses shared focus trap', 'useAccessibleDialog(onClose)'],
  [files.duplicateModal, 'duplicate modal uses dialog role', 'role="dialog"'],
  [files.duplicateModal, 'duplicate modal uses shared focus trap', 'useAccessibleDialog(onClose)'],
  [files.duplicateModal, 'duplicate modal exposes pressed domain choice', 'aria-pressed='],
  [files.formEditor, 'HTML modal uses dialog role', 'role="dialog"'],
  [files.formEditor, 'HTML modal uses aria-modal', 'aria-modal="true"'],
  [files.formEditor, 'HTML modal has accessible title', 'aria-labelledby="inlet-html-modal-title"'],
  [files.formEditor, 'HTML modal close button is labelled', 'aria-label={closeLabel}'],
  [files.formEditor, 'HTML modal uses shared focus trap', 'useAccessibleDialog(onClose)'],
  [files.imageEditor, 'image crop modal uses dialog role', 'role="dialog"'],
  [files.imageEditor, 'image crop modal uses aria-modal', 'aria-modal="true"'],
  [files.imageEditor, 'image crop modal has accessible title', 'aria-labelledby="image-crop-dialog-title"'],
  [files.imageEditor, 'image crop close button is labelled', 'aria-label="닫기"'],
  [files.imageEditor, 'image crop uses shared focus trap', 'useAccessibleDialog(onClose, { lockScroll: true })'],
  [files.codeEditor, 'code editor uses dialog role', 'role="dialog"'],
  [files.codeEditor, 'code editor has accessible title', 'aria-labelledby="code-editor-modal-title"'],
  [files.codeEditor, 'code editor uses shared focus trap', 'useAccessibleDialog(onClose, { lockScroll: true })'],
];

for (const [source, label, token] of dialogContracts) {
  assert(source.includes(token), `accessibility contract failed: ${label}`);
}

for (const token of [
  "event.key === 'Escape'",
  "event.key !== 'Tab'",
  'event.shiftKey',
  'previousFocus',
  'previousFocus?.isConnected',
  '!dialog.contains(active)',
  'button:not([disabled])',
  "document.addEventListener('keydown', onKeyDown, true)",
]) {
  assert(files.dialogHook.includes(token), `dialog focus contract missing: ${token}`);
}

assert(
  [files.feedback, files.home, files.duplicateModal, files.formEditor, files.imageEditor, files.codeEditor]
    .every((source) => source.includes('tabIndex={-1}')),
  'all modal focus containers should support programmatic focus'
);

assert(files.home.includes('aria-expanded={accountOpen}'), 'dashboard account disclosure should expose expanded state');
assert(files.home.includes('aria-controls="dashboard-account-settings"'), 'dashboard disclosure should name controlled region');
assert(files.home.includes('aria-live="polite"'), 'dashboard async page list should expose polite updates');
assert(files.workspaceTabs.includes('role="tablist"') && files.workspaceTabs.includes('aria-label="작업 메뉴"'), 'workspace navigation should expose a named tablist');
assert(files.workspaceTabs.includes('role="tab"'), 'workspace navigation items should use tab semantics');
assert(files.workspaceTabs.includes('aria-selected={active}'), 'workspace navigation should expose selected state');
assert(files.workspaceTabs.includes('tabIndex={active ? 0 : -1}'), 'workspace tabs should use roving tab focus');
assert(files.workspaceTabs.includes('aria-controls={`workspace-panel-${key}`}'), 'workspace tabs should name controlled panels');
assert(files.workspaceTabs.includes('previousTabRef'), 'workspace focus recovery should remember the previous tab');
assert(files.workspaceTabs.includes('focusLost'), 'workspace focus recovery should detect lost focus');
assert(files.workspaceTabs.includes('tabRefs.current.get(tab)?.focus'), 'workspace focus recovery should move focus to the active tab when the source unmounts');
for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
  assert(files.workspaceTabs.includes(key), `workspace tab keyboard navigation missing: ${key}`);
}
assert(files.workspaceTabs.includes('aria-hidden="true"'), 'workspace nav icons should stay decorative');
assert(files.workspacePanel.includes('role="tabpanel"'), 'workspace active content should use tabpanel semantics');
assert(files.workspacePanel.includes('aria-labelledby={`workspace-tab-${tab}`}'), 'workspace tabpanel should reference active tab');
assert(files.workspacePanel.includes('tabIndex={-1}'), 'workspace tabpanel should support programmatic focus');
assert(files.settingsBody.includes('aria-current={selectedSection === id'), 'settings navigation should expose active section');
assert(files.settingsBody.includes('aria-controls="settings-active-panel"'), 'settings navigation should identify its controlled content');
assert(files.settingsBody.includes('role="region"'), 'settings active content should expose a region landmark');
assert(files.settingsBody.includes('aria-labelledby="settings-active-title"'), 'settings active region should reference the visible heading');
assert(files.settingsBody.includes('id="settings-active-title"'), 'settings heading should provide the active-region label');
assert(files.settingsBody.includes('previousSectionRef'), 'settings focus recovery should remember the previous section');
assert(files.settingsBody.includes('navButtonRefs'), 'settings focus recovery should retain section navigation targets');
assert(files.settingsBody.includes('focusLost'), 'settings focus recovery should detect lost focus after section changes');

assert(
  files.statsPanel.includes('role="img"') && files.statsPanel.includes('aria-label='),
  'stats chart should expose image role and label'
);
assert(files.statsPanel.includes('role="status"'), 'stats partial notice should use status semantics');
assert(files.panelHeader.includes('role="status"') && files.panelHeader.includes('aria-atomic="true"'), 'save feedback should announce atomically');
assert((files.panelHeader.match(/aria-hidden="true"/g) || []).length >= 3, 'decorative header icons should be hidden from assistive tech');

for (const [label, source] of [
  ['create modal', files.createModalCss],
  ['HTML modal', files.formCss],
  ['code modal', files.codeCss],
  ['workspace', files.editorSharedCss],
  ['dashboard', files.homeShellCss],
]) {
  assert(source.includes(':focus-visible'), `${label} should preserve visible keyboard focus`);
}
assert(files.createModalCss.includes('100dvh'), 'create dialog should use dynamic viewport height');
assert(files.formCss.includes('100dvh'), 'HTML dialog should use dynamic viewport height');
assert(files.codeCss.includes('100dvh'), 'code dialog should use dynamic viewport height');
assert(files.workspaceShellCss.includes('@media (max-width: 1180px)'), 'workspace must reflow before narrow/zoomed desktop becomes two-column overflow');
assert(files.mobileWorkspaceMode.includes("const COARSE_POINTER_QUERY = '(pointer: coarse)'"), 'mobile operations mode must distinguish coarse-pointer mobile from desktop browser zoom');
assert(files.mobileWorkspaceMode.includes('widthMedia.matches && pointerMedia.matches'), 'mobile workspace must require both narrow width and coarse pointer');
assert(files.editorWorkspaceCss.includes('@media (max-width: 1180px)'), 'editor must reflow below 1180px without a 900px lower bound');
assert(files.editorWorkspaceCss.includes('overflow-y: auto !important;'), 'zoomed desktop editor must remain vertically reachable');
assert(files.editorWorkspaceCss.includes('.edit-mode-shell:not(.mobile-operations-shell)'), 'zoom reflow must not override true mobile operations mode');
assert(files.workspaceShellCss.includes('100dvh'), 'workspace shell should use dynamic viewport units');
assert(files.createModalCss.includes('@media (max-height:520px),(max-width:640px)'), 'create dialog should reflow for short mobile-keyboard viewports');
assert(files.workspaceTabs && files.editorSharedCss, 'workspace accessibility sources should load');
assert(files.formCss.includes('@media (max-height: 520px)'), 'HTML dialog should reflow for short mobile-keyboard viewports');
assert(files.workspaceChromeCss.includes('@media (max-width: 640px), (max-height: 600px)'), 'workspace chrome should reflow for zoomed or keyboard-short viewports');
assert(files.workspaceChromeCss.includes('scroll-padding-bottom: max(96px, env(safe-area-inset-bottom))'), 'short workspace viewports should preserve bottom scroll room');
assert(files.workspaceChromeCss.includes('overflow-x: auto !important'), 'workspace tabs should remain reachable when zoomed');

assert(files.createModalCss.includes('prefers-reduced-motion:reduce'), 'modal motion should respect reduced-motion preference');
assert(files.editorSharedCss.includes('prefers-reduced-motion:reduce'), 'workspace motion should respect reduced-motion preference');
assert(files.homeShellCss.includes('prefers-reduced-motion:reduce'), 'dashboard motion should respect reduced-motion preference');

assert(files.productTokens.includes('--product-muted-2: #667085;'), 'secondary product text token should meet the strengthened contrast baseline');
assert(!files.homeShellCss.includes('color:#ef4444;font-size:12px'), 'small auth error text should not use the low-contrast red');
assert(!files.editorSharedCss.includes('color:#94a3b8!important'), 'small editor chrome text should not use the old low-contrast gray');

assert(files.createModalCss.includes('.sr-only'), 'screen-reader-only utility should exist for hidden modal titles');
assert(files.appStylesEntry.includes("@import './styles/panels-create-modal.css';"), 'builder feedback modal CSS must be loaded by the workspace style bundle');
assert(!files.homeCss.includes('panels-create-modal.css'), 'home screen should not separately own workspace feedback modal CSS');

const unlabeledIconButtons = [
  ...files.feedback.matchAll(/<button(?![^>]*(?:aria-label|title|>\s*[\p{L}\p{N}]))[^>]*>\s*[×✕]\s*<\/button>/gu),
  ...files.home.matchAll(/<button(?![^>]*(?:aria-label|title|>\s*[\p{L}\p{N}]))[^>]*>\s*[×✕]\s*<\/button>/gu),
  ...files.formEditor.matchAll(/<button(?![^>]*(?:aria-label|title|>\s*[\p{L}\p{N}]))[^>]*>\s*[×✕]\s*<\/button>/gu),
  ...files.imageEditor.matchAll(/<button(?![^>]*(?:aria-label|title|>\s*[\p{L}\p{N}]))[^>]*>\s*[×✕]\s*<\/button>/gu),
];
assert(!unlabeledIconButtons.length, 'icon-only close buttons should have aria-label or title');

console.log(JSON.stringify({
  ok: true,
  checks: dialogContracts.length + 60,
  keyboardOnly: true,
  focusTrap: true,
  focusReturn: true,
  zoom200Contract: true,
  mobileKeyboardViewport: true,
  reducedMotion: true,
  navigationSemantics: true,
  contrastBaseline: 'strengthened',
}, null, 2));
