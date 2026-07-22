import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(full));
    } else if (/\.(js|jsx|mjs)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

async function readSource(file) {
  return [file, await readFile(file, 'utf8')];
}

function findMatching(source, start, openChar, closeChar) {
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === openChar) depth += 1;
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function useEffectBodies(source) {
  const bodies = [];
  let searchFrom = 0;
  while (searchFrom < source.length) {
    const effectIdx = source.indexOf('useEffect', searchFrom);
    if (effectIdx === -1) break;
    const open = source.indexOf('(', effectIdx);
    if (open === -1) break;
    const head = source.slice(open + 1, open + 160);
    if (/^\s*async\b/.test(head)) {
      bodies.push({ asyncCallback: true, body: '' });
      searchFrom = open + 1;
      continue;
    }
    const arrow = source.indexOf('=>', open);
    if (arrow === -1 || arrow - open > 180) {
      searchFrom = open + 1;
      continue;
    }
    const bodyOffset = source.slice(arrow + 2).search(/\S/);
    const start = arrow + 2 + bodyOffset;
    if (source[start] !== '{') {
      const end = source.indexOf(',', start);
      bodies.push({ asyncCallback: false, body: source.slice(start, end === -1 ? start + 200 : end) });
      searchFrom = start + 1;
      continue;
    }
    const end = findMatching(source, start, '{', '}');
    if (end !== -1) bodies.push({ asyncCallback: false, body: source.slice(start, end + 1) });
    searchFrom = (end === -1 ? start : end) + 1;
  }
  return bodies;
}

const sourceFiles = (await walk('src')).filter((file) => !file.includes(`${path.sep}styles${path.sep}`));
const scriptFiles = (await walk('scripts')).filter((file) => path.basename(file) !== 'runtime-quality-check.mjs');
const sources = new Map(await Promise.all([...sourceFiles, ...scriptFiles].map(readSource)));

for (const [file, source] of sources) {
  for (const effect of useEffectBodies(source)) {
    assert(!effect.asyncCallback, `${file}: useEffect callback must not be async`);
    assert(!/\breturn\s+(?:fetch|apiFetch|persist|saveJson|saveLocalJson|loadDaumPostcode|new\s+Promise)\b/.test(effect.body), `${file}: useEffect must not return a promise/value producer`);
    assert(!/\breturn\s+[^;\n]+?\.(?:then|catch|finally)\s*\(/.test(effect.body), `${file}: useEffect must not return a promise chain`);
  }
  if (file.startsWith(`src${path.sep}`)) {
    assert(!/\.\s*destroy\s*\(/.test(source), `${file}: direct destroy() calls must stay out of browser runtime cleanup paths`);
  }
}

const main = await readFile('src/main.jsx', 'utf8');
const app = await readFile('src/App.jsx', 'utf8');
const homeScreens = await readFile('src/screens/HomeScreens.jsx', 'utf8');
const authContext = await readFile('src/lib/authContext.js', 'utf8');
const appErrorBoundary = await readFile('src/components/AppErrorBoundary.jsx', 'utf8');
const blockEditor = await readFile('src/editor/BlockEditor.jsx', 'utf8');
const scheduleEditor = await readFile('src/editor/blockEditors/ScheduleEditor.jsx', 'utf8');
const widgetStylePanels = await readFile('src/editor/blockEditors/WidgetStylePanels.jsx', 'utf8');
const widgetStyleOptionsCss = await readFile('src/styles/preview-widget-style-options.css', 'utf8');
const previewDownloadCss = await readFile('src/styles/preview-download.css', 'utf8');
const previewScheduleCss = await readFile('src/styles/preview-schedule.css', 'utf8');
const widgetStyleEditorFiles = [
  'ActivityEditor.jsx',
  'BottomBarEditor.jsx',
  'CardsEditor.jsx',
  'CodeEditor.jsx',
  'DividerEditor.jsx',
  'DownloadEditor.jsx',
  'FaqEditor.jsx',
  'FooterEditor.jsx',
  'FormEditor.jsx',
  'HeroEditor.jsx',
  'ImageEditor.jsx',
  'LinksEditor.jsx',
  'MapEditor.jsx',
  'ReservationEditor.jsx',
  'ScheduleEditor.jsx',
  'SearchEditor.jsx',
  'SpacerEditor.jsx',
  'TextEditor.jsx',
  'TimerEditor.jsx',
  'TopNavEditor.jsx',
];
const widgetStyleEditors = await Promise.all(widgetStyleEditorFiles.map((file) => readFile('src/editor/blockEditors/' + file, 'utf8')));
const lazyEditorBoundary = await readFile('src/editor/LazyEditorBoundary.jsx', 'utf8');
const landingRenderer = await readFile('src/preview/LandingRenderer.jsx', 'utf8');
const leadDuplicatePolicy = await readFile('src/lib/leadDuplicatePolicy.js', 'utf8');
const leadModel = await readFile('src/lib/leadModel.js', 'utf8');
const statsMetrics = await readFile('src/lib/statsMetrics.js', 'utf8');
const utilityBlocks = await readFile('src/preview/renderers/UtilityBlocks.jsx', 'utf8');
const builderFeedback = await readFile('src/builder/BuilderFeedback.jsx', 'utf8');
const conflictUtils = await readFile('src/builder/conflictUtils.js', 'utf8');
const editorControls = await readFile('src/editor/controls.jsx', 'utf8');
const imageInputPreview = await readFile('src/editor/ImageInputPreview.jsx', 'utf8');
const colorControl = await readFile('src/editor/ColorControl.jsx', 'utf8');
const richField = await readFile('src/editor/RichField.jsx', 'utf8');
const previewUtils = await readFile('src/preview/renderers/previewUtils.jsx', 'utf8');
const stylePanel = await readFile('src/panels/StylePanel.jsx', 'utf8');
const inboxPanel = await readFile('src/panels/InboxPanel.jsx', 'utf8');
const pageModel = await readFile('src/lib/pageModel.js', 'utf8');
const pageRepository = await readFile('src/lib/pageRepository.js', 'utf8');
const pageSaveOptimizer = await readFile('src/lib/pageSaveOptimizer.js', 'utf8');
const pageSlugs = await readFile('src/lib/pageSlugs.js', 'utf8');
const leadIntegrations = await readFile('src/lib/leadIntegrations.js', 'utf8');
const apiClientSource = await readFile('src/lib/apiClient.js', 'utf8');
const settingsPanel = await readFile('src/panels/SettingsPanel.jsx', 'utf8');
const settingsPanelCss = await readFile('src/panels/SettingsPanel.css', 'utf8');
const runtimeConfigSource = await readFile('src/config/runtimeConfig.js', 'utf8');
const previewFormBlocks = await readFile('src/preview/renderers/FormBlocks.jsx', 'utf8');
const publicEmbedForm = await readFile('public/embed/form.js', 'utf8');
const formEmbedSource = await readFile('src/lib/formEmbed.js', 'utf8');
const localServer = await readFile('server/index.mjs', 'utf8');
const leadDeliverySource = await readFile('functions/api/leads/_delivery.js', 'utf8');
const landingTemplatesHook = await readFile('src/runtime/useLandingTemplates.js', 'utf8');
const workspaceShellActions = await readFile('src/runtime/useWorkspaceShellActions.js', 'utf8');
const inboxConnectionsPanel = await readFile('src/panels/inbox/InboxConnectionsPanel.jsx', 'utf8');
const inboxLeadHelpers = await readFile('src/panels/inbox/leadHelpers.js', 'utf8');
const googleSheetsSample = await readFile('src/panels/inbox/googleSheetsSample.js', 'utf8');
const pageSaveHelpers = await readFile('src/runtime/usePageSaveHelpers.js', 'utf8');
const savePageIdentity = await readFile('src/runtime/savePageIdentity.js', 'utf8');
const accountWorkspacePage = await readFile('src/runtime/useAccountWorkspacePage.js', 'utf8');
const createPageUrlCheck = await readFile('src/runtime/useCreatePageUrlCheck.js', 'utf8');
const settingsDraftActions = await readFile('src/panels/settings/settingsDraftActions.js', 'utf8');
const settingsAdvancedGroup = await readFile('src/panels/settings/AdvancedSettingsGroup.jsx', 'utf8');
const settingsSection = await readFile('src/panels/settings/SettingsSection.jsx', 'utf8');
const workspaceActivePanel = await readFile('src/screens/workspace/WorkspaceActivePanel.jsx', 'utf8');
const workspaceTabs = await readFile('src/screens/workspace/WorkspaceTabs.jsx', 'utf8');
const workspaceLeftPanel = await readFile('src/screens/workspace/WorkspaceLeftPanel.jsx', 'utf8');
const workspacePreviewPane = await readFile('src/screens/workspace/WorkspacePreviewPane.jsx', 'utf8');
const pageSaveAction = await readFile('src/runtime/usePageSaveAction.js', 'utf8');
const blockWriteGuard = await readFile('src/runtime/createBlockWriteGuard.js', 'utf8');
const pageDraftMutations = await readFile('src/runtime/pageDraftMutations.js', 'utf8');
const pageEditMutations = await readFile('src/runtime/pageEditMutations.js', 'utf8');
const pageIntegrationMutations = await readFile('src/runtime/pageIntegrationMutations.js', 'utf8');
const saveStatusActions = await readFile('src/runtime/saveStatusActions.js', 'utf8');
const duplicatePageAction = await readFile('src/runtime/createDuplicatePageAction.js', 'utf8');
const publicPageRuntimeActions = await readFile('src/runtime/publicPageRuntimeActions.js', 'utf8');
const leadCaptureActions = await readFile('src/runtime/leadCaptureActions.js', 'utf8');
const authSessionEffects = await readFile('src/runtime/useAuthSessionEffects.js', 'utf8');
const authAccountActions = await readFile('src/runtime/useAuthAccountActions.js', 'utf8');
const localWorkspacePersistence = await readFile('src/runtime/useLocalWorkspacePersistence.js', 'utf8');
const persistStyleSaveAction = await readFile('src/runtime/usePersistStyleSaveAction.js', 'utf8');
const previewTarget = await readFile('src/runtime/previewTarget.js', 'utf8');
const workspaceRouteGuards = await readFile('src/runtime/workspaceRouteGuards.js', 'utf8');
const workspaceTabLocation = await readFile('src/runtime/workspaceTabLocation.js', 'utf8');
const workspaceTabFallback = await readFile('src/runtime/useWorkspaceTabFallback.js', 'utf8');
const protectedWorkspaceRedirect = await readFile('src/runtime/useProtectedWorkspaceRedirect.js', 'utf8');
const workspaceAutoOpen = await readFile('src/runtime/useWorkspaceAutoOpen.js', 'utf8');
const pendingStyleBeforeUnload = await readFile('src/runtime/usePendingStyleBeforeUnload.js', 'utf8');
const workspaceStartMode = await readFile('src/runtime/workspaceStartMode.js', 'utf8');
const pageSaveFeedback = await readFile('src/runtime/pageSaveFeedback.js', 'utf8');
const pagePersistFlow = await readFile('src/runtime/pagePersistFlow.js', 'utf8');
const lazyRuntimeBoundary = await readFile('src/runtime/LazyRuntimeBoundary.jsx', 'utf8');
const fixedBlockRenderers = await readFile('src/editor/fixedBlockRenderers.jsx', 'utf8');
const blockEditorRegistry = await readFile('src/editor/blockEditorRegistry.jsx', 'utf8');
const imageGalleryEditor = await readFile('src/editor/blockEditors/ImageGalleryEditor.jsx', 'utf8');
const imageDisplayControls = await readFile('src/editor/blockEditors/ImageDisplayControls.jsx', 'utf8');
const imageEditorModel = await readFile('src/editor/blockEditors/imageEditorModel.js', 'utf8');
const mediaBlocks = await readFile('src/preview/renderers/MediaBlocks.jsx', 'utf8');
const baseComponentsImageCss = await readFile('src/styles/base-components-image.css', 'utf8');
const dividerEditorSource = await readFile('src/editor/blockEditors/DividerEditor.jsx', 'utf8');
const spacerEditorSource = await readFile('src/editor/blockEditors/SpacerEditor.jsx', 'utf8');
const layoutBlocksSource = await readFile('src/preview/renderers/LayoutBlocks.jsx', 'utf8');
const formOptionEditor = await readFile('src/editor/blockEditors/FormOptionEditor.jsx', 'utf8');
const baseComponentsOptionsCss = await readFile('src/styles/base-components-options.css', 'utf8');
const editorAnimationCss = await readFile('src/styles/editor-animation.css', 'utf8');
const editorScreenOrderPolishCss = await readFile('src/styles/editor-screen-order-polish.css', 'utf8');
const editorFinalCleanCss = await readFile('src/styles/editor-final-clean.css', 'utf8');
const editorBlockListsCss = await readFile('src/styles/editor-block-lists.css', 'utf8');
const previewWorkspaceReservationCss = await readFile('src/styles/preview-workspace-reservation.css', 'utf8');
const previewFormsCss = await readFile('src/styles/preview-forms.css', 'utf8');
const previewFormsSpacingCss = await readFile('src/styles/preview-forms-spacing.css', 'utf8');
const previewFormsQuestionsCss = await readFile('src/styles/preview-forms-questions.css', 'utf8');
const formEditorSource = await readFile('src/editor/blockEditors/FormEditor.jsx', 'utf8');
const formEditorCss = await readFile('src/editor/blockEditors/FormEditor.css', 'utf8');
const formDesignSectionSource = await readFile('src/editor/blockEditors/FormDesignSection.jsx', 'utf8');
const previewFormsDesignCss = await readFile('src/styles/preview-forms-design.css', 'utf8');
const legacyFormEditorCss = (await Promise.all([
  'base-components-html.css',
  'base-components-options.css',
  'base-components-rich.css',
  'preview-forms-advanced.css',
  'preview-forms-basic.css',
  'preview-forms-bottom-color.css',
  'preview-forms-basic-grid.css',
  'preview-forms-buttons.css',
  'preview-forms-controls.css',
  'preview-forms-design.css',
  'preview-forms-questions.css',
  'preview-forms-render.css',
  'preview-forms-spacing.css',
  'preview-forms.css',
  'preview-widgets-forms.css',
  'preview-widgets-links.css',
  'preview-widgets.css',
].map((file) => readFile(`src/styles/${file}`, 'utf8')))).join('\n');
assert(main.includes('root.render(<AppErrorBoundary><MapEmbedApp /></AppErrorBoundary>)'), 'embed root render must stay wrapped in AppErrorBoundary');
assert(main.includes('root.render(<AppErrorBoundary><PublicHomeEntry /></AppErrorBoundary>)'), 'public home root render must stay wrapped in AppErrorBoundary');
assert(main.includes('root.render(<AppErrorBoundary><App /></AppErrorBoundary>)') || (main.includes('<AppErrorBoundary>') && main.includes('<App />')), 'app root render must stay wrapped in AppErrorBoundary');
assert(app.includes("const InboxPanel = lazy(() => import('./panels/InboxPanel.jsx'))"), 'InboxPanel must stay lazy-loaded');
assert(app.includes("const StatsPanel = lazy(() => import('./panels/StatsPanel.jsx'))"), 'StatsPanel must stay lazy-loaded');
assert(app.includes("const SettingsPanel = lazy(() => import('./panels/SettingsPanel.jsx'))"), 'SettingsPanel must stay lazy-loaded');
assert(app.includes("const AdminPanel = lazy(() => import('./panels/AdminPanel.jsx'))") || app.includes("const AdminPanel = lazy(() => import('./panels/MasterAdminPanel.jsx'))"), 'AdminPanel must stay lazy-loaded');
assert(app.includes("const TemplatesPanel = lazy(() => import('./panels/TemplatesPanel'))"), 'TemplatesPanel must stay lazy-loaded');
assert(app.includes("await import('./templates/landingTemplates')") || app.includes("await import('./templates/landingTemplates.js')") || landingTemplatesHook.includes("await import('../templates/landingTemplates.js')"), 'landing templates must stay dynamically imported');
assert(!/import\s+\{?\s*LANDING_TEMPLATES\b/.test(app), 'landing templates must not be statically imported');
assert(publicPageRuntimeActions.includes('export function authForTargetPage') && publicPageRuntimeActions.includes('publicLandingSlug && targetPage?.projectId ? null : authUser'), 'public landing lead/event writes must not use the signed-in builder project context');
assert(publicPageRuntimeActions.includes('persistEvent(event, targetPage, authForPage(targetPage))'), 'public landing event writes should use the target page project context');
assert(app.includes('createPageEventTracker({') && app.includes('publicLandingSlug,') && app.includes('persistEvent,'), 'App must delegate public page event tracking context');
assert(leadCaptureActions.includes('const targetAuthUser = authForTargetPage(targetPage)') && leadCaptureActions.includes('persistLead(savedLead, targetPage, targetAuthUser)'), 'public landing lead writes should use the target page project context');
assert(leadCaptureActions.includes('export function createLeadCaptureAction') && leadCaptureActions.includes('trackForPage(targetPage') && leadCaptureActions.includes('syncLeadPatch(savedLead.id'), 'lead capture writes and patch sync must stay centralized');
assert(app.includes('const addLeadForPage = createLeadCaptureAction({') && app.includes('runLeadDeliveryForPage,') && app.includes('authForTargetPage,'), 'App must delegate lead capture actions without losing public page context');
assert(authSessionEffects.includes('export function useAuthSessionEffects') && authSessionEffects.includes('refreshAuthSession({ session, projectId: pageProjectId') && app.includes('useAuthSessionEffects({'), 'App must delegate auth session refresh effects out of App');
assert(accountWorkspacePage.includes('export function useAccountWorkspacePage') && accountWorkspacePage.includes('fetchServerPage(slug, context)') && accountWorkspacePage.includes('localPageMutationRef.current !== loadMutation') && app.includes('useAccountWorkspacePage({'), 'App must delegate account workspace page loading without losing mutation guards');
assert(accountWorkspacePage.includes('useLayoutEffect') && accountWorkspacePage.includes('belongsToAccount') && accountWorkspacePage.includes('isolatedPage'), 'Account workspace loading must isolate cached pages owned by another account before paint');
assert(savePageIdentity.includes('PAGE_ACCOUNT_MISMATCH') && savePageIdentity.includes('matchesSaveContext(sourcePage'), 'Page saves must reject server identities owned by another account');
assert(authAccountActions.includes('export function createAuthAccountActions') && authAccountActions.includes('logoutAuthAccount({ session })') && authAccountActions.includes('updateAuthAccount({') && authAccountActions.includes('fetchServerPage(projectSlug, projectContextForInvite)') && app.includes('createAuthAccountActions({'), 'App must delegate auth account actions without route helper dependencies');
assert(localWorkspacePersistence.includes('export function useLocalWorkspacePersistence') && localWorkspacePersistence.includes('latestPageRef.current = page') && app.includes('useLocalWorkspacePersistence({'), 'App must delegate local workspace persistence and latest page ref syncing');
assert(publicPageRuntimeActions.includes('export function createLeadPatchSync') && publicPageRuntimeActions.includes('__expectedUpdatedAt') && publicPageRuntimeActions.includes('isLeadConflictError(error)'), 'lead patch sync conflict handling must stay centralized');
assert(/<PreviewRenderer[\s\S]*?page=\{publicPage\}[\s\S]*?addLead=\{\(lead\) => addLeadForPage\(publicPage, lead\)\}[\s\S]*?track=\{\(event\) => trackForPage\(publicPage, event\)\}/.test(app), 'public landing renderer must submit leads and stats events against the public page context');
assert(!/import\s+(?:InboxPanel|StatsPanel|StylePanel|SettingsPanel|TemplatesPanel|AdminPanel|AiPanel)\b/.test(app), 'heavy panels and AI panel must not be statically imported into App');
assert(!/import\s+(?:\{[^}]*Editor[^}]*\}|[A-Z][A-Za-z]+Editor)\s+from\s+['"]\.\/editor\/blockEditors\//.test(app), 'block editors must not be statically imported into App');
assert(lazyRuntimeBoundary.includes('function LazyEditorFallback()') && lazyRuntimeBoundary.includes('class LazyEditorBoundary extends Component'), 'fixed block editor controls must keep lazy fallback and error boundary');
assert(lazyRuntimeBoundary.includes('componentDidUpdate(prevProps)') && /this\.setState\(\{\s*error:\s*null(?:,\s*recovering:\s*false)?\s*\}\)/.test(lazyRuntimeBoundary), 'lazy editor boundaries must reset after selection changes');
assert(lazyRuntimeBoundary.includes("this.props.variant !== 'preview' && recoverLazyChunkLoad(error)") && !/class LazyEditorBoundary[\s\S]*?recoverLazyChunkLoad\(error\)/.test(lazyRuntimeBoundary), 'workspace preview and editor lazy errors must not redirect the whole editor runtime');
assert(fixedBlockRenderers.includes('renderLazyEditor') && fixedBlockRenderers.includes('createFixedBlockRenderers'), 'fixed block editor renderers must stay split from App');
assert(blockEditorRegistry.includes('export const BLOCK_EDITORS'), 'block editor registry must stay split from App');
assert(imageGalleryEditor.includes("import { EditorList } from '../ui/index.js'") && imageGalleryEditor.includes('<GalleryMultiUpload'), 'image gallery editor must keep multi-upload and use the shared item list');
assert(imageDisplayControls.includes('<SegmentedControl') && imageDisplayControls.includes('label="표시 방식"') && imageDisplayControls.includes("value: 'original'") && imageDisplayControls.includes("value: 'fill'"), 'image display controls must expose original and fill as one explicit mode choice');
assert(imageDisplayControls.includes('<ToggleRow label="모서리 둥글게"') && !imageDisplayControls.includes('image-mode-toolbar'), 'image corner rounding must stay separate from image display mode');
assert(imageDisplayControls.includes("display === 'fill'") && imageDisplayControls.includes('위치·높이 조정') && imageEditorModel.includes("imageDisplay: 'fill'") && imageEditorModel.includes('imageHeightPx') && imageEditorModel.includes('imageX') && imageEditorModel.includes('imageY'), 'fill mode must keep its height and focal-position editor contract');
assert(mediaBlocks.includes('objectPosition:') && mediaBlocks.includes('s.imageX ?? 50') && mediaBlocks.includes('s.imageY ?? 50') && mediaBlocks.includes('s.imageHeightPx || 260') && mediaBlocks.includes("s.rounded ? 'rounded' : ''"), 'image renderer must consume crop height, focal position, and rounded state');
assert(baseComponentsImageCss.includes('.crop-modal .crop-preview{max-height:none!important}'), 'image crop preview must not cap heights below the renderer maximum');
assert(dividerEditorSource.includes('label="선 모양"') && dividerEditorSource.includes("value: 'solid'") && dividerEditorSource.includes("value: 'dashed'") && dividerEditorSource.includes("value: 'dotted'"), 'divider editor must expose every renderer-supported line style');
assert(dividerEditorSource.includes('width < 100 &&') && dividerEditorSource.includes('label="정렬"') && dividerEditorSource.includes('marginY') && dividerEditorSource.includes('<Color label="선 색상"'), 'divider editor must expose alignment only when width changes its position, plus spacing and color controls');
assert(layoutBlocksSource.includes('s.width ?? 100') && layoutBlocksSource.includes('s.thickness ?? 1') && layoutBlocksSource.includes('s.marginY ?? 24') && layoutBlocksSource.includes("s.color || '#E2E8F0'") && layoutBlocksSource.includes("s.align || 'center'"), 'divider renderer must consume every exposed style control');
assert(spacerEditorSource.includes('<span>여백 높이</span>') && spacerEditorSource.includes('min="8" max="200" step="4"') && !spacerEditorSource.includes('SegmentedControl'), 'spacer editor must use one exact height control without misleading presets');
assert(layoutBlocksSource.includes('Math.max(8, Math.min(200, Number(block.s?.height ?? 40)))') && layoutBlocksSource.includes('style={{ height:') && layoutBlocksSource.includes('height}px'), 'spacer renderer must preserve the editor height range exactly');
assert(imageGalleryEditor.includes('max={4}') && imageGalleryEditor.includes('.slice(0, 4)') && imageGalleryEditor.includes("onAdd={gallery.length < 4 ?") && imageGalleryEditor.includes('onRemove={(item) => removeGallery(item.index)}'), 'image gallery item list must enforce its four-image limit and removal callback');
assert(mediaBlocks.includes("s.galleryLayout === 'grid'") && mediaBlocks.includes('gallery.slice(0, gridCount)') && mediaBlocks.includes('image-gallery-grid-${visibleGallery.length}') && pageModel.includes("galleryLayout: ['slide','grid']") && pageModel.includes('s.galleryGridCount = Number(s.galleryGridCount) === 2 ? 2 : 4'), 'image gallery grid mode and 2/4 item count must be sanitized and consumed by the public renderer');
assert(pageModel.includes("s.title = s.title ?? '일정 안내'"), 'schedule title sanitization must preserve an explicitly cleared value');
assert(formOptionEditor.includes("import { Plus, Trash2 } from 'lucide-react'") && formOptionEditor.includes('className="option-editor-row"'), 'form options must use compact labeled rows and icon actions');
assert(formOptionEditor.includes('if (list.length <= 1) return') && formOptionEditor.includes('disabled={list.length <= 1}') && !formOptionEditor.includes('.filter((item) => String(item).trim())'), 'form option editing must preserve in-progress text and keep at least one choice');
assert(!baseComponentsOptionsCss.includes('.option-editor{') && !editorScreenOrderPolishCss.includes('.option-editor') && editorBlockListsCss.includes('.option-editor-row'), 'form option styles must have one active owner');
assert(!editorAnimationCss.includes('gallery-edit') && !editorScreenOrderPolishCss.includes('gallery-edit') && !editorFinalCleanCss.includes('gallery-edit'), 'imported editor styles must not retain the removed gallery editor wrapper');
assert(!previewWorkspaceReservationCss.includes('reservation-custom-card') && editorBlockListsCss.includes('.reservation-custom-head-row') && editorBlockListsCss.includes('.reservation-custom-body'), 'reservation custom-field styles must stay owned by the editor stylesheet');
assert(!previewFormsCss.includes('form-question-') && !previewFormsSpacingCss.includes('form-question-') && !previewFormsQuestionsCss.includes('form-question-') && editorBlockListsCss.includes('.form-question-tools') && editorBlockListsCss.includes('.form-question-actions'), 'form question styles must stay owned by the editor stylesheet');
assert(formEditorSource.includes("import './FormEditor.css'") && formEditorCss.includes('.form-basic-grid') && formEditorCss.includes('.form-advanced-group') && formEditorCss.includes('.question-compact-row'), 'FormEditor must own its active layout styles in its lazy chunk');
assert(!formDesignSectionSource.includes('label="모서리"') && formDesignSectionSource.includes("[ 'solid', '기본' ]") && formDesignSectionSource.includes("[ 'round', '캡슐' ]") && formDesignSectionSource.includes("[ 'line', '테두리' ]"), 'form design controls must avoid overlapping radius settings and name distinct button shapes');
assert(previewFormsDesignCss.includes('.form-input-round input') && previewFormsDesignCss.includes('border-radius:14px!important') && previewFormsDesignCss.includes('.form-input-box input') && previewFormsDesignCss.includes('border-radius:4px!important') && previewFormsDesignCss.includes('border-bottom:2px solid #cbd5e1!important'), 'form input choices must render visibly distinct round, box, and underline styles');
assert(previewFormsDesignCss.includes('.form-button-solid button[type="submit"]') && previewFormsDesignCss.includes('border-radius:12px!important') && previewFormsDesignCss.includes('.form-button-round button[type="submit"]') && previewFormsDesignCss.includes('border-radius:999px!important') && previewFormsDesignCss.includes('.form-button-line button[type="submit"]'), 'form and reservation button choices must render distinct default, capsule, and outline styles');
assert(!/(?:form-basic-grid|form-advanced-group|form-advanced-item|form-design-panel-clean|form-design-range|form-color-row|question-compact-row|required-inline|inlet-question-tools)/.test(legacyFormEditorCss), 'shared and preview styles must not retain FormEditor-only selectors');
assert(formEditorCss.includes('.form-basic-detail') && formEditorCss.includes('.privacy-compact-panel') && formEditorCss.includes('.form-one-line-panel') && formEditorCss.includes('.inlet-export-card') && formEditorCss.includes('.inlet-html-modal-backdrop') && formEditorCss.includes('.inlet-html-actions'), 'FormEditor lazy CSS must own its collapsible settings, export card, and HTML modal');
assert(!/(?:inlet-html-|inlet-code-notice|inlet-export-card|form-basic-subgrid|form-basic-detail|form-inline-detail|form-one-line-panel|privacy-compact-panel|form-design-panel|form-design-grid|form-advanced-note|form-hover-color-row|privacy-inline-top)/.test(legacyFormEditorCss + editorAnimationCss + editorScreenOrderPolishCss), 'shared editor and preview styles must not retain Form-only settings or modal selectors');
assert(authContext.includes("CLIENT_ADMIN: 'clientAdmin'") && authContext.includes("BUILDER: 'builder'") && authContext.includes("MANAGER: 'manager'"), 'access modes must include builder, manager, and client admin');
assert(authContext.includes("export const CLIENT_ADMIN_TABS = ['inbox', 'stats', 'settings']"), 'client admin tabs must stay limited to inbox/stats/settings');
assert(authContext.includes("export const BUILDER_TABS = ['edit', 'style', 'inbox', 'stats', 'settings']"), 'builder tabs must keep admin out of the public workspace navigation');
assert(authContext.includes('MANAGER_PERMISSION_TABS') && authContext.includes('DEFAULT_MANAGER_ACCESS') && authContext.includes('managerForAuthUser'), 'manager permission contract must stay explicit');
assert(authContext.includes('export function canWriteTab') && authContext.includes('export function canReadTab') && authContext.includes('export function canUseAdminSurface'), 'read/write tab permission helpers must stay available');
assert(authContext.includes('ACCESS_MODES.UNAUTHORIZED'), 'missing auth/project state must map to unauthorized');
assert(authContext.includes('clientAdminEnabled = false') && authContext.includes('clientAdminEnabled && ownership.clientAccess'), 'client admin mode must stay behind the internal flag until server enforcement exists');
assert(runtimeConfigSource.includes('VITE_INLET_ENABLE_OWNER_ADMIN_MODE') && runtimeConfigSource.includes('ownerAdminModeEnabled'), 'owner admin internal runtime flag must be explicit');
assert(pageSaveFeedback.includes('pageSaveErrorFeedback') && pageSaveFeedback.includes('pageSaveSuccessFeedback'), 'page save feedback copy must stay centralized');
assert(pagePersistFlow.includes('pageSaveErrorFeedback') && pagePersistFlow.includes('pageSaveSuccessFeedback'), 'page and style saves must share feedback through the persist flow');
assert(pagePersistFlow.includes('handlePagePersistError') && pagePersistFlow.includes('commitSavedPageResult'), 'page persist flow must stay centralized');
assert(previewTarget.includes('previewUrlForPage') && previewTarget.includes('createPreviewPage'), 'preview URL calculation must stay split from App');
assert(app.includes('const previewUrl = previewUrlForPage(page)') && app.includes('createPreviewPage({'), 'App must use the shared preview target helpers');
assert(saveStatusActions.includes('export function createSaveStatusMarker') && saveStatusActions.includes('export function createLocalJsonSaver') && saveStatusActions.includes('saveErrorNoticeRef.current'), 'save status and local json feedback must stay centralized');
assert(app.includes('const markSaveStatus = createSaveStatusMarker(setSaveStatus)') && app.includes('const saveLocalJson = createLocalJsonSaver({'), 'App must delegate local save status handling');
assert(duplicatePageAction.includes('export function createDuplicatePageAction') && duplicatePageAction.includes("replaceLocationTab(tabKeys, 'edit')") && duplicatePageAction.includes('setLeads([])') && duplicatePageAction.includes('setEvents([])'), 'duplicate page post-processing must stay centralized');
assert(app.includes('const duplicatePageWithUrl = createDuplicatePageAction({') && app.includes('tabKeys: TAB_KEYS') && app.includes('startModeKey: START_MODE_KEY'), 'App must delegate duplicate page post-processing');
assert(workspaceRouteGuards.includes('export function isProtectedWorkspacePath') && workspaceRouteGuards.includes('/^\\/(?:dashboard|app|account)(?:\\/|$)/'), 'workspace route protection must stay split from App and limited to internal workspace paths');
assert(workspaceRouteGuards.includes('export function routeUsesWorkspaceTabs') && workspaceRouteGuards.includes('!publicLandingSlug && !staticPage && !inviteToken && !adminRoute && !authRouteMode'), 'workspace tab route gating must stay split from App and keep public/auth/admin routes excluded');
assert(protectedWorkspaceRedirect.includes('if (authUser || !protectedWorkspacePath) return;') && protectedWorkspaceRedirect.includes("window.location.replace('/')"), 'protected workspace redirect must stay isolated from public home routing');
assert(app.includes('useProtectedWorkspaceRedirect({ authUser, protectedWorkspacePath })'), 'App must delegate protected workspace redirect to the shared hook');
assert(app.includes("import { isProtectedWorkspacePath, routeUsesWorkspaceTabs as shouldUseWorkspaceTabs } from './runtime/workspaceRouteGuards.js'"), 'App must use the shared workspace route guards');
assert(app.includes('const routeUsesWorkspaceTabs = shouldUseWorkspaceTabs({ publicLandingSlug, staticPage, inviteToken, adminRoute, authRouteMode })'), 'App must derive workspace tab routing through the shared guard');
assert(pageSaveAction.includes('commitSavedPageResult') && persistStyleSaveAction.includes('commitSavedPageResult'), 'page and style saves must share persisted page commit flow');
assert(!persistStyleSaveAction.includes('latestPageRef.current = nextPage') && !persistStyleSaveAction.includes('setPage(nextPage)') && /result = await persistPage\(nextPage, authUser, \{ tab: 'style', expectedUpdatedAt, saveMode: 'update-existing' \}\);[\s\S]*?commitSavedPageResult\(\{/.test(persistStyleSaveAction), 'style saves must update visible page only after successful persistence');
assert(app.includes('isOwnerAdminModeEnabled') && app.includes('clientAdminEnabled: ownerAdminModeEnabled'), 'App must derive client admin access from the internal runtime flag');
assert(workspaceActivePanel.includes('const canRenderBuilder = canUseBuilder && !mobileOperationsOnly') && workspaceActivePanel.includes("canRenderBuilder && tab === 'edit'") && workspaceActivePanel.includes("canRenderBuilder && tab === 'style'"), 'builder-only editor and style tabs must stay permission gated');
assert(workspaceTabs.includes('NAV.filter(([key]) => allowedTabs.includes(key))'), 'navigation must render only allowed tabs');
assert(workspaceTabLocation.includes('export function tabFromLocation') && workspaceTabLocation.includes('export function hasTabDeepLink') && workspaceTabLocation.includes("new URLSearchParams(location.search).get('tab')") && workspaceTabLocation.includes('export function replaceLocationTab'), 'workspace tab query helpers must stay split from App for authenticated visual QA and operator URLs');
assert(app.includes('tabFromLocation(TAB_KEYS') && app.includes('hasTabDeepLink(TAB_KEYS)') && app.includes('replaceLocationTab(TAB_KEYS,'), 'App must use shared workspace tab location helpers');
assert(workspaceStartMode.includes('export function shouldShowStartModeOverlay()') && workspaceStartMode.includes('return false;'), 'workspace start mode overlay must stay disabled after the repeated modal regression');
assert(!app.includes('<StartModeOverlay') && !app.includes('showStartModeOverlay'), 'App must not render the disabled start mode overlay');
assert(workspaceLeftPanel.includes("const showTemplateIntro = !mobileOperationsOnly && canManageAdmin && startMode === 'template'"), 'template controls must stay desktop and master-admin-only');
assert(app.includes('adminRoute') && app.includes("return /^\\/(?:admin|[^/?#]+\\/admin)\\/?$/.test(routePath)") && app.includes('<AdminPanel'), 'admin panel must stay on a private /admin route');
assert(app.includes('const canWriteTabKey = (key) => canWriteTab(accessMode, page, authUser, key)') && app.includes('createBlockWriteGuard({'), 'App must enforce manager write permissions before mutation');
assert(blockWriteGuard.includes('canWriteTabKey(targetTab)') && blockWriteGuard.includes('markSaveStatus') && blockWriteGuard.includes('showToast'), 'block write permission feedback must stay centralized');
assert(pageDraftMutations.includes('latestPageRef.current = normalized') && pageDraftMutations.includes('markLocalPageMutation()'), 'local page draft commits must update latest page and mutation refs centrally');
assert(pageEditMutations.includes('export function createPageEditMutations') && pageEditMutations.includes('updateTheme') && pageEditMutations.includes('updateIntegrations'), 'page edit mutation actions must stay centralized');
assert(pageIntegrationMutations.includes('lockedToAccount: true') && pageIntegrationMutations.includes('authUser?.email'), 'free email integration normalization must stay centralized');
assert(app.includes("selectedBlockId={canUseBuilder ? openId : ''}") && app.includes('onSelectPreviewBlock={canUseBuilder ? selectPreviewBlock : undefined}') && workspacePreviewPane.includes('selectedBlockId={selectedBlockId}') && workspacePreviewPane.includes('onSelectBlock={onSelectPreviewBlock}'), 'client admin preview must not route into block editing');
assert(workspaceTabFallback.includes('if (!authUser) return;') && workspaceTabFallback.includes('if (!routeUsesWorkspaceTabs) return;') && workspaceTabFallback.includes('const nextTab = allowedTabs[0]') && workspaceTabFallback.includes('if (!nextTab) return;') && workspaceTabFallback.includes('replaceLocationTab(tabKeys, nextTab)'), 'workspace tab redirect must require login, workspace routing, and an allowed destination');
assert(app.includes('useWorkspaceTabFallback({') && app.includes('tabKeys: TAB_KEYS'), 'App must delegate workspace tab fallback routing to the shared hook');
assert(workspaceAutoOpen.includes('if (!authUser || canUseBuilder || workspaceOpen) return;') && workspaceAutoOpen.includes('persistOpenState(true)') && workspaceAutoOpen.includes('setWorkspaceOpen(true)'), 'workspace auto-open must remain limited to authenticated non-builder workspace sessions');
assert(app.includes('useWorkspaceAutoOpen({') && app.includes('persistOpenState: (open) => saveLocalJson(DASHBOARD_KEY, { open }'), 'App must delegate workspace auto-open state to the shared hook');
assert(pendingStyleBeforeUnload.includes('if (!hasPendingStyle) return undefined;') && pendingStyleBeforeUnload.includes("window.addEventListener('beforeunload', handleBeforeUnload)") && pendingStyleBeforeUnload.includes("window.removeEventListener('beforeunload', handleBeforeUnload)"), 'pending style beforeunload guard must stay isolated from App');
assert(app.includes('usePendingStyleBeforeUnload(hasPendingStyle)'), 'App must delegate pending style beforeunload handling to the shared hook');
assert(['useProtectedWorkspaceRedirect({ authUser, protectedWorkspacePath })', 'useWorkspaceAutoOpen({', 'useWorkspaceTabFallback({', 'usePendingStyleBeforeUnload(hasPendingStyle)'].every((needle) => app.includes(needle)), 'workspace session effects must stay delegated out of App');
assert(app.includes('const mobileWorkspace = useMobileWorkspaceMode()') && app.includes("accountAllowedTabs.filter((key) => key === 'inbox' || key === 'stats')"), 'mobile workspace must only expose inbox and stats');
assert(workspaceActivePanel.includes('canUseBuilder && !mobileOperationsOnly') && workspaceActivePanel.includes("!mobileOperationsOnly && tab === 'settings'"), 'mobile workspace must not mount editor, style, or settings panels');
assert(
  (app.includes("['topnav', 'bottombar', 'footer'].includes(target?.type)") && app.includes("setOpenId('');") && app.indexOf("['topnav', 'bottombar', 'footer'].includes(target?.type)") < app.indexOf('document.getElementById(`editor-block-${id}`)'))
  || (workspaceShellActions.includes("['topnav', 'bottombar', 'footer'].includes(target?.type)") && workspaceShellActions.includes("setOpenId('');") && workspaceShellActions.indexOf("['topnav', 'bottombar', 'footer'].includes(target?.type)") < workspaceShellActions.indexOf('document.getElementById(`editor-block-${id}`)')),
  'preview fixed layout clicks must not auto-open editor blocks'
);
assert(!homeScreens.includes('전송 상태') && !homeScreens.includes('알림 전송 상태'), 'public home copy should not expose delivery status as an operator UI feature');
assert(formEmbedSource.includes('DEFAULT_EMBED_SCRIPT_URL = \'https://pagero.kr/embed/form.js\'') && formEmbedSource.includes('data-pagero-page') && formEmbedSource.includes('data-pagero-form-id') && !formEmbedSource.includes('data-pagero-project-id="${escapeHtml(safePage.projectId)}"'), 'form embed snippets must stay compact, hosted, and slug-based');
assert(!/[�占]|吏덈Ц|\?섏씠|媛쒖씤|\?묒닔/.test(formEmbedSource), 'form embed generator must not contain mojibake fallback copy');
assert(formEmbedSource.includes("brand: '페이지로'") && formEmbedSource.includes("title: safeText(form.title, '상담 신청')") && formEmbedSource.includes("submit: safeText(form.submit, '접수하기')"), 'form embed generator must keep readable Korean fallback copy');
assert(publicEmbedForm.includes('fetchPublicFormConfig') && publicEmbedForm.includes('/api/pages/') && publicEmbedForm.includes('postJson(API_URL, payload)'), 'embedded forms must load public page form config and submit to the lead API');
assert(publicEmbedForm.includes('function slugFromNode') && publicEmbedForm.includes("node.getAttribute('data-pagero-slug')") && publicEmbedForm.includes("node.getAttribute('data-page-slug')") && publicEmbedForm.includes("node.getAttribute('data-pagero-form-embed')"), 'embedded forms must accept compact slug aliases on scripts and div targets');
assert(publicEmbedForm.includes('function formIdFromNode') && publicEmbedForm.includes('function projectIdFromNode'), 'embedded forms must share form/project id parsing across script and div targets');
assert(publicEmbedForm.includes('pagero-powered') && publicEmbedForm.includes('HOME_URL') && publicEmbedForm.includes('\\uD398\\uC774\\uC9C0\\uB85C\\uB85C \\uC81C\\uC791'), 'free embedded forms must keep Pagero powered branding');
assert(publicEmbedForm.includes('utm_source') && publicEmbedForm.includes('sourceUrl') && publicEmbedForm.includes('referrer'), 'embedded form submissions must keep traffic attribution fields');
assert(publicEmbedForm.includes('var trafficInfo = traffic()') && publicEmbedForm.includes('utmCampaign: trafficInfo.utmCampaign') && publicEmbedForm.includes('sourceLabel: trafficInfo.sourceLabel'), 'embedded form submissions must store traffic attribution both on the lead and in values');
assert(previewFormBlocks.includes('currentTrafficAttribution()') && previewFormBlocks.includes('sourceUrl: traffic.sourceUrl') && previewFormBlocks.includes('utmCampaign: traffic.utmCampaign') && previewFormBlocks.includes('sourceLabel: traffic.sourceLabel'), 'public landing form submissions must store source URL, UTM, referrer, and source label fields');
assert(inboxLeadHelpers.includes('function isFreeEmailLocked') && inboxConnectionsPanel.includes('locked-email-value') && inboxConnectionsPanel.includes('aria-label="계정 이메일로 고정됨"') && inboxConnectionsPanel.includes('무료 사용자는 계정 이메일로만 알림을 받습니다.'), 'free plan email alerts must render a locked account email instead of an editable recipient input');
assert(/const openWorkspace = [\s\S]*?setOpenId\(''\);[\s\S]*?setAddOpen\(false\);[\s\S]*?if \(!canUseBuilder\)/.test(app) || /const openWorkspace = [\s\S]*?setOpenId\(''\);[\s\S]*?setAddOpen\(false\);[\s\S]*?if \(!canUseBuilder\)/.test(workspaceShellActions), 'workspace entry must collapse any open editor block and add panel');
assert(lazyRuntimeBoundary.includes('class LazyEditorBoundary'), 'fixed block editors must isolate lazy chunk failures');
assert(fixedBlockRenderers.includes('renderLazyEditor') && lazyRuntimeBoundary.includes('<LazyEditorBoundary resetKey=') && lazyRuntimeBoundary.includes('<Suspense fallback={<LazyEditorFallback />}'), 'fixed block editors must keep lazy loading fallback and boundary');
assert(blockEditor.includes('LazyEditorBoundary') && lazyEditorBoundary.includes('class LazyEditorErrorBoundary'), 'BlockEditor must isolate lazy editor chunk failures');
assert(blockEditor.includes('<AnchorControl') && blockEditor.indexOf('<AnchorControl') < blockEditor.indexOf('<LazyEditorBoundary') && !blockEditor.includes('id=\"advanced\"'), 'BlockEditor must keep widget code at the top without the redundant advanced section');
assert(fixedBlockRenderers.includes('<AnchorControl') && fixedBlockRenderers.indexOf('<AnchorControl') < fixedBlockRenderers.indexOf('renderLazyEditor(Editor') && !fixedBlockRenderers.includes('id=\"advanced\"'), 'fixed block editors must keep widget code at the top without the redundant advanced section');
assert(scheduleEditor.includes("import { EditorTabs } from '../ui/index.js'") && scheduleEditor.includes('<EditorTabs'), 'ScheduleEditor must import and render EditorTabs inside its lazy chunk');
assert(widgetStyleEditors.every((source) => source.includes("label: '스타일'")), 'every registered widget editor must expose an explicit style tab');
assert(widgetStylePanels.includes('function AlignmentControl') && !widgetStylePanels.includes('WidgetSurfaceControls') && !widgetStylePanels.includes('label="배경 직접 지정"') && !widgetStylePanels.includes('label="그림자 추가"') && !widgetStylePanels.includes('label="위아래 여백"') && !widgetStylePanels.includes('label="모서리"'), 'widget style panels must omit redundant shared surface controls');
assert(!widgetStylePanels.includes('label="제목 굵게"') && !widgetStylePanels.includes('label="제목 밑줄"') && !widgetStylePanels.includes('<ToggleRow label="굵게"') && !widgetStylePanels.includes('<ToggleRow label="밑줄"'), 'hero and text style panels must omit emphasis controls duplicated by rich text editing');
assert(widgetStylePanels.includes('label="직접 색상"') && widgetStylePanels.includes("buttonColorMode: value ? 'custom' : 'theme'"), 'bottom bar direct color mode must use one concise toggle');
assert(layoutBlocksSource.includes("s.sticky !== false ? 'topnav-sticky' : ''"), 'topnav renderer must match the editor default-on sticky contract');
assert(widgetStyleOptionsCss.includes('margin-top: var(--widget-margin') && widgetStyleOptionsCss.includes('margin-bottom: var(--widget-margin') && widgetStyleOptionsCss.includes('border-radius: var(--widget-radius'), 'legacy saved spacing and corner values must remain render-compatible');
assert(previewUtils.includes('widgetBoxClass(s = {}, { background = true, shadow = true } = {})') && previewUtils.includes('background && s.bgEnabled') && previewUtils.includes('shadow && s.shadowEnabled'), 'preview renderer must allow theme-owned widgets to opt out of stale shared surface values');
assert(['.landing-section.text.widget-bg-on', '.landing-section.links.widget-bg-on', '.landing-section.download-widget.widget-shadow-on'].every((selector) => widgetStyleOptionsCss.includes(selector)), 'legacy saved surface values must remain render-compatible');
assert(['.landing-section.hero.title-small h1', '.landing-section.hero.body-large p', '.landing-section.text.text-size-small h2', '.landing-section.text.text-size-large p'].every((selector) => widgetStyleOptionsCss.includes(selector)), 'hero and text typography size controls must reach final preview CSS');
assert(widgetStyleOptionsCss.includes('.landing-section.text.is-bold p') && widgetStyleOptionsCss.includes('.landing-section.text.is-underline p'), 'legacy text bold and underline values must remain render-compatible');
const cardsStylePanelSource = widgetStylePanels.slice(widgetStylePanels.indexOf('export function CardsStylePanel'), widgetStylePanels.indexOf('export function LinksStylePanel'));
assert(cardsStylePanelSource.includes("(s.layout || 'grid') === 'grid' && <SegmentedControl label=\"열 개수\""), 'card column control must only appear for the grid layout where it has an effect');
assert(!cardsStylePanelSource.includes("{ value: 'steps', label: '순서' }"), 'card editor must omit the duplicate steps layout while legacy renderer compatibility remains intact');
assert(widgetStyleOptionsCss.includes('.landing-section.links.align-center :is(.link-list-body, .link-card-body)') && widgetStyleOptionsCss.includes('.landing-section.links.align-right :is(.link-list-body, .link-card-body)'), 'link alignment control must affect list, card, and carousel item copy');
assert(previewDownloadCss.includes('.download-widget.download-list .download-item') && previewDownloadCss.includes('grid-template-columns: minmax(0, 1fr) auto'), 'download list style must render differently from the card style');
assert(widgetStyleOptionsCss.includes('.landing-section.download-widget.download-list.align-center .download-body') && widgetStyleOptionsCss.includes('.landing-section.download-widget.download-list.align-right .download-body'), 'download list alignment must affect item copy as well as the heading');
assert(widgetStylePanels.includes('<Color label="강조색"') && !widgetStylePanels.includes('<Color label="카드 배경"') && !widgetStylePanels.includes('<Color label="글자색"') && previewScheduleCss.includes('var(--schedule-accent)') && previewScheduleCss.includes('var(--schedule-card)') && previewScheduleCss.includes('var(--schedule-text)'), 'schedule editor must expose only the accent color while legacy saved card and text colors remain render-compatible');
const heroStylePanelSource = widgetStylePanels.slice(widgetStylePanels.indexOf('export function HeroStylePanel'), widgetStylePanels.indexOf('export function TextStylePanel'));
assert(!heroStylePanelSource.includes("value={s.height || 'medium'}"), 'hero style must not expose a height control overridden by the image height control');
const faqStylePanelSource = widgetStylePanels.slice(widgetStylePanels.indexOf('export function FaqStylePanel'), widgetStylePanels.indexOf('export function SearchStylePanel'));
assert(faqStylePanelSource.includes("value={s.layout || 'accordion'}"), 'FAQ style editor default must match the page model and renderer accordion default');
assert(!widgetStyleEditors.find((source) => source.includes('export default function TimerEditor'))?.includes('TimerFloatingCtaSection'), 'timer editor must not expose the unused floatOnBottom control');
assert(lazyEditorBoundary.includes('<Suspense fallback=') && lazyEditorBoundary.includes('data-lazy-editor-fallback="true"') && lazyEditorBoundary.includes('LAZY_EDITOR_FALLBACK_TEXT'), 'BlockEditor must keep a stable lazy editor loading fallback');
assert(lazyEditorBoundary.includes('role="alert"') && lazyEditorBoundary.includes('data-lazy-editor-error="true"') && lazyEditorBoundary.includes('LAZY_EDITOR_ERROR_TEXT'), 'BlockEditor must show a useful lazy editor failure state');
assert(lazyEditorBoundary.includes('componentDidUpdate(prevProps)') && /this\.setState\(\{\s*error:\s*null(?:,\s*recovering:\s*false)?\s*\}\)/.test(lazyEditorBoundary), 'BlockEditor lazy error boundary must reset when the selected block/type changes');
assert(appErrorBoundary.includes('className="error-screen error-screen-v2"'), 'AppErrorBoundary must keep the app recovery screen');
assert(appErrorBoundary.includes('recoverRootChunkLoad(error)') && appErrorBoundary.includes('clearBrowserRuntimeCaches().finally(replaceWithFreshRuntime)'), 'AppErrorBoundary must auto-recover once from stale deployment chunk failures');
assert(appErrorBoundary.includes('ROOT_CHUNK_RELOAD_LIMIT = 1') && appErrorBoundary.includes("url.searchParams.set('__fresh'"), 'AppErrorBoundary stale chunk recovery must be bounded and use a fresh URL');
assert(appErrorBoundary.includes('화면을 불러오는 중 오류가 발생했습니다.'), 'AppErrorBoundary must keep readable Korean error text');
assert(appErrorBoundary.includes('페이지 설정만 초기화') && appErrorBoundary.includes('전체 초기화'), 'AppErrorBoundary recovery actions must keep readable Korean labels');
assert(!/[�]|諛|獄|揆|\?ㅼ|\?섏|\?꾩|珥덇린/.test(appErrorBoundary), 'AppErrorBoundary must not contain mojibake recovery text');
assert(appErrorBoundary.includes('localStorage.removeItem(STORAGE_KEY); location.reload();'), 'AppErrorBoundary must keep page-only recovery action');
assert(appErrorBoundary.includes('localStorage.removeItem(LEADS_KEY)') && appErrorBoundary.includes('localStorage.removeItem(EVENTS_KEY)'), 'AppErrorBoundary must keep full recovery action');
assert(!/[�]|諛|獄|揆|덉빟|됰튋/.test(leadDuplicatePolicy), 'lead duplicate policy must not depend on mojibake reservation keywords');
assert(!/[�]|諛|獄|揆|덉빟|됰튋/.test(leadModel), 'lead model must not depend on mojibake reservation keywords');
assert(!/[�]|諛|獄|揆|덉빟|됰튋|\?좉|\?곷|\?꾩/.test(statsMetrics), 'stats metrics must not depend on mojibake labels or reservation keywords');
assert(leadDuplicatePolicy.includes('예약|방문|방문예약|reservation|booking|reserve'), 'lead duplicate policy must detect Korean and English reservation terms');
assert(leadDuplicatePolicy.includes('lead.kind') && leadDuplicatePolicy.includes('lead.category'), 'lead duplicate policy must classify reservation leads from kind/category fields');
assert(leadModel.includes("rawType.includes('방문') || rawType.includes('예약')"), 'lead model must detect readable Korean reservation type text');
assert(statsMetrics.includes("const typeData = { 상담: 0, 예약: 0 }") && statsMetrics.includes('예약|방문|방문예약|reservation|booking|reserve'), 'stats metrics must use readable lead type labels');
assert(statsMetrics.includes('lead.kind') && statsMetrics.includes('lead.category'), 'stats metrics must classify reservation leads from kind/category fields');
assert(landingRenderer.includes('class BlockErrorBoundary'), 'LandingRenderer must keep block-level error isolation');
assert(landingRenderer.includes('componentDidUpdate(prevProps)'), 'BlockErrorBoundary must reset when block data changes');
assert(utilityBlocks.includes("return typeof cleanup === 'function' ? cleanup : undefined;"), 'custom code cleanup must return only a function or undefined');
assert(builderFeedback.includes('role="dialog"') && builderFeedback.includes('aria-modal="true"'), 'modals must keep dialog semantics');
assert(builderFeedback.includes("event.key === 'Escape'") && builderFeedback.includes("querySelector?.('button"), 'modals must keep Escape close and initial focus behavior');
assert(builderFeedback.includes('aria-label="닫기"'), 'icon close buttons must keep accessible names');
assert(conflictUtils.includes("'PAGE_PUBLIC_VERIFY_FAILED'") && conflictUtils.includes("'PAGE_SLUG_CONFLICT'") && conflictUtils.includes("code === 'PAGE_REVISION_CONFLICT'"), 'Page conflict handling must not treat public verification or URL conflicts as revision conflicts');
assert(imageInputPreview.includes('aria-label={`${label} 수정`}') && imageInputPreview.includes('aria-label={`${label} 삭제`}') && imageInputPreview.includes('aria-label={`${label} 업로드`}'), 'image icon buttons must keep accessible names');
assert(colorControl.includes('aria-label={`${label} 색상 추출`}') && stylePanel.includes('aria-label={`${label} 색상 추출`}'), 'eyedropper icon buttons must keep accessible names');

assert(richField.includes('<textarea') && richField.includes('onChange={(event) => onChange(textToHtml(event.target.value))}'), 'RichField must use a simple textarea and save content edits immediately');
assert(!richField.includes('type="color"') && !richField.includes("document.execCommand('foreColor'"), 'RichField must not expose per-widget color formatting controls');
assert(previewUtils.includes('dangerouslySetInnerHTML') && previewUtils.includes('style="color:${color}"') && previewUtils.includes('<u>${inner}</u>') && previewUtils.includes('<strong>${inner}</strong>'), 'preview rich text renderer must preserve color, underline, and bold markup');
assert(stylePanel.includes('onPreviewThemeChange?.(draftTheme)') && app.includes('const [stylePreviewTheme, setStylePreviewTheme] = useState(null)'), 'StylePanel draft changes must keep live preview wiring');
assert(!stylePanel.includes('defaultStyleBlockId') && !stylePanel.includes('block.type') && stylePanel.includes('const [section, setSection] = useState('), 'StylePanel must stay a global style panel instead of auto-selecting fixed layout widgets');
assert(app.includes("if (nextTab === 'edit')") && app.includes("setOpenId('');") && app.includes('setAddOpen(false);'), 'Edit tab entry must collapse previously opened widget editors');
assert(stylePanel.includes('commonStyle') && stylePanel.includes('bg:') && stylePanel.includes('color:') && stylePanel.includes('text:'), 'StylePanel global style sections must stay available');
assert(stylePanel.includes('bgMode') && stylePanel.includes('bgImage') && stylePanel.includes('globalAlign') && stylePanel.includes('updateTheme(draftTheme)'), 'StylePanel must expose background, image, text alignment, and apply controls');
assert(googleSheetsSample.includes('ensureHeaders(sheet, Object.keys(fields))') && googleSheetsSample.includes('BASE_HEADERS.concat(customHeaders)'), 'Google Sheets sample code must create columns for actual form fields');
assert(!inboxPanel.includes('window.prompt(') && inboxPanel.includes('lead-copy-fallback'), 'Inbox lead copy fallback must stay inside the app instead of using browser prompts');
assert(inboxLeadHelpers.includes('function enforceFreeEmailIntegration') && inboxLeadHelpers.includes('lockedAccountEmail(authUser, page, normalized)') && inboxConnectionsPanel.includes('locked-email-value') && inboxConnectionsPanel.includes('email-recipient-control') && inboxConnectionsPanel.includes('lockedToAccount: true'), 'Free plan email alerts must render a non-editable account email in the Inbox UI');
assert(app.includes('normalizeFreeEmailIntegrations as normalizeFreeEmailIntegrationsForAccount') && app.includes('normalizeFreeEmailIntegrationsForAccount({') && pageIntegrationMutations.includes('sourceIntegrations?.email?.to') && pageIntegrationMutations.includes('lockedToAccount: true') && pageIntegrationMutations.includes('to: accountEmail'), 'App saves must enforce free plan email alert recipient from the account email');
assert(localServer.includes("lead.kind || lead.category") && localServer.includes('reservation|booking|reserve') && localServer.includes('email.reservation !== false'), 'Local server email delivery must classify reservation leads the same way as Pages Functions');
assert(leadDeliverySource.includes("lead.kind || lead.category") && leadDeliverySource.includes('reservation|booking|reserve') && leadDeliverySource.includes('email.reservation !== false'), 'Pages Functions email delivery must classify reservation leads from kind/category fields');
assert((app.includes('const pageForAccountSave = (sourcePage = null)') || pageSaveHelpers.includes('const pageForAccountSave = (sourcePage = null)')) && savePageIdentity.includes('const basePage = sourcePage || latestPage || currentPage') && savePageIdentity.includes('const normalized = normalizePageForSave(normalizeFreeEmailIntegrations(basePage))') && savePageIdentity.includes("const currentSlug = normalized.slug || defaultPage.slug || 'my-page'") && savePageIdentity.includes('const context = projectContext({ ...normalized, slug: currentSlug }, authUser)') && savePageIdentity.includes('slug: currentSlug') && savePageIdentity.includes('projectId: context.projectId') && savePageIdentity.includes('ownerId: context.ownerId') && !app.includes('const nextSlug = createUniquePageSlug(currentSlug, authUser)') && !pageSaveHelpers.includes('const nextSlug = createUniquePageSlug(currentSlug, authUser)') && !savePageIdentity.includes('const nextSlug = createUniquePageSlug(currentSlug, authUser)'), 'App saves must enforce free email locking while preserving the latest user-selected page URL');
assert(app.includes('const latestPageRef = useRef(page)') && (app.includes('const localPageMutationRef = useRef(0)') || accountWorkspacePage.includes('const loadMutation = localPageMutationRef.current')) && (app.includes('const loadMutation = localPageMutationRef.current') || accountWorkspacePage.includes('const loadMutation = localPageMutationRef.current')) && (app.includes('if (localPageMutationRef.current !== loadMutation) return;') || accountWorkspacePage.includes('if (localPageMutationRef.current !== loadMutation) return;')) && (app.includes('commitLocalPageDraft') || accountWorkspacePage.includes('commitLocalPageDraft')) && !app.includes('createUniquePageSlug(serverPage.slug || slug, authUser)') && !accountWorkspacePage.includes('createUniquePageSlug(serverPage.slug || slug, authUser)'), 'Account page load must ignore stale server responses without auto-changing user page URLs');
assert(localWorkspacePersistence.includes('if (isServerPageMode()) return;') && localWorkspacePersistence.includes('saveLocalJson(STORAGE_KEY, normalizePageForSave(page)') && app.includes('useLocalWorkspacePersistence({'), 'Server mode must not autosave every page state change to local storage');
assert(!app.includes('shouldAutoReplaceSlug') && !createPageUrlCheck.includes('shouldAutoReplaceSlug') && createPageUrlCheck.includes("return { ok: true, slug: safeSlug, message: '현재 페이지 주소를 그대로 사용합니다.' }"), 'URL checks must allow the current page URL and must not auto-replace template/default slugs');
assert(!pageSlugs.includes('randomSlugSuffix') && /export function createUniquePageSlug[\s\S]*?return sanitizePageSlug\(base \|\| authUser\?\.slug \|\| 'page', 'page'\)\.slice\(0, 48\);/.test(pageSlugs) && /export function shouldAutoReplaceSlug[\s\S]*?return false;/.test(pageSlugs), 'Page slug helpers must not generate random suffixes or auto-replace user-visible page URLs');
assert(settingsPanel.includes('onCheckUrl') && settingsDraftActions.includes('const currentBasic = createBasicDraft(page)') && settingsDraftActions.includes('const check = await onCheckUrl?.({ slug })') && settingsDraftActions.indexOf('const check = await onCheckUrl?.({ slug })') < settingsDraftActions.indexOf('updatePage({ title, slug: finalSlug })') && settingsDraftActions.includes("notify(check.message || '이미 사용 중인 페이지 주소입니다."), 'Settings page URL save must validate duplicate slugs before mutating local page state');
assert(/const persistStyleNow = async[\s\S]*?const basePage = latestPageRef\.current \|\| page;[\s\S]*?const styleSourcePage = await attachExistingPageIdentity[\s\S]*?theme:[\s\S]*?blocks:[\s\S]*?const nextPage = pageForAccountSave\(styleSourcePage\)/.test(persistStyleSaveAction), 'Style saves must use the latest account-safe page save preparation');
assert(/const saveNow = async[\s\S]*?const nextPage = pageForAccountSave\(saveSourcePage\);[\s\S]*?result = await persistPage\(nextPage, authUser, \{ tab, expectedUpdatedAt, saveMode: 'update-existing' \}\);[\s\S]*?const savedPage = commitSavedPageResult\([\s\S]*?result,[\s\S]*?nextPage,[\s\S]*?scope: 'page'/.test(pageSaveAction), 'App saveNow must update the visible page and local snapshot only after successful persistence');
assert(savePageIdentity.includes('export function savedPageFromResult(localPage, serverPage = null)') && savePageIdentity.includes('integrations: serverPage.integrations || localPage.integrations') && pagePersistFlow.includes('const persistedClientPage = result?.clientPage || nextPage') && pagePersistFlow.includes('savedPageFromResult(persistedClientPage, result.page)') && pageSaveAction.includes('commitSavedPageResult') && persistStyleSaveAction.includes('commitSavedPageResult'), 'App saves must merge server metadata onto the page just sent instead of replacing current widget edits with the response body');
assert(!pageModel.includes('s.bgEnabled = false;') && !pageModel.includes('s.padding = 14;') && !pageModel.includes('s.marginY = 12;') && !pageModel.includes('s.shadow = false;') && pageModel.includes('function clampNumber(value, min, max, fallback)') && pageModel.includes("s.spacingPreset = pickSafe(s.spacingPreset || 'normal'"), 'Widget normalization must preserve editable text/image/reservation style values across save');
assert(apiClientSource.includes('이미 사용 중인 페이지 주소입니다.') && apiClientSource.includes('현재 계정에 이 페이지 접근 권한이 없습니다.') && apiClientSource.includes('요청 실패'), 'API client must keep readable Korean user-facing error messages');
assert(!/[�]|諛|獄|揆|濡쒓렇|沅뚰븳|\?꾩|\?섏|\?붿|\?대\?/.test(apiClientSource), 'API client user-facing errors must not contain mojibake text');
assert(pageSaveOptimizer.includes('D1_PAGE_JSON_SAFE_BYTES') && pageSaveOptimizer.includes('optimizePageForServerSave') && pageRepository.includes('clientPage: pageWithContext'), 'Oversized embedded images must be optimized before D1 page saves and committed back to the editor state');
assert(pageRepository.includes('verifyPublicPageSave') && pageRepository.includes('PAGE_PUBLIC_VERIFY_FAILED') && pageRepository.includes('options.verifyPublic !== false') && pageRepository.includes('publicPageRenderFingerprint'), 'Page saves must verify the public landing route and render fingerprint after server save');
assert(pageRepository.includes("cache: 'no-store'") && pageRepository.includes("'Cache-Control': 'no-cache, no-store'") && pageRepository.includes("Pragma: 'no-cache'"), 'Page repository must bypass browser cache when loading or verifying saved public pages');
assert(pageRepository.includes('for (let attempt = 0; attempt < 3; attempt += 1)') && pageRepository.includes('await sleep(250 * (attempt + 1))'), 'Page public verification must retry briefly before reporting a save mismatch');
assert(pageRepository.includes('const pageWithContext = normalizePageForSave({') && pageRepository.includes('projectId: context.projectId') && pageRepository.includes('ownerId: context.ownerId') && pageRepository.includes('page: pageWithContext') && pageRepository.includes('accountOwnedPageForRetry(pageWithContext, authUser)'), 'Page repository must persist the same project/owner context that it uses for authorization');
assert(localServer.includes("sendJson(res, 200, { ok: true, page }, { 'Cache-Control': 'no-store' })") && localServer.includes('function sendJson(res, status, payload, headers = {})'), 'Local public page API must return no-store headers like Pages Functions');
assert(pageModel.includes("provider: 'google_sheets'") && pageModel.includes("mode: 'webhook'") && pageModel.includes('spreadsheetId') && pageModel.includes('connectedEmail'), 'Google Sheets settings must keep OAuth-ready metadata without changing the webhook MVP');
assert(leadIntegrations.includes("integration: {") && leadIntegrations.includes("provider: 'google_sheets'") && leadIntegrations.includes('spreadsheetId: sheets.spreadsheetId') && leadIntegrations.includes('connectedEmail: sheets.connectedEmail'), 'Google Sheets payload must keep provider/mode/account metadata for future OAuth expansion');
assert(inboxConnectionsPanel.includes('advancedOpen') && inboxConnectionsPanel.includes('connection-advanced-toggle') && inboxConnectionsPanel.includes('연동 전체 저장'), 'Inbox integrations should keep webhook inside an advanced section and label full save clearly');
assert(settingsSection.includes('const stateLabel = open ?') && settingsSection.includes('settings-section-state') && settingsSection.includes('aria-hidden="true"') && settingsSection.includes('{stateLabel}</span>'), 'Settings sections must render explicit open/close action labels');
assert(settingsAdvancedGroup.includes('aria-label={`') && settingsAdvancedGroup.includes('advancedOpen ?') && settingsAdvancedGroup.includes('<em aria-hidden="true">{advancedOpen ?'), 'Settings advanced section must render explicit open/close action labels');
assert(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*58px\s*!important/.test(settingsPanelCss), 'Settings section headers must reserve readable action label space');
assert(/\.settings-panel \.settings-section-state,[\s\S]*?width:\s*64px\s*!important[\s\S]*?writing-mode:\s*horizontal-tb\s*!important/.test(settingsPanelCss), 'Settings action controls must stay horizontal and unclipped');
assert(/\.settings-panel \.settings-grid,[\s\S]*?\.settings-panel \.account-settings-grid[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important/.test(settingsPanelCss), 'Settings forms must keep two-column desktop layout');
assert(/\.settings-panel \.settings-section-title-row[\s\S]*?background:\s*transparent\s*!important[\s\S]*?box-shadow:\s*none\s*!important/.test(settingsPanelCss), 'Settings section titles must stay flat without nested pill styling');

const stats = await Promise.all(sourceFiles.map((file) => stat(file)));
const totalSourceBytes = stats.reduce((sum, item) => sum + item.size, 0);

console.log(JSON.stringify({
  ok: true,
  filesChecked: sources.size,
  sourceBytes: totalSourceBytes,
  checks: sources.size * 3 + 52,
}, null, 2));
