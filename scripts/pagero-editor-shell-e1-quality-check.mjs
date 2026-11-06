import { readFile } from 'node:fs/promises';
import { createInspectorBlockNavigation } from '../src/editor/editPanelParts/inspectorBlockNavigationModel.js';
import { createScreenOrderIdentities } from '../src/editor/editPanelParts/screenOrderIdentityModel.js';
import { findBlockNavigationMatches } from '../src/editor/editPanelParts/blockNavigatorSearchModel.js';
import { validDraftPreviewToken, draftPreviewTabUrl, draftPreviewChannelName } from '../src/runtime/draftPreviewTabTransport.js';
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

// UX-010: repeat code blocks are distinguishable by visible content, while
// JavaScript, CSS and hidden markup never appear in list text or page data.
const codeBlocks = [
  { id: 'c1', type: 'code', s: { widgetMode: 'custom', html: '<style>.x{color:red}</style><script>window.secret=1</script><h2>청첩장 안내</h2><p>오시는 길</p>' } },
  { id: 'c2', type: 'code', visible: false, s: { widgetMode: 'custom', html: '<!-- internal --><section>주차 안내</section><script>alert(1)</script>' } },
  { id: 'c3', type: 'code', s: { widgetMode: 'custom', editorLabel: '약도 영역', html: '<h2>가는 방법</h2>' } },
  { id: 'yt', type: 'code', s: { widgetMode: 'youtube', html: '<iframe>embedded player</iframe>' } },
  { id: 'c4', type: 'code', s: { html: '<script>const tag = "</style>"; window.hiddenScript = true;</script><p>안전한 내용</p>' } },
];
const beforeCodeRead = JSON.stringify(codeBlocks);
const codeLabels = createScreenOrderIdentities(codeBlocks);
assert(codeLabels[0].detail.includes('청첩장 안내') && codeLabels[0].detail.includes('오시는 길')
  && !codeLabels[0].detail.includes('secret') && !codeLabels[0].detail.includes('color:red')
  && codeLabels[1].detail === '주차 안내'
  && codeLabels[2].customLabel === '약도 영역'
  && codeLabels[3].detail === ''
  && codeLabels[4].detail === '안전한 내용'
  && !codeLabels[4].detail.includes('hiddenScript'),
  'code row descriptions must show text only, preserve aliases, and exclude scripts even with mismatched inner tags');
assert(JSON.stringify(codeBlocks) === beforeCodeRead,
  'code navigator descriptions must not mutate stored HTML or hidden block state');
assert(createScreenOrderIdentities([
  { id: 'large', type: 'code', s: { html: '<script>' + 'internal'.repeat(7000) + '</script><h1>after large code</h1>' } },
])[0].detail === '',
  'oversized scripts must never leak source text through partial previews');

// UX-010 / 18th patch: image nicknames change editor identity, not the
// public caption, alt text, thumbnail selection or original page data.
const photos = [
  { id: 'image-a', type: 'image', s: { image: '/uploads/main.jpg', caption: '외부 공개 캡션', alt: '설명' } },
  { id: 'image-b', type: 'image', s: { mode: 'gallery', gallery: ['/uploads/a.jpg'], editorLabel: '본식 스냅', caption: '사진 설명' } },
  { id: 'image-c', type: 'image', visible: false, s: { editorLabel: '<b>약도 사진</b>', caption: '오시는 길' } },
  { id: 'text-a', type: 'text', s: { editorLabel: '반영하지 않음', title: '텍스트 헤더' } },
];
const unchangedPhotos = JSON.stringify(photos);
const photoIdentities = createScreenOrderIdentities(photos);
assert(photoIdentities[0].customLabel === '' && photoIdentities[0].detail === '외부 공개 캡션'
  && photoIdentities[1].customLabel === '본식 스냅' && photoIdentities[1].detail === '사진 설명'
  && photoIdentities[1].thumbnail === '/uploads/a.jpg'
  && photoIdentities[2].customLabel === '약도 사진' && photoIdentities[2].detail === '오시는 길'
  && photoIdentities[3].customLabel === '',
  'image aliases must be editor-only, preserve caption/thumbnail, and not affect unrelated block types');
assert(JSON.stringify(photos) === unchangedPhotos, 'image display labels must not mutate original image data');

// UX-015 / 20th patch: combined type + number, type + content and aliases.
const searchBlocks = [
  { id: 'code-1', type: 'code', s: { html: '<h2>행사 코드 2 안내</h2>' } },
  { id: 'photo-1', type: 'image', s: { caption: '이미지 2 위치 안내' } },
  { id: 'code-2', type: 'code', s: { editorLabel: '본식 영상', html: '<h2>본식 시작</h2>' } },
  { id: 'photo-2', type: 'image', s: { editorLabel: '약도 사진', caption: '오시는 길' } },
  { id: 'code-3', type: 'code', s: { html: '<h2>축하 인사</h2>' } },
];
const searchFixed = [
  { key: 'topnav', title: '상단 메뉴', block: { id: 'top' } },
  { key: 'bottom', title: '하단 고정 버튼', block: { id: 'bottom' } },
  { key: 'footer', title: '푸터', block: { id: 'footer' } },
];
const searchSnapshot = JSON.stringify([searchBlocks, searchFixed]);
const searchBy = (query) => findBlockNavigationMatches({
  query, blocks: searchBlocks, fixedDescriptors: searchFixed,
  getBlockLabel: (block) => ({ code: '코드 입력', image: '이미지' }[block.type] || block.type),
}).map((result) => result.id);
assert(JSON.stringify(searchBy('코드 2')) === JSON.stringify(['code-2'])
  && JSON.stringify(searchBy('코드 입력 3')) === JSON.stringify(['code-3'])
  && JSON.stringify(searchBy('이미지 2')) === JSON.stringify(['photo-2']),
  'explicit type-and-number search must find the numbered block, not another row whose description mentions the same number');
assert(JSON.stringify(searchBy('코드 축하')) === JSON.stringify(['code-3'])
  && JSON.stringify(searchBy('코드 본식')) === JSON.stringify(['code-2'])
  && JSON.stringify(searchBy('이미지 약도')) === JSON.stringify(['photo-2'])
  && JSON.stringify(searchBy('상단 고정 메뉴')) === JSON.stringify(['top'])
  && JSON.stringify(searchBy('하단 고정 버튼')) === JSON.stringify(['bottom']),
  'multi-word search must combine type, alias, preview and pinned group names');
assert(searchBy('없는 결과').length === 0 && searchBy('  ').length === 0
  && JSON.stringify(searchBy('코드')) === JSON.stringify(['code-1', 'code-2', 'code-3']),
  'search must preserve empty-result behavior and actual page order');
assert(JSON.stringify([searchBlocks, searchFixed]) === searchSnapshot,
  'search must never alter original page blocks, order, pinned regions or aliases');

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
const codeEditor = await readFile('src/editor/blockEditors/CodeEditor.jsx', 'utf8');
const codeEditorCss = await readFile('src/editor/blockEditors/CodeEditor.css', 'utf8');
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
const compactRowSource = await readFile('src/editor/editPanelParts/ScreenOrderRow.jsx', 'utf8');
const compactRowActions = await readFile('src/editor/editPanelParts/ScreenOrderRowActions.jsx', 'utf8');

const workspaceCss = await readFile('src/styles/workspace-shell.css', 'utf8');
const chromeCss = await readFile('src/screens/workspace/WorkspaceChrome.css', 'utf8');
const headerSource = await readFile('src/builder/PanelHeader.jsx', 'utf8');
const headerCss = await readFile('src/builder/PanelHeader.css', 'utf8');
const leftPanel = await readFile('src/screens/workspace/WorkspaceLeftPanel.jsx', 'utf8');
const workspaceScreen = await readFile('src/screens/WorkspaceEditorScreen.jsx', 'utf8');
const operationsWorkspaceCss = await readFile('src/screens/workspace/OperationsWorkspace.css', 'utf8');
const addDockCss = await readFile('src/styles/editor-widget-add-dock.css', 'utf8');
const previewPaneCss = await readFile('src/screens/workspace/WorkspacePreviewPane.css', 'utf8');
const previewSelectionPane = await readFile('src/screens/workspace/WorkspacePreviewPane.jsx', 'utf8');
const newPreviewHook = await readFile('src/runtime/usePreviewWindow.js', 'utf8');
const previewNewTab = await readFile('src/preview/DraftPreviewTab.jsx', 'utf8');
const rootEntrypoint = await readFile('src/main.jsx', 'utf8');
const appRoot = await readFile('src/App.jsx', 'utf8');

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
  '--editor-ui-row-size: 13px;',
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
  && fixedBlocksCss.includes('grid-template-columns: 20px minmax(0, 1fr) 30px !important')
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
// 25th patch: one actions menu per normal row, visibility stays keyboard
// accessible, and pinned rows have one select button without duplicate edit.
assert(!compactRowSource.includes('<ScreenOrderRowVisibility')
  && compactRowSource.includes('onToggleVisible={onToggleVisible}')
  && compactRowActions.includes('role="switch"')
  && compactRowActions.includes('onClick={() => run(onToggleVisible)}')
  && compactRowActions.includes("block.visible === false ? '표시하기' : '숨기기'")
  && !fixedCard.includes('fixed-open-button')
  && !fixedBlocksCss.includes('.fixed-open-button')
  && rowCss.includes('grid-template-columns: 14px minmax(0, 1fr) 28px !important;')
  && rowCss.includes('-webkit-line-clamp: 2;')
  && fixedBlocksCss.includes('grid-template-columns: 14px minmax(0, 1fr) 28px !important;')
  && rowIdentity.includes("failed ? <ImageOff size={16} />")
  && rowCss.includes('screen-order-v2-type-icon.thumbnail-error'),
  'compact layer navigator must retain hide/show functionality without duplicate icons, fit long names, and flag failed thumbnails');
// 22nd patch: visible public/draft status card is gone, but separate
// status computation, accessible announcement and actionable publish state stay.
assert(!headerSource.includes('panel-save-status operations-save-status')
  && !headerSource.includes('panel-status-track')
  && !headerSource.includes('{status}')
  && !headerCss.includes('.panel-save-status')
  && !chromeCss.includes('.panel-save-status')
  && headerSource.includes('visibleEditorDraftState({ page, saveStatus')
  && headerSource.includes('visibleEditorPublishState({ page, saved, saveStatus')
  && headerSource.includes('className="panel-save-announce" role="status"')
  && headerCss.includes('.panel-save-announce {')
  && headerSource.includes('data-public-state={publishState.kind}')
  && headerSource.includes('data-draft-state={draftState.kind}')
  && headerSource.includes('title={publishButtonHint}')
  && headerSource.includes('aria-busy={publishing}'),
  'header public/draft save card must be removed without changing publish logic or accessibility');

assert(leftPanel.includes("import './WorkspaceChrome.css';") && chromeCss.includes('grid-template-columns: repeat(4, minmax(0, 1fr)) !important') && chromeCss.includes('min-height: 46px !important') && chromeCss.includes('height: 36px !important'), 'WorkspaceChrome.css must own compact four-column workspace navigation');
assert(chromeCss.includes('background: #f1f3f6 !important') && chromeCss.includes('color: var(--product-text) !important'), 'active workspace tab must use the compact light selected state from WorkspaceChrome.css');
assert(css.includes('--editor-list-width: clamp(220px, 16.5vw, 276px);')
  && css.includes('--editor-edit-width: clamp(500px, min(calc(100vw - 410px), calc(var(--editor-list-width) + 394px)), 670px);')
  && css.includes('grid-template-columns: var(--editor-edit-width) minmax(0, 1fr) !important;')
  && editPanelLayoutCss.includes('.editor-inspector-panel { padding: 0 16px 32px;')
  && editPanelLayoutCss.includes('.builder-shell.canvas-editor-shell .editor-inspector-panel { padding-inline: 8px;')
  && css.includes('overflow: hidden !important;'),
  'selected reference: 276px list, 394px Inspector, 390px phone without adding outer scroll');
assert(!editPanelLayoutCss.includes('.editor-inspector-panel:has(.editor-selection-empty)') && layout.includes("const showPageOptions = section === 'options' || !selectedBlockId;") && layout.includes('{showPageOptions ? ('), 'unselected editor must keep inspector open with useful page settings');
assert(layout.includes('editor-composition-heading') && editPanelLayoutCss.includes('grid-template-columns: var(--editor-list-width) minmax(0, 1fr) !important;'), 'block list and inspector must share compact editor space');
assert(css.includes('overflow: hidden !important;') && editPanelLayoutCss.includes('.editor-composition-content {') && editPanelLayoutCss.includes('overflow-y: auto !important;') && editPanelLayoutCss.includes('.editor-inspector-panel {') && editPanelLayoutCss.includes('overflow-x: hidden !important;'), 'edit workspace must keep independent navigator and Inspector scrolls without outer scroll');
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
assert(codeEditor.includes('import { EditorField }')
  && codeEditor.includes('<EditorField label="목록 구분 이름">')
  && codeEditor.includes('aria-label="구분 이름"')
  && codeEditor.includes('<summary>영역 높이')
  && !codeEditor.includes('<summary>이름·높이')
  && !codeEditor.includes('code-editor-name-value')
  && !codeEditorCss.includes('.code-editor-name-value'),
  'code block list labels must be directly editable while display height stays in a single native disclosure');
assert(settingsView.includes('<InspectorBlockSwitch navigation={navigation} />')
  && inspectorSwitch.includes('aria-label="이전 블록"')
  && inspectorSwitch.includes('aria-label="다음 블록"')
  && editPanelLayoutCss.includes('.editor-inspector-panel .screen-order-v2-card')
  && editPanelLayoutCss.includes('.editor-block-switch'),
  'inspector must keep previous/next controls with independent list scrolling');
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
assert(disclosure.includes('<details') && disclosure.includes('<summary onClick={onActivate}>') && disclosure.includes('inspector-disclosure-body')
  && settingsHeader.includes('inspector-primary-heading')
  && !settingsHeader.includes('InspectorNavigation')
  && !editPanelLayoutCss.includes('.inspector-navigation')
  && [heroEditor, textEditor, imageEditor, formEditor, advanced].every(source => source.includes('<InspectorDisclosure'))
  && formEditor.includes('label="제출 후 동작과 연동"') && formEditor.includes('<FormPrivacySettings')
  && editPanelLayoutCss.includes('.screen-order-v2-settings .inspector-disclosure'),
  'inspector must use one shared content/behavior/design/advanced native disclosure hierarchy without duplicate shortcuts');
assert(editPanelLayoutCss.includes('.editor-composition-footer > .editor-page-settings-button')
  && editPanelLayoutCss.includes('min-height: 40px;')
  && layout.includes('<BlockNavigatorSearch blocks={screenOrderListProps.normalBlocks} fixedDescriptors={fixedDescriptors} selectedId={selectedBlockId} onSelect={chooseSearchResult} onRevealSelected={revealFixedSearch} />'),
  'page settings stay pinned below the list while search remains visible above scrollable rows');
assert(!css.includes('edit-section-tabs') && !css.includes('editor-page-options-stack'), 'workspace geometry must not own EditPanelLayout subsection UI');
assert(previewPaneCss.includes('border: 2px solid #cbd5e1')
  && previewPaneCss.includes('border-radius: 20px')
  && previewPaneCss.includes('box-shadow: 0 5px 18px #17203912')
  && previewPaneCss.includes('background: #f8f9fc')
  && !previewPaneCss.includes('.preview-width-toolbar')
  && !previewPaneCss.includes('.preview-selection-toolbar')
  && !previewPaneCss.includes('border: 6px solid #242934')
  && !previewPaneCss.includes('border-radius: 46px'),
  'preview must retain 390px content without redundant editor controls');
assert(previewPaneCss.includes('WorkspacePreviewPane — owns editor preview presentation') && previewPaneCss.includes('.preview-workspace') && previewPaneCss.includes('.preview-sticky') && previewPaneCss.includes('.phone-frame') && previewPaneCss.includes('scroll-margin-block: 120px') && !css.includes('.preview-workspace') && !css.includes('.preview-sticky') && !css.includes('.phone-frame'), 'WorkspacePreviewPane.css must own preview presentation while editor-workspace.css stays geometry-only');
assert(pageOptionsCss.includes('body .builder-shell .page-global-options-card') && pageOptionsCss.includes('padding: 0;') && pageOptionsCss.includes('border-radius: 0;') && pageOptionsCss.includes('background: transparent;') && !css.includes('page-global-options'), 'page options base contract must live in PageGlobalOptions.css and stay out of editor-workspace.css');
assert(!workspaceCss.includes('body .builder-shell .panel-header {') && !workspaceCss.includes('body .builder-shell .top-tabs {'), 'workspace shell must not own PanelHeader or top-tabs presentation');
assert(workspaceScreen.includes("import './workspace/OperationsWorkspace.css';") && operationsWorkspaceCss.includes('.inbox-workspace-shell') && operationsWorkspaceCss.includes('.stats-dashboard-shell') && operationsWorkspaceCss.includes('.settings-workspace-shell') && !workspaceCss.includes('.inbox-workspace-shell'), 'desktop operations geometry must be isolated from the common workspace shell');

// 21st patch: preview opens a new standalone tab with current draft in
// memory, not a second phone toolbar or a portal-based overlay.
const previewToken = '123e4567-e89b-42d3-a456-426614174000';
assert(validDraftPreviewToken(previewToken)
  && !validDraftPreviewToken('not-a-token')
  && !validDraftPreviewToken('../app')
  && draftPreviewTabUrl(previewToken, 'https://pagero.kr').includes('/?__pagero_preview=' + previewToken)
  && draftPreviewChannelName(previewToken) === 'pagero-editor-draft-preview:' + previewToken,
  'new tab requires a random opaque preview token with no HTML or page content in the URL');
assert(newPreviewHook.includes("window.open(draftPreviewTabUrl(token, window.location.origin), '_blank', 'noopener,noreferrer')")
  && newPreviewHook.includes("type: 'draft', token, page: draft")
  && newPreviewHook.includes("type === 'ready'")
  && !newPreviewHook.includes('setPreviewCopyIssue')
  && !newPreviewHook.includes('localStorage.setItem')
  && !newPreviewHook.includes('sessionStorage.setItem')
  && previewNewTab.includes('<PreviewRenderer page={state.page} leads={[]} editorPreview />')
  && previewNewTab.includes("type: 'ready', token")
  && previewNewTab.includes("type: 'received', token")
  && previewNewTab.includes('phone-frame pagero-draft-preview-content')
  && newPreviewHook.includes('receiverReady')
  && newPreviewHook.includes('팝업 차단 설정을 확인하고 다시 열어주세요.')
  && rootEntrypoint.includes('renderDraftPreviewTab()')
  && !appRoot.includes('PreviewCopyModal')
  && !appRoot.includes('previewCopyIssue'),
  'header draft preview must open a real tab and transport its snapshot only via ephemeral channel');
assert(!previewSelectionPane.includes('<PreviewSelectionToolbar')
  && !previewSelectionPane.includes('preview-stage-toolbar')
  && !previewSelectionPane.includes('미리보기 배율')
  && !previewSelectionPane.includes('requestFullscreen')
  && previewSelectionPane.includes('selectedBlockId={selectedBlockId}')
  && previewSelectionPane.includes('onSelectBlock={onSelectPreviewBlock}')
  && previewPaneCss.includes('.preview-selected-block { outline: 2px solid #2454ff')
  && previewPaneCss.includes('.landing-section:hover:not(.preview-selected-block)'),
  'editor phone must keep selection linkage but expose no duplicate stage chrome or action dock');
console.log(JSON.stringify({
  ok: true,
  checks: 23,
  scope: 'pagero-editor-canvas-and-inspector',
  shell: ['left-composition-and-settings', 'right-page-preview'],
  separateStyleTab: false,
  legacyStyleRouteNormalized: true,
}, null, 2));
