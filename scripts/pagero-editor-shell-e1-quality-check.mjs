import { readFile } from 'node:fs/promises';
import { createInspectorBlockNavigation } from '../src/editor/editPanelParts/inspectorBlockNavigationModel.js';
import { themeAlignmentMode, isTextColorOverride, describeTextColorSource, describeBottomButtonColorSource, countTextColorSources } from '../src/editor/ui/themeInheritanceModel.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const sample = [
  { id: 'hero', type: 'hero' },
  { id: 'hidden-photo', type: 'image', visible: false },
  { id: 'form', type: 'form' },
];
const pinned = [
  { key: 'topnav', block: { id: 'topnav' } },
  { key: 'bottom', block: { id: 'bottom' } },
  { key: 'footer', block: { id: 'footer' } },
];
const sequence = createInspectorBlockNavigation({ normalBlocks: sample, fixedDescriptors: pinned, selectedBlockId: 'hidden-photo' });
assert(sequence?.index === 2 && sequence.total === 6 && sequence.previousId === 'hero' && sequence.nextId === 'form',
  'inspector navigation must preserve hidden blocks and pinned regions in actual mobile page order');
const boundary = createInspectorBlockNavigation({ normalBlocks: sample, fixedDescriptors: pinned, selectedBlockId: 'topnav' });
assert(boundary?.index === 0 && boundary.previousId === '' && boundary.nextId === 'hero',
  'top fixed area must disable previous navigation');
const last = createInspectorBlockNavigation({ normalBlocks: sample, fixedDescriptors: pinned, selectedBlockId: 'footer' });
assert(last?.index === 5 && last.nextId === '' && last.previousId === 'bottom',
  'footer must disable next navigation');
assert(createInspectorBlockNavigation({ normalBlocks: sample, fixedDescriptors: pinned, selectedBlockId: 'missing' }) === null,
  'invalid selection must never navigate to a random block');
assert(sample.length === 3 && sample[1].id === 'hidden-photo' && pinned[0].block.id === 'topnav',
  'inspector navigation must not mutate source page data');

// UX-020: exact renderer-aligned inheritance with no schema or page mutation.
const pageTheme = { text: '#123456', accent: '#ABCDEF', globalAlign: 'center' };
const sourceBlocks = [
  { type: 'text', s: { title: 'Inherited', textColor: '' } },
  { type: 'text', s: { title: 'Explicit', textColor: '#334455' } },
  { type: 'text', visible: false, s: { textColor: 'bad' } },
  { type: 'image', s: { textColor: '#FFFFFF' } },
];
const beforeThemeRead = JSON.stringify({ theme: pageTheme, blocks: sourceBlocks });
const counts = countTextColorSources(sourceBlocks);
assert(counts.total === 3 && counts.inherited === 2 && counts.custom === 1,
  'text style summary must count explicit saved HEX values (including hidden blocks) without counting unrelated types');
assert(!isTextColorOverride(sourceBlocks[0].s) && isTextColorOverride(sourceBlocks[1].s),
  'only valid explicit text color is a block override');
assert(describeTextColorSource(sourceBlocks[0].s, pageTheme).color === '#123456'
  && describeTextColorSource(sourceBlocks[0].s, pageTheme).inherited
  && describeTextColorSource(sourceBlocks[1].s, { ...pageTheme, text: '#AABBCC' }).color === '#334455'
  && describeTextColorSource({ ...sourceBlocks[1].s, textColor: '' }, pageTheme).inherited,
  'page color changes inherited text only, while explicit colors survive until the owner resets this one block');
assert(themeAlignmentMode({}) === 'block' && themeAlignmentMode({ globalAlign: '' }) === 'block'
  && themeAlignmentMode({ globalAlign: 'center' }) === 'center'
  && themeAlignmentMode({ globalAlign: 'invalid' }) === 'block',
  'page alignment must distinguish override from block-by-block mode');
const bottomMode = describeBottomButtonColorSource({ buttonColorMode: 'custom', color: 'dark', buttonColor: '#DDAA22' }, pageTheme);
assert(bottomMode.source === 'block' && bottomMode.color === '#DDAA22'
  && describeBottomButtonColorSource({ buttonColorMode: 'theme', color: 'dark' }, pageTheme).source === 'preset'
  && describeBottomButtonColorSource({ buttonColorMode: 'theme', color: 'light' }, pageTheme).color === '#FFFFFF'
  && describeBottomButtonColorSource({ buttonColorMode: 'theme', color: 'accent' }, pageTheme).source === 'page'
  && describeBottomButtonColorSource({ buttonColorMode: 'theme', color: 'accent' }, pageTheme).color === '#ABCDEF',
  'bottom CTA must distinguish dark/light presets from inherited accent and explicit custom HEX');
assert(JSON.stringify({ theme: pageTheme, blocks: sourceBlocks }) === beforeThemeRead,
  'inheritance inspection must not mutate existing page JSON or saved overrides');

const navigation = await readFile('src/builder/navigation.js', 'utf8');
const screen = await readFile('src/screens/WorkspaceEditorScreen.jsx', 'utf8');
const active = await readFile('src/screens/workspace/WorkspaceActivePanel.jsx', 'utf8');
const editPanel = await readFile('src/editor/EditPanel.jsx', 'utf8');
const layout = await readFile('src/editor/EditPanelLayout.jsx', 'utf8');
const screenOrderItem = await readFile('src/editor/editPanelParts/ScreenOrderItem.jsx', 'utf8');
const css = await readFile('src/styles/editor-workspace.css', 'utf8');
const editPanelLayoutCss = await readFile('src/editor/EditPanelLayout.css', 'utf8');
const stylePanelTypographyCss = await readFile('src/panels/StylePanel.css', 'utf8');
const blockEditorShellCss = await readFile('src/styles/editor-expanded-shell.css', 'utf8');
const textEditorTypographyCss = await readFile('src/editor/blockEditors/TextEditor.css', 'utf8');
const heroImageSection = await readFile('src/editor/blockEditors/HeroImageSection.jsx', 'utf8');
const heroGroupCss = await readFile('src/editor/blockEditors/HeroImageSection.css', 'utf8');
const imageGroupCss = await readFile('src/editor/blockEditors/ImageEditor.css', 'utf8');
const formGroupCss = await readFile('src/editor/blockEditors/FormEditor.css', 'utf8');
const legacyStylePanelCss = await readFile('src/styles/panels-style-v17.css', 'utf8');
const settingsView = await readFile('src/editor/editPanelParts/ScreenOrderSettings.jsx', 'utf8');
const inspectorSwitch = await readFile('src/editor/editPanelParts/InspectorBlockSwitch.jsx', 'utf8');
const settingsHeader = await readFile('src/editor/editPanelParts/ScreenOrderSettings.jsx', 'utf8');
const disclosure = await readFile('src/editor/ui/InspectorDisclosure.jsx', 'utf8');
const stylePanel = await readFile('src/panels/StylePanel.jsx', 'utf8');
const textAppearance = await readFile('src/editor/blockEditors/TextAppearanceControls.jsx', 'utf8');
const widgetPanels = await readFile('src/editor/blockEditors/WidgetStylePanels.jsx', 'utf8');
const themeStatusRow = await readFile('src/editor/ui/ThemeInheritanceRow.jsx', 'utf8');
const sharedControlsCss = await readFile('src/styles/editor-expanded-controls.css', 'utf8');
const editorNumberCss = await readFile('src/editor/ui/NumberControl.css', 'utf8');
const editorColorCss = await readFile('src/editor/ColorControl.css', 'utf8');
const editorColorSource = await readFile('src/editor/ColorControl.jsx', 'utf8');
const segmentedControl = await readFile('src/editor/ui/SegmentedControl.jsx', 'utf8');
const toggleRow = await readFile('src/editor/ui/ToggleRow.jsx', 'utf8');
const legacyToggle = await readFile('src/editor/ToggleControl.jsx', 'utf8');
const heroEditor = await readFile('src/editor/blockEditors/HeroEditor.jsx', 'utf8');
const textEditor = await readFile('src/editor/blockEditors/TextEditor.jsx', 'utf8');
const imageEditor = await readFile('src/editor/blockEditors/ImageEditor.jsx', 'utf8');
const formEditor = await readFile('src/editor/blockEditors/FormEditor.jsx', 'utf8');
const advanced = await readFile('src/editor/BlockAdvancedAnchorSettings.jsx', 'utf8');
const pageOptionsCss = await readFile('src/editor/editPanelParts/PageGlobalOptions.css', 'utf8');
const fixedBlocksCss = await readFile('src/editor/editPanelParts/FixedBlocksSection.css', 'utf8');
const rowIdentity = await readFile('src/editor/editPanelParts/ScreenOrderRowIdentity.jsx', 'utf8');
const rowCss = await readFile('src/editor/editPanelParts/ScreenOrder.css', 'utf8');
const fixedCard = await readFile('src/editor/editPanelParts/FixedBlockCard.jsx', 'utf8');
const workspaceCss = await readFile('src/styles/workspace-shell.css', 'utf8');
const chromeCss = await readFile('src/screens/workspace/WorkspaceChrome.css', 'utf8');
const leftPanel = await readFile('src/screens/workspace/WorkspaceLeftPanel.jsx', 'utf8');
const workspaceScreen = await readFile('src/screens/WorkspaceEditorScreen.jsx', 'utf8');
const operationsWorkspaceCss = await readFile('src/screens/workspace/OperationsWorkspace.css', 'utf8');
const addDockCss = await readFile('src/styles/editor-widget-add-dock.css', 'utf8');
const previewPaneCss = await readFile('src/screens/workspace/WorkspacePreviewPane.css', 'utf8');
const previewSelectionToolbar = await readFile('src/screens/workspace/PreviewSelectionToolbar.jsx', 'utf8');
const previewSelectionPane = await readFile('src/screens/workspace/WorkspacePreviewPane.jsx', 'utf8');

assert(!navigation.includes("['style', '스타일'"), 'editor navigation must not expose a duplicate style workspace tab');
assert(screen.includes("const effectiveTab = tab === 'style' ? 'edit' : tab;"), 'legacy style routes must still normalize into edit');
assert(active.includes('stylePanelProps={stylePanelProps}'), 'edit workspace must receive theme controls');
assert(editPanel.includes('stylePanelProps={stylePanelProps}'), 'EditPanel must forward theme controls');

assert(!layout.includes('CompositionDrawer') && layout.includes('editor-composition-panel') && layout.includes('페이지 설정') && layout.includes('inspectorOnly'), 'editor must show composition beside the selected-item inspector');
assert(!layout.includes("className={section === 'options' ? 'active' : ''}") && !layout.includes("className={section === 'order' ? 'active' : ''}"), 'edit section tabs must not reuse the global active class');
assert(!screenOrderItem.includes('renderBlockEditor') && !screenOrderItem.includes('data-inline-block-editor'), 'block list rows must no longer expand the selected settings inline');
assert(layout.includes('listOnly selectBlock={chooseBlock}') && !layout.includes('compositionOpen'), 'composition selection must not hide the persistent list');
assert(layout.includes('<AddBlockDock {...addBlockDockProps} compact />'), 'section add dock must remain in the left editor');
assert(layout.includes('<PageThemeStylePanel {...stylePanelProps} />'), 'page theme controls must remain available from page options');
assert(!layout.includes('editor-structure-pane') && !layout.includes('className="editor-inspector-pane"'), 'three-pane editor DOM must not return');

assert(css.includes('.canvas-editor-shell') && css.includes('@media (max-width: 899px)'), 'canvas shell must keep desktop and zoom geometry');
// UX-008/018/019/032: the existing owner styles consume one editor-only
// typography/rhythm scale, not a late stylesheet of !important overrides.
const typographyTokens = [
  '--editor-ui-title-size: 16px;',
  '--editor-ui-section-size: 13px;',
  '--editor-ui-label-size: 13px;',
  '--editor-ui-value-size: 14px;',
  '--editor-ui-row-size: 12px;',
  '--editor-ui-helper-size: 11px;',
  '--editor-ui-space-1: 4px;',
  '--editor-ui-space-2: 8px;',
  '--editor-ui-space-3: 12px;',
  '--editor-ui-space-4: 16px;',
];
assert(typographyTokens.every(token => editPanelLayoutCss.includes(token))
  && editPanelLayoutCss.includes('font-size: var(--editor-ui-title-size)')
  && editPanelLayoutCss.includes('font-size: var(--editor-ui-section-size)')
  && blockEditorShellCss.includes('gap: var(--editor-ui-space-4, 16px)')
  && !editPanelLayoutCss.includes('.block-editor-v2.block-editor')
  && rowCss.includes('font-size: var(--editor-ui-row-size, 12px)')
  && fixedBlocksCss.includes('font-size: var(--editor-ui-row-size, 12px)')
  && sharedControlsCss.includes('font-size: var(--editor-ui-label-size, 13px)')
  && sharedControlsCss.includes('font-weight: var(--editor-ui-label-weight, 600)')
  && sharedControlsCss.includes('gap: var(--editor-ui-space-3, 12px)')
  && stylePanelTypographyCss.includes('gap: var(--editor-ui-space-4, 16px)')
  && stylePanelTypographyCss.includes('font-size: var(--editor-ui-section-size, 13px)')
  && textEditorTypographyCss.includes('font-size: var(--editor-ui-label-size, 13px) !important')
  && textEditorTypographyCss.includes('font-weight: var(--editor-ui-label-weight, 600) !important')
  && textEditorTypographyCss.includes('gap: var(--editor-ui-space-3, 12px)')
  && !textEditorTypographyCss.includes('font-size: 14px !important; font-weight: 500 !important')
  && !legacyStylePanelCss.includes('.style-panel-v17{gap:14px!important}')
  && !stylePanel.includes('className="simple-panel style-panel')
  && !css.includes('--editor-ui-title-size')
  && !previewPaneCss.includes('--editor-ui-title-size'),
  'type sizes and 4/8 rhythm must stay in existing editor owners without leaking to public preview or creating stylesheet overrides');
// UX-032: control geometry and state affordances share editor-only tokens.
// Keep native textarea expansion, existing aria semantics and 44px switch hits.
const controlTokens = [
  '--editor-ui-input-height: 42px;',
  '--editor-ui-compact-height: 36px;',
  '--editor-ui-touch-height: 44px;',
  '--editor-ui-control-radius: 7px;',
  '--editor-ui-accent: #2454ff;',
  '--editor-ui-active-bg: #e9efff;',
];
assert(controlTokens.every(token => editPanelLayoutCss.includes(token))
  && sharedControlsCss.includes('min-height: var(--editor-ui-input-height, 42px)')
  && sharedControlsCss.includes('min-height: var(--editor-ui-compact-height, 36px)')
  && sharedControlsCss.includes('background: var(--editor-ui-active-bg, #e9efff)')
  && sharedControlsCss.includes("button[role=\"switch\"][aria-checked='true']")
  && sharedControlsCss.includes('background: var(--control-focus);')
  && sharedControlsCss.includes("button:disabled")
  && editorNumberCss.includes('min-height: var(--editor-ui-compact-height, 36px)')
  && editorNumberCss.includes("button[aria-pressed='true']")
  && editorNumberCss.includes('var(--editor-ui-control-radius, 7px)')
  && editorColorCss.includes('var(--editor-ui-control-line, #d0d5dd)')
  && editorColorCss.includes('var(--editor-ui-compact-height, 36px)')
  && editorColorCss.includes('var(--editor-ui-accent, #2454ff)')
  && textEditorTypographyCss.includes('var(--editor-ui-active-bg, #e9efff)')
  && stylePanelTypographyCss.includes('var(--editor-ui-compact-height, 36px)')
  && legacyStylePanelCss.includes('var(--editor-ui-compact-height, 36px)')
  && legacyStylePanelCss.includes('var(--editor-ui-active-bg, #e9efff)')
  && segmentedControl.includes('aria-pressed={String(value) === String(optionValue)}')
  && toggleRow.includes('role="switch"') && toggleRow.includes('aria-checked={checked}')
  && legacyToggle.includes('role="switch"') && legacyToggle.includes('aria-checked={checked}')
  && !css.includes('--editor-ui-input-height')
  && !previewPaneCss.includes('--editor-ui-input-height'),
  'editable field/segment/number/color/toggle state tokens must stay in existing owners and out of public canvas');
// UX-021: do not discard invalid HEX silently. Live feedback is scoped to
// the existing field component, and the last valid page color is preserved.
assert(editorColorSource.includes('export function normalizeEditorHex(value)')
  && editorColorSource.includes("replace(/^#/, '')")
  && editorColorSource.includes("raw.length === 3")
  && editorColorSource.includes("setError('HEX 색상은")
  && editorColorSource.includes('aria-invalid={Boolean(error)}')
  && editorColorSource.includes('aria-describedby={error ? errorId : undefined}')
  && editorColorSource.includes('role="alert"')
  && editorColorSource.includes('event.key === \'Escape\'')
  && editorColorSource.includes('onBlur={finish}')
  && editorColorSource.includes('if (normalized.toLowerCase() !== color.toLowerCase()) onChange(normalized)')
  && editorColorCss.includes(".color-clean input[type='text'][aria-invalid='true']")
  && editorColorCss.includes('.color-clean .color-hex-error')
  && !previewPaneCss.includes('.color-hex-error'),
  'HEX paste, inline invalid explanation and recovery must stay in shared editor color control');
// UX-024: four block editors use the same native expandable group rhythm
// without reintroducing per-editor dividers or extra nested scroll regions.
assert(heroImageSection.includes('InspectorDisclosure label="이미지 배치·효과"')
  && !heroImageSection.includes('<details className="hero-image-adjustments"')
  && heroGroupCss.includes('gap: var(--editor-ui-space-4, 16px)')
  && heroGroupCss.includes('gap: var(--editor-ui-space-3, 12px)')
  && !heroGroupCss.includes('.hero-image-adjustments, .hero-editor-design) > summary')
  && textEditorTypographyCss.includes('min-height: var(--editor-ui-touch-height, 44px)')
  && textEditorTypographyCss.includes('border-bottom: 0;')
  && imageGroupCss.includes('.image-editor-more-controls { display: grid; gap: var(--editor-ui-space-3, 12px)')
  && imageGroupCss.includes('min-height: var(--editor-ui-touch-height, 44px)')
  && formGroupCss.includes('.form-editor-flow { gap: var(--editor-ui-space-4, 16px); }')
  && formGroupCss.includes('.form-basic-detail > summary')
  && formGroupCss.includes('min-height: var(--editor-ui-touch-height, 44px)')
  && formGroupCss.includes('padding: var(--editor-ui-space-1, 4px) 0 var(--editor-ui-space-3, 12px)')
  && !previewPaneCss.includes('--editor-ui-space-4'),
  'disclosures must keep native semantics, owner-level token spacing and no canvas-style leakage');
assert(!css.includes('grid-template-columns: 280px minmax(520px, 1fr) 360px !important'), 'three-column production repair must stay removed');
assert(!css.includes('editor-inspector-pane'), 'editor workspace CSS must not restore the right inspector column');
assert(!css.includes('screen-order-v2-settings'), 'workspace geometry must not own inline block editor presentation');
assert(!css.includes('.fixed-block-card') && !css.includes('.edit-animation-card') && !css.includes('.fixed-block-editor') && !css.includes('.edit-animation-settings'), 'workspace geometry must not own fixed or animation cards');
assert(!css.includes('.block-editor-v2-header') && !css.includes('.editor-field-v2') && !css.includes('.editor-section-v2-trigger') && !css.includes('.editor-segmented-v2') && !css.includes('.image-mode-toolbar'), 'workspace geometry must not own block editor internals');
assert(editPanelLayoutCss.includes('editor-page-options-stack'), 'page options and theme controls need a left-panel stack owned by EditPanelLayout.css');
assert(fixedBlocksCss.includes('.screen-order-fixed-blocks .fixed-composition-row')
  && fixedBlocksCss.includes('grid-template-columns: 20px minmax(0, 1fr) 30px 30px !important')
  && fixedBlocksCss.includes('.fixed-composition-select')
  && !css.includes('.screen-order-fixed-blocks'),
  'fixed areas must use aligned compact rows under FixedBlocksSection.css ownership');
assert(rowIdentity.includes('function BlockTypeThumbnail({ Icon, src })')
  && rowIdentity.includes("onError={() => setImageState('error')}")
  && rowIdentity.includes("key={thumbnail || 'block-type'}")
  && rowIdentity.includes('screen-order-v2-hidden-badge')
  && rowIdentity.includes('title={summary}')
  && fixedCard.includes('screen-order-v2-hidden-badge')
  && rowCss.includes('/* Persistent editor layer navigator')
  && !rowCss.includes('Compact desktop keeps text readable before shrinking its action targets.')
  && fixedBlocksCss.includes('/* Pinned regions share the navigator row geometry')
  && !fixedBlocksCss.includes('One-line fixed labels match regular blocks in the 180px list.'),
  'persistent list must have a single row system, stable thumbnail fallback, visible hidden state and full-name tooltip');
assert(leftPanel.includes("import './WorkspaceChrome.css';") && chromeCss.includes('grid-template-columns: repeat(4, minmax(0, 1fr)) !important') && chromeCss.includes('min-height: 46px !important') && chromeCss.includes('height: 36px !important'), 'WorkspaceChrome.css must own compact four-column workspace navigation');
assert(chromeCss.includes('background: #f1f3f6 !important') && chromeCss.includes('color: var(--product-text) !important'), 'active workspace tab must use the compact light selected state from WorkspaceChrome.css');
assert(css.includes('--editor-list-width: clamp(220px, 18vw, 260px);') && css.includes('--editor-edit-width: clamp(490px, calc(100vw - 418px), 700px);') && css.includes('grid-template-columns: var(--editor-edit-width) minmax(0, 1fr) !important;') && css.includes('grid-column: 1;'), 'reference inspector requires a genuinely usable left editor up to 700px');
assert(!editPanelLayoutCss.includes('.editor-inspector-panel:has(.editor-selection-empty)') && layout.includes("const showPageOptions = section === 'options' || !selectedBlockId;") && layout.includes('{showPageOptions ? ('), 'unselected editor must keep inspector open with useful page settings');
assert(layout.includes('editor-composition-heading') && editPanelLayoutCss.includes('grid-template-columns: var(--editor-list-width) minmax(0, 1fr) !important;'), 'block list and inspector must share compact editor space');
assert(css.includes('overflow: hidden auto !important;') && editPanelLayoutCss.includes('overflow: visible !important;'), 'edit workspace must have one scrollbar and no nested scrolling panels');
assert(previewPaneCss.includes('width: 394px !important;') && previewPaneCss.includes('width: 392px !important;') && previewPaneCss.includes('--landing-runtime-width: 390px;') && previewPaneCss.includes('justify-content: center !important;'), 'single 390px phone must be centered in its right-side stage, not pushed to the browser edge');
assert(addDockCss.includes('/* Active editor dock geometry.')
  && addDockCss.includes('position: static !important;')
  && addDockCss.includes('max-height: none !important;')
  && addDockCss.includes('overflow-y: visible !important;')
  && !css.includes('.fixed-add-dock'), 'editor add catalog must expand inline without nested scrolling');
assert(css.includes('grid-template-columns: minmax(0, 1fr) !important;') && css.includes('overflow: auto !important;'), 'zoomed desktop must preserve reachable page and inspector');
assert(layout.includes('className="editor-page-settings-button"')
  && layout.includes('aria-controls="editor-selection-panel"')
  && !layout.includes('edit-section-tabs') && !editPanelLayoutCss.includes('edit-section-tabs'),
  'page settings must use one composition entry without a second inspector tab bar');
assert(settingsView.includes('<InspectorBlockSwitch navigation={navigation} />')
  && inspectorSwitch.includes('aria-label="이전 블록"')
  && inspectorSwitch.includes('aria-label="다음 블록"')
  && editPanelLayoutCss.includes('.editor-inspector-panel .screen-order-v2-card')
  && editPanelLayoutCss.includes('.editor-block-switch'),
  'inspector must keep non-destructive previous/next controls available with the shared scrollbar');
assert(stylePanel.includes("globalAlign: next === 'block' ? '' : next")
  && stylePanel.includes("[ 'block', '블록별' ]")
  && stylePanel.includes('countTextColorSources(page?.blocks)')
  && textAppearance.includes("set({ textColor: '' })")
  && textAppearance.includes('<ThemeInheritanceRow')
  && widgetPanels.includes("buttonColorMode: 'theme', color: 'accent'")
  && themeStatusRow.includes("data-style-source={source}")
  && sharedControlsCss.includes('.editor-theme-source')
  && !layout.includes('data-page-theme-inheritance-override'),
  'page and block theme UI must use existing schema fields, explicit text reset and accurate bottom preset vs accent status');
assert(disclosure.includes('<details') && disclosure.includes('<summary>') && disclosure.includes('inspector-disclosure-body')
  && settingsHeader.includes('inspector-primary-heading')
  && !settingsHeader.includes('InspectorNavigation')
  && !editPanelLayoutCss.includes('.inspector-navigation')
  && [heroEditor, textEditor, imageEditor, formEditor, advanced].every(source => source.includes('<InspectorDisclosure'))
  && formEditor.includes('inspector-subgroup-heading')
  && editPanelLayoutCss.includes('.screen-order-v2-settings .inspector-disclosure'),
  'inspector must use one shared content/behavior/design/advanced native disclosure hierarchy without duplicate shortcuts');
assert(editPanelLayoutCss.includes('.editor-composition-heading > .editor-page-settings-button')
  && editPanelLayoutCss.includes('min-height: 40px;')
  && layout.includes("<BlockNavigatorSearch blocks={screenOrderListProps.normalBlocks} selectedId={fixedSelected ? '' : screenOrderListProps.selectedId} onSelect={chooseBlock} />"),
  'page settings and non-destructive block search must remain reachable in the composition header');
assert(!css.includes('edit-section-tabs') && !css.includes('editor-page-options-stack'), 'workspace geometry must not own EditPanelLayout subsection UI');
assert(previewPaneCss.includes('border: 2px solid #cbd5e1')
  && previewPaneCss.includes('border-radius: 20px')
  && previewPaneCss.includes('box-shadow: 0 5px 18px #17203912')
  && previewPaneCss.includes('background: #f8f9fc')
  && previewPaneCss.includes('.preview-width-toolbar')
  && previewPaneCss.includes('background: transparent; color: #667085; font-size: 12px')
  && !previewPaneCss.includes('border: 6px solid #242934')
  && !previewPaneCss.includes('border-radius: 46px'),
  'preview must retain 390px content with a slim shell and neutral non-promotional toolbar');
assert(previewPaneCss.includes('WorkspacePreviewPane — owns editor preview presentation') && previewPaneCss.includes('.preview-workspace') && previewPaneCss.includes('.preview-sticky') && previewPaneCss.includes('.phone-frame') && previewPaneCss.includes('scroll-margin-block: 120px') && !css.includes('.preview-workspace') && !css.includes('.preview-sticky') && !css.includes('.phone-frame'), 'WorkspacePreviewPane.css must own preview presentation while editor-workspace.css stays geometry-only');
assert(pageOptionsCss.includes('body .builder-shell .page-global-options-card') && pageOptionsCss.includes('padding: 0;') && pageOptionsCss.includes('border-radius: 0;') && pageOptionsCss.includes('background: transparent;') && !css.includes('page-global-options'), 'page options base contract must live in PageGlobalOptions.css and stay out of editor-workspace.css');
assert(!workspaceCss.includes('body .builder-shell .panel-header {') && !workspaceCss.includes('body .builder-shell .top-tabs {'), 'workspace shell must not own PanelHeader or top-tabs presentation');
assert(workspaceScreen.includes("import './workspace/OperationsWorkspace.css';") && operationsWorkspaceCss.includes('.inbox-workspace-shell') && operationsWorkspaceCss.includes('.stats-dashboard-shell') && operationsWorkspaceCss.includes('.settings-workspace-shell') && !workspaceCss.includes('.inbox-workspace-shell'), 'desktop operations geometry must be isolated from the common workspace shell');

assert(previewSelectionToolbar.includes('createScreenOrderMovement')
  && previewSelectionToolbar.includes('canDuplicateScreenOrderBlock')
  && previewSelectionToolbar.includes('data-preview-hidden={hidden')
  && previewSelectionToolbar.includes("aria-label={hidden ? '블록 표시' : '블록 숨기기'}")
  && previewSelectionToolbar.includes('preview-selection-actions')
  && !previewSelectionToolbar.includes('getBoundingClientRect')
  && !previewSelectionToolbar.includes('frameRef')
  && !previewSelectionToolbar.includes('ResizeObserver')
  && previewSelectionPane.indexOf('<PreviewSelectionToolbar') < previewSelectionPane.indexOf('<div className="phone-frame"')
  && previewPaneCss.includes('.preview-selection-toolbar {\n  position: relative;')
  && !previewPaneCss.includes('.preview-selection-toolbar { position: absolute')
  && previewPaneCss.includes('.preview-selection-actions > button:focus-visible')
  && previewPaneCss.includes('.preview-selected-block { outline: 2px solid #2454ff')
  && previewPaneCss.includes('.landing-section:hover:not(.preview-selected-block)'),
  'preview selection actions must occupy a safe outside-phone stage row with hidden CTA recovery and distinct hover/selection/focus');
console.log(JSON.stringify({
  ok: true,
  checks: 23,
  scope: 'pagero-editor-canvas-and-inspector',
  shell: ['left-composition-and-settings', 'right-page-preview'],
  separateStyleTab: false,
  legacyStyleRouteNormalized: true,
}, null, 2));
