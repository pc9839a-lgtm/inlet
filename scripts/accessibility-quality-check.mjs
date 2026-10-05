import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const files = {
  indexHtml: await readFile('index.html', 'utf8'),
  mainEntry: await readFile('src/main.jsx', 'utf8'),
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
  settingsField: await readFile('src/panels/settings/SettingsField.jsx', 'utf8'),
  statsPanel: await readFile('src/panels/StatsPanel.jsx', 'utf8'),
  inboxPanel: await readFile('src/panels/InboxPanel.jsx', 'utf8'),
  inboxConnections: await readFile('src/panels/inbox/InboxConnectionsPanel.jsx', 'utf8'),
  duplicatePolicy: await readFile('src/panels/inbox/DuplicatePolicyPanel.jsx', 'utf8'),
  editorField: await readFile('src/editor/ui/EditorField.jsx', 'utf8'),
  toggleControl: await readFile('src/editor/ToggleControl.jsx', 'utf8'),
  choiceControl: await readFile('src/editor/ChoiceControl.jsx', 'utf8'),
  statsCss: await readFile('src/panels/StatsPanel.css', 'utf8'),
  inboxCss: await readFile('src/panels/InboxPanel.css', 'utf8'),
  settingsWorkspaceCss: await readFile('src/styles/settings-workspace.css', 'utf8'),
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
  packageJson: await readFile('package.json', 'utf8'),
  qaAll: await readFile('scripts/qa-all.mjs', 'utf8'),
  qaWorkflow: await readFile('.github/workflows/qa.yml', 'utf8'),
  editorBrowserQa: await readFile('scripts/editor-browser-regression-check.mjs', 'utf8'),
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

// P9-5 screen-reader semantics: one workspace h1, nested section/card headings,
// explicit form relationships, stateful controls, live feedback, and icon-only names.
assert(files.panelHeader.includes('<h1>{title}</h1>'), 'workspace PanelHeader must remain the primary h1');
assert(files.settingsBody.includes('<h2 id="settings-active-title">{selectedLabel}</h2>'), 'settings active section should nest under the workspace h1');
assert(files.statsPanel.includes('<h2>{activeLabel}</h2>'), 'stats active view should nest under the workspace h1');
assert(files.statsPanel.includes('<h3>최근 접수</h3>') && files.statsPanel.includes('stats-v4-card-title"><h3>'), 'stats cards should nest below the active stats h2');

assert(files.settingsField.includes('useId') && files.settingsField.includes('htmlFor={controlId}'), 'settings controls must have stable programmatic labels');
assert(files.settingsField.includes("'aria-describedby': describedBy") && files.settingsField.includes("'aria-errormessage': errorId"), 'settings help and errors must be bound to their controls');
assert(files.editorField.includes("'aria-errormessage': errorId") && files.editorField.includes('htmlFor={controlId}'), 'editor field errors must be bound to the actual control id');

for (const token of ['aria-label="접수 검색"', 'aria-label="접수 메모"', 'aria-label="복사할 접수 내용"', 'aria-label="접수 목록 새로고침"']) {
  assert(files.inboxPanel.includes(token), `inbox screen-reader label missing: ${token}`);
}
assert(files.inboxPanel.includes('aria-current={active ? \'page\' : undefined}') && files.inboxPanel.includes('aria-pressed={value === item}'), 'inbox selected navigation and status controls must expose state');
assert(files.duplicatePolicy.includes('role="switch"') && files.duplicatePolicy.includes('aria-checked={checked}'), 'duplicate policy switches must expose checked state');
assert(files.duplicatePolicy.includes('aria-label="차단 내역 조회 월"') && files.duplicatePolicy.includes('role="alert"') && files.duplicatePolicy.includes('role="status"'), 'duplicate history form and async feedback must be announced');

assert(files.inboxConnections.includes('aria-pressed={active}'), 'integration segmented choices must expose pressed state');
assert(files.inboxConnections.includes('role="switch"') && files.inboxConnections.includes('aria-checked={checked}') && files.inboxConnections.includes('aria-label={label}'), 'integration switches must expose switch semantics and names');
assert(files.inboxConnections.includes("role={resultIsOk(result) ? 'status' : 'alert'}") && files.inboxConnections.includes("aria-live={resultIsOk(result) ? 'polite' : 'assertive'}"), 'integration async results must expose live-region semantics');
assert(files.inboxConnections.includes('aria-expanded={open}') && files.inboxConnections.includes('aria-controls="inbox-connections-body"') && files.inboxConnections.includes('aria-expanded={advancedOpen}'), 'integration disclosures must expose expanded relationships');

assert(files.toggleControl.includes('role="switch"') && files.toggleControl.includes('aria-checked={checked}'), 'legacy editor toggles must expose switch state');
assert(files.choiceControl.includes('role="group" aria-label={label}') && files.choiceControl.includes('aria-pressed={String(value) === String(optionValue)}'), 'editor choice groups must expose labels and selected state');

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
assert(files.editorWorkspaceCss.includes('overflow: auto !important;'), 'zoomed desktop editor must remain scroll-reachable');
assert(files.editorWorkspaceCss.includes('.edit-mode-shell:not(.mobile-operations-shell)'), 'zoom reflow must not override true mobile operations mode');
assert(files.workspaceShellCss.includes('100dvh'), 'workspace shell should use dynamic viewport units');
assert(files.createModalCss.includes('@media (max-height:520px),(max-width:640px)'), 'create dialog should reflow for short mobile-keyboard viewports');
assert(files.workspaceTabs && files.editorSharedCss, 'workspace accessibility sources should load');
assert(files.formCss.includes('@media (max-height: 520px)'), 'HTML dialog should reflow for short mobile-keyboard viewports');
assert(files.workspaceChromeCss.includes('@media (max-width: 640px), (max-height: 600px)'), 'workspace chrome should reflow for zoomed or keyboard-short viewports');
assert(files.workspaceChromeCss.includes('scroll-padding-bottom: max(96px,') && files.workspaceChromeCss.includes('var(--pagero-keyboard-inset, 0px)'), 'short workspace viewports should preserve keyboard-aware bottom scroll room');
assert(files.workspaceChromeCss.includes('overflow-x: auto !important'), 'workspace tabs should remain reachable when zoomed');

// P9-6 mobile virtual-keyboard viewport contract.
assert(files.indexHtml.includes('interactive-widget=resizes-content'), 'viewport meta should request content resize when the virtual keyboard opens');
assert(files.mainEntry.includes('window.visualViewport') && files.mainEntry.includes('--pagero-visual-viewport-height') && files.mainEntry.includes('--pagero-keyboard-inset'), 'runtime must mirror the visual viewport and keyboard inset into CSS variables');
assert(files.mainEntry.includes("viewport?.addEventListener('resize', update") && files.mainEntry.includes("viewport?.addEventListener('scroll', update"), 'visual viewport contract must update on keyboard resize and offset changes');
assert(files.mainEntry.includes("active.scrollIntoView({ block: 'center', inline: 'nearest' })"), 'focused mobile controls must be scrolled back into the shrunken visual viewport');
assert(files.workspaceShellCss.includes('var(--pagero-visual-viewport-height, 100dvh)') && files.workspaceShellCss.includes('var(--pagero-keyboard-inset, 0px)'), 'mobile operations shell must use visible viewport height and keyboard-safe scroll room');
assert(files.workspaceChromeCss.includes('calc(var(--pagero-keyboard-inset, 0px) + 24px)'), 'workspace short viewport must reserve keyboard inset');
assert(files.createModalCss.includes('var(--pagero-visual-viewport-top,0px)') && files.createModalCss.includes('var(--pagero-visual-viewport-height,100dvh)'), 'create modal must stay inside the actual visual viewport');
assert(files.codeCss.includes('var(--pagero-visual-viewport-height,100dvh)') && files.formCss.includes('var(--pagero-visual-viewport-height,100dvh)'), 'editor modals must shrink to the visible keyboard viewport');
assert(files.homeShellCss.includes('@media (max-height:600px)') && files.homeShellCss.includes('var(--pagero-keyboard-inset,0px)'), 'auth/dashboard input surfaces must keep keyboard-short scroll room');

// P9-7 accessibility regression gate: CI must keep both the static contract and
// the real-browser P9 coverage wired into pull requests.
assert(files.packageJson.includes('"accessibility:qa": "node scripts/accessibility-quality-check.mjs"'), 'package accessibility:qa command must remain mapped to the accessibility gate');
assert(files.qaAll.includes("['accessibility:qa', ['scripts/accessibility-quality-check.mjs']]"), 'full offline QA must include accessibility:qa');
assert(files.qaWorkflow.includes('pull_request:'), 'QA workflow must run on pull requests');
assert(files.qaWorkflow.includes('accessibility-regression:'), 'QA workflow must expose a dedicated accessibility regression job');
assert(files.qaWorkflow.includes('run: npm run accessibility:qa'), 'dedicated accessibility CI job must execute accessibility:qa directly');
assert(files.qaWorkflow.includes('editor-browser-regression:') && files.qaWorkflow.includes('npm run browser:editor:qa'), 'CI must keep the authenticated editor browser regression job enabled');

const browserAccessibilityContracts = [
  ['P9-1 keyboard-only browser coverage', [
    "keyboardOnlyP91: ['Enter', 'Space', 'Tab', 'Shift+Tab', 'Escape']",
    'pointer-only drag handle must not create a dead Tab stop',
    'dropdown Escape close',
  ]],
  ['P9-2 focus management browser coverage', [
    "focusManagementP92: ['modal-trap', 'modal-return', 'workspace-transition-recovery']",
    'forward Tab from outside must be recovered into the modal',
    'focus recovery after inbox transition',
  ]],
  ['P9-3 200% zoom browser coverage', [
    "zoom200P93: ['desktop-builder-preserved', 'no-page-horizontal-scroll', 'add-dock-no-fixed-overlap', 'settings-single-column-reflow']",
    'zoom-200 settings body overflow',
    'add dock must not become a viewport-fixed overlap',
  ]],
  ['P9-6 mobile keyboard browser coverage', [
    "mobileKeyboardP96: ['360', '390', '430', 'focused-input-visible', 'modal-actions-visible', 'no-fixed-overlap']",
    'focused input is obscured',
    'keyboard-short code modal save action is clipped',
  ]],
];
for (const [label, tokens] of browserAccessibilityContracts) {
  for (const token of tokens) {
    assert(files.editorBrowserQa.includes(token), `${label} missing runtime assertion: ${token}`);
  }
}

assert(files.createModalCss.includes('prefers-reduced-motion:reduce'), 'modal motion should respect reduced-motion preference');
assert(files.editorSharedCss.includes('prefers-reduced-motion:reduce'), 'workspace motion should respect reduced-motion preference');
assert(files.homeShellCss.includes('prefers-reduced-motion:reduce'), 'dashboard motion should respect reduced-motion preference');

function relativeLuminance(hex) {
  const rgb = String(hex).replace('#', '').match(/.{2}/g).map((value) => Number.parseInt(value, 16) / 255);
  const linear = rgb.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

assert(files.productTokens.includes('--product-muted-2: #667085;'), 'secondary product text token should meet the strengthened contrast baseline');
assert(files.productTokens.includes('--product-placeholder: #667085;'), 'placeholder text must use the accessible secondary text token');
assert(files.productTokens.includes('--product-disabled-text: #475467;'), 'disabled controls must use explicit readable text instead of opacity');
assert(contrastRatio('#667085', '#ffffff') >= 4.5, 'placeholder/muted text must meet WCAG AA contrast on white');
assert(contrastRatio('#475467', '#f2f4f7') >= 4.5, 'disabled control text must meet WCAG AA contrast on disabled background');
assert(files.settingsWorkspaceCss.includes('::placeholder') && files.settingsWorkspaceCss.includes('opacity: 1;'), 'settings placeholders must not inherit translucent browser placeholder styling');
assert(files.settingsWorkspaceCss.includes('opacity: 1;') && files.settingsWorkspaceCss.includes('var(--product-disabled-text)'), 'settings disabled buttons must not communicate state through opacity alone');
assert(!files.inboxCss.includes('#94a3b8'), 'inbox helper text must not use the old low-contrast gray');
assert(files.statsPanel.includes("'↑ +'") && files.statsPanel.includes("'↓ '") && files.statsPanel.includes("'= '"), 'metric change direction must remain visible without relying on green/red color');
assert(files.settingsWorkspaceCss.includes(".settings-message::before { content: '✓ '") && files.settingsWorkspaceCss.includes(".settings-message.error::before { content: '! '"), 'success and error feedback must have a non-color visual cue');
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
  checks: dialogContracts.length + 113,
  keyboardOnly: true,
  focusTrap: true,
  focusReturn: true,
  zoom200Contract: true,
  mobileKeyboardViewport: 'visual-viewport-backed',
  reducedMotion: true,
  navigationSemantics: true,
  screenReaderSemanticsP95: true,
  contrastBaseline: 'wcag-aa-explicit-state-cues',
  accessibilityRegressionP97: ['dedicated-ci-job', 'qa-all-lock', 'editor-browser-lock', 'p9-1', 'p9-2', 'p9-3', 'p9-4-static', 'p9-5-static', 'p9-6'],
}, null, 2));
