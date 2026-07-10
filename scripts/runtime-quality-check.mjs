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
const pageSaveActions = await readFile('src/runtime/usePageSaveActions.js', 'utf8');
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

assert(main.includes('root.render(<AppErrorBoundary><MapEmbedApp /></AppErrorBoundary>)'), 'embed root render must stay wrapped in AppErrorBoundary');
assert(main.includes('root.render(<AppErrorBoundary><PublicHomeEntry /></AppErrorBoundary>)'), 'public home root render must stay wrapped in AppErrorBoundary');
assert(main.includes('<AppErrorBoundary>') && main.includes('<Suspense fallback={null}>') && main.includes('<App />'), 'app root render must stay wrapped in AppErrorBoundary');
assert(app.includes("const InboxPanel = lazy(() => import('./panels/InboxPanel.jsx'))"), 'InboxPanel must stay lazy-loaded');
assert(app.includes("const StatsPanel = lazy(() => import('./panels/StatsPanel.jsx'))"), 'StatsPanel must stay lazy-loaded');
assert(app.includes("const SettingsPanel = lazy(() => import('./panels/SettingsPanel.jsx'))"), 'SettingsPanel must stay lazy-loaded');
assert(app.includes("const AdminPanel = lazy(() => import('./panels/AdminPanel.jsx'))") || app.includes("const AdminPanel = lazy(() => import('./panels/MasterAdminPanel.jsx'))"), 'AdminPanel must stay lazy-loaded');
assert(app.includes("const TemplatesPanel = lazy(() => import('./panels/TemplatesPanel'))"), 'TemplatesPanel must stay lazy-loaded');
assert(app.includes("await import('./templates/landingTemplates')") || app.includes("await import('./templates/landingTemplates.js')") || landingTemplatesHook.includes("await import('../templates/landingTemplates.js')"), 'landing templates must stay dynamically imported');
assert(!/import\s+\{?\s*LANDING_TEMPLATES\b/.test(app), 'landing templates must not be statically imported');
assert(app.includes('const authForTargetPage = (targetPage = {})') && app.includes('publicLandingSlug && targetPage?.projectId ? null : authUser'), 'public landing lead/event writes must not use the signed-in builder project context');
assert(app.includes('persistEvent(event, targetPage, authForTargetPage(targetPage))'), 'public landing event writes should use the target page project context');
assert(app.includes('const targetAuthUser = authForTargetPage(targetPage)') && app.includes('persistLead(savedLead, targetPage, targetAuthUser)'), 'public landing lead writes should use the target page project context');
assert(/<PreviewRenderer[\s\S]*?page=\{publicPage\}[\s\S]*?addLead=\{\(lead\) => addLeadForPage\(publicPage, lead\)\}[\s\S]*?track=\{\(event\) => trackForPage\(publicPage, event\)\}/.test(app), 'public landing renderer must submit leads and stats events against the public page context');
assert(!/import\s+(?:InboxPanel|StatsPanel|StylePanel|SettingsPanel|TemplatesPanel|AdminPanel|AiPanel)\b/.test(app), 'heavy panels and AI panel must not be statically imported into App');
assert(!/import\s+(?:\{[^}]*Editor[^}]*\}|[A-Z][A-Za-z]+Editor)\s+from\s+['"]\.\/editor\/blockEditors\//.test(app), 'block editors must not be statically imported into App');
assert(lazyRuntimeBoundary.includes('function LazyEditorFallback()') && lazyRuntimeBoundary.includes('class LazyEditorBoundary extends Component'), 'fixed block editor controls must keep lazy fallback and error boundary');
assert(lazyRuntimeBoundary.includes('componentDidUpdate(prevProps)') && lazyRuntimeBoundary.includes('this.setState({ error: null })'), 'lazy editor boundaries must reset after selection changes');
assert(fixedBlockRenderers.includes('renderLazyEditor') && fixedBlockRenderers.includes('createFixedBlockRenderers'), 'fixed block editor renderers must stay split from App');
assert(blockEditorRegistry.includes('export const BLOCK_EDITORS'), 'block editor registry must stay split from App');
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
assert(app.includes('isOwnerAdminModeEnabled') && app.includes('clientAdminEnabled: ownerAdminModeEnabled'), 'App must derive client admin access from the internal runtime flag');
assert(workspaceActivePanel.includes("canUseBuilder && tab === 'edit'") && workspaceActivePanel.includes("canUseBuilder && tab === 'style'"), 'builder-only editor and style tabs must stay permission gated');
assert(workspaceTabs.includes('NAV.filter(([key]) => allowedTabs.includes(key))'), 'navigation must render only allowed tabs');
assert(workspaceTabLocation.includes('export function tabFromLocation') && workspaceTabLocation.includes('export function hasTabDeepLink') && workspaceTabLocation.includes("new URLSearchParams(location.search).get('tab')") && workspaceTabLocation.includes('export function replaceLocationTab'), 'workspace tab query helpers must stay split from App for authenticated visual QA and operator URLs');
assert(app.includes('tabFromLocation(TAB_KEYS') && app.includes('hasTabDeepLink(TAB_KEYS)') && app.includes('replaceLocationTab(TAB_KEYS,'), 'App must use shared workspace tab location helpers');
assert(workspaceStartMode.includes('export function shouldShowStartModeOverlay') && workspaceStartMode.includes('canManageAdmin && !startMode && !tabDeepLink'), 'tab deep links must bypass the start mode overlay through the shared helper');
assert(app.includes('const showStartModeOverlay = shouldShowStartModeOverlay({ canManageAdmin, startMode, tabDeepLink })') && app.includes('{showStartModeOverlay && (') && app.includes('<StartModeOverlay'), 'App must delegate start mode overlay visibility to the shared helper');
assert(workspaceStartMode.includes('canManageAdmin && !startMode') && workspaceLeftPanel.includes("canManageAdmin && startMode === 'template'"), 'template/start controls must stay master-admin-only');
assert(app.includes('adminRoute') && app.includes("return /^\\/(?:admin|[^/?#]+\\/admin)\\/?$/.test(routePath)") && app.includes('<AdminPanel'), 'admin panel must stay on a private /admin route');
assert(app.includes('const canWriteTabKey = (key) => canWriteTab(accessMode, page, authUser, key)') && app.includes('createBlockWriteGuard({'), 'App must enforce manager write permissions before mutation');
assert(blockWriteGuard.includes('canWriteTabKey(targetTab)') && blockWriteGuard.includes('markSaveStatus') && blockWriteGuard.includes('showToast'), 'block write permission feedback must stay centralized');
assert(pageDraftMutations.includes('latestPageRef.current = normalized') && pageDraftMutations.includes('markLocalPageMutation()'), 'local page draft commits must update latest page and mutation refs centrally');
assert(pageEditMutations.includes('export function createPageEditMutations') && pageEditMutations.includes('updateTheme') && pageEditMutations.includes('updateIntegrations'), 'page edit mutation actions must stay centralized');
assert(pageIntegrationMutations.includes('lockedToAccount: true') && pageIntegrationMutations.includes('authUser?.email'), 'free email integration normalization must stay centralized');
assert(app.includes("selectedBlockId={canUseBuilder ? openId : ''}") && app.includes('onSelectPreviewBlock={canUseBuilder ? selectPreviewBlock : undefined}') && workspacePreviewPane.includes('selectedBlockId={selectedBlockId}') && workspacePreviewPane.includes('onSelectBlock={onSelectPreviewBlock}'), 'client admin preview must not route into block editing');
assert(workspaceTabFallback.includes('if (!authUser) return;') && workspaceTabFallback.includes('if (!routeUsesWorkspaceTabs) return;') && workspaceTabFallback.includes("const nextTab = allowedTabs[0] || 'inbox'") && workspaceTabFallback.includes('replaceLocationTab(tabKeys, nextTab)'), 'workspace tab redirect must not run before login or on public routes');
assert(app.includes('useWorkspaceTabFallback({') && app.includes('tabKeys: TAB_KEYS'), 'App must delegate workspace tab fallback routing to the shared hook');
assert(workspaceAutoOpen.includes('if (!authUser || canUseBuilder || workspaceOpen) return;') && workspaceAutoOpen.includes('persistOpenState(true)') && workspaceAutoOpen.includes('setWorkspaceOpen(true)'), 'workspace auto-open must remain limited to authenticated non-builder workspace sessions');
assert(app.includes('useWorkspaceAutoOpen({') && app.includes('persistOpenState: (open) => saveLocalJson(DASHBOARD_KEY, { open }'), 'App must delegate workspace auto-open state to the shared hook');
assert(pendingStyleBeforeUnload.includes('if (!hasPendingStyle) return undefined;') && pendingStyleBeforeUnload.includes("window.addEventListener('beforeunload', handleBeforeUnload)") && pendingStyleBeforeUnload.includes("window.removeEventListener('beforeunload', handleBeforeUnload)"), 'pending style beforeunload guard must stay isolated from App');
assert(app.includes('usePendingStyleBeforeUnload(hasPendingStyle)'), 'App must delegate pending style beforeunload handling to the shared hook');
assert(['useProtectedWorkspaceRedirect({ authUser, protectedWorkspacePath })', 'useWorkspaceAutoOpen({', 'useWorkspaceTabFallback({', 'usePendingStyleBeforeUnload(hasPendingStyle)'].every((needle) => app.includes(needle)), 'workspace session effects must stay delegated out of App');
assert(app.includes('if (mobileBlocked && authUser && workspaceOpen)') && app.includes('모바일에서는 회원가입, 로그인, 미리보기와 접수 확인을 사용할 수 있습니다.'), 'mobile block screen must only hide the authenticated editor workspace');
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
assert(lazyEditorBoundary.includes('<Suspense fallback=') && lazyEditorBoundary.includes('data-lazy-editor-fallback="true"') && lazyEditorBoundary.includes('LAZY_EDITOR_FALLBACK_TEXT'), 'BlockEditor must keep a stable lazy editor loading fallback');
assert(lazyEditorBoundary.includes('role="alert"') && lazyEditorBoundary.includes('data-lazy-editor-error="true"') && lazyEditorBoundary.includes('LAZY_EDITOR_ERROR_TEXT'), 'BlockEditor must show a useful lazy editor failure state');
assert(lazyEditorBoundary.includes('componentDidUpdate(prevProps)') && lazyEditorBoundary.includes('this.setState({ error: null })'), 'BlockEditor lazy error boundary must reset when the selected block/type changes');
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
assert((app.includes('const normalizeFreeEmailIntegrations') || pageSaveActions.includes('export function normalizeFreeEmailIntegrations')) && (app.includes('sourceIntegrations?.email?.to') || pageSaveActions.includes('sourceIntegrations?.email?.to')) && (app.includes('lockedToAccount: true') || pageSaveActions.includes('lockedToAccount: true')) && (app.includes('to: accountEmail') || pageSaveActions.includes('to: accountEmail')), 'App saves must enforce free plan email alert recipient from the account email');
assert(localServer.includes("lead.kind || lead.category") && localServer.includes('reservation|booking|reserve') && localServer.includes('email.reservation !== false'), 'Local server email delivery must classify reservation leads the same way as Pages Functions');
assert(leadDeliverySource.includes("lead.kind || lead.category") && leadDeliverySource.includes('reservation|booking|reserve') && leadDeliverySource.includes('email.reservation !== false'), 'Pages Functions email delivery must classify reservation leads from kind/category fields');
assert((app.includes('const pageForAccountSave = (sourcePage = null)') || pageSaveHelpers.includes('const pageForAccountSave = (sourcePage = null)')) && savePageIdentity.includes('const basePage = sourcePage || latestPage || currentPage') && savePageIdentity.includes('const normalized = normalizePageForSave(normalizeFreeEmailIntegrations(basePage))') && savePageIdentity.includes("const currentSlug = normalized.slug || defaultPage.slug || 'my-page'") && savePageIdentity.includes('const context = projectContext({ ...normalized, slug: currentSlug }, authUser)') && savePageIdentity.includes('slug: currentSlug') && savePageIdentity.includes('projectId: context.projectId') && savePageIdentity.includes('ownerId: context.ownerId') && !app.includes('const nextSlug = createUniquePageSlug(currentSlug, authUser)') && !pageSaveHelpers.includes('const nextSlug = createUniquePageSlug(currentSlug, authUser)') && !savePageIdentity.includes('const nextSlug = createUniquePageSlug(currentSlug, authUser)'), 'App saves must enforce free email locking while preserving the latest user-selected page URL');
assert(app.includes('const latestPageRef = useRef(page)') && (app.includes('const localPageMutationRef = useRef(0)') || accountWorkspacePage.includes('const loadMutation = localPageMutationRef.current')) && (app.includes('const loadMutation = localPageMutationRef.current') || accountWorkspacePage.includes('const loadMutation = localPageMutationRef.current')) && (app.includes('if (localPageMutationRef.current !== loadMutation) return;') || accountWorkspacePage.includes('if (localPageMutationRef.current !== loadMutation) return;')) && (app.includes('commitLocalPageDraft') || accountWorkspacePage.includes('commitLocalPageDraft')) && !app.includes('createUniquePageSlug(serverPage.slug || slug, authUser)') && !accountWorkspacePage.includes('createUniquePageSlug(serverPage.slug || slug, authUser)'), 'Account page load must ignore stale server responses without auto-changing user page URLs');
assert(/useEffect\(\(\) => \{\s*if \(publicLandingSlug\) return;\s*if \(isServerPageMode\(\)\) return;\s*saveLocalJson\(STORAGE_KEY, normalizePageForSave\(page\), '페이지'\);/.test(app), 'Server mode must not autosave every page state change to local storage');
assert(!app.includes('shouldAutoReplaceSlug') && !createPageUrlCheck.includes('shouldAutoReplaceSlug') && createPageUrlCheck.includes("return { ok: true, slug: safeSlug, message: '현재 페이지 주소를 그대로 사용합니다.' }"), 'URL checks must allow the current page URL and must not auto-replace template/default slugs');
assert(!pageSlugs.includes('randomSlugSuffix') && /export function createUniquePageSlug[\s\S]*?return sanitizePageSlug\(base \|\| authUser\?\.slug \|\| 'page', 'page'\)\.slice\(0, 48\);/.test(pageSlugs) && /export function shouldAutoReplaceSlug[\s\S]*?return false;/.test(pageSlugs), 'Page slug helpers must not generate random suffixes or auto-replace user-visible page URLs');
assert(settingsPanel.includes('onCheckUrl') && settingsDraftActions.includes('const currentBasic = createBasicDraft(page)') && settingsDraftActions.includes('const check = await onCheckUrl?.({ slug })') && settingsDraftActions.indexOf('const check = await onCheckUrl?.({ slug })') < settingsDraftActions.indexOf('updatePage({ title, slug: finalSlug })') && settingsDraftActions.includes("notify(check.message || '이미 사용 중인 페이지 주소입니다."), 'Settings page URL save must validate duplicate slugs before mutating local page state');
assert(/const persistStyleNow = async[\s\S]*?const basePage = latestPageRef\.current \|\| page;[\s\S]*?const styleSourcePage = await attachExistingPageIdentity[\s\S]*?theme:[\s\S]*?blocks:[\s\S]*?const nextPage = pageForAccountSave\(styleSourcePage\)/.test(persistStyleSaveAction), 'Style saves must use the latest account-safe page save preparation');
assert(/const saveNow = async[\s\S]*?const nextPage = pageForAccountSave\(saveSourcePage\);[\s\S]*?result = await persistPage\(nextPage, authUser, \{ tab, expectedUpdatedAt, saveMode: 'update-existing' \}\);[\s\S]*?const savedPage = commitSavedPageResult\([\s\S]*?result,[\s\S]*?nextPage,[\s\S]*?scope: 'page'/.test(pageSaveAction), 'App saveNow must update the visible page and local snapshot only after successful persistence');
assert(savePageIdentity.includes('export function savedPageFromResult(localPage, serverPage = null)') && savePageIdentity.includes('integrations: serverPage.integrations || localPage.integrations') && pagePersistFlow.includes('const savedPage = result?.page ? savedPageFromResult(nextPage, result.page) : nextPage') && pageSaveAction.includes('commitSavedPageResult') && persistStyleSaveAction.includes('commitSavedPageResult'), 'App saves must merge server metadata onto the page just sent instead of replacing current widget edits with the response body');
assert(!pageModel.includes('s.bgEnabled = false;') && !pageModel.includes('s.padding = 14;') && !pageModel.includes('s.marginY = 12;') && !pageModel.includes('s.shadow = false;') && pageModel.includes('function clampNumber(value, min, max, fallback)') && pageModel.includes("s.spacingPreset = pickSafe(s.spacingPreset || 'normal'"), 'Widget normalization must preserve editable text/image/reservation style values across save');
assert(apiClientSource.includes('이미 사용 중인 페이지 주소입니다.') && apiClientSource.includes('현재 계정에 이 페이지 접근 권한이 없습니다.') && apiClientSource.includes('요청 실패'), 'API client must keep readable Korean user-facing error messages');
assert(!/[�]|諛|獄|揆|濡쒓렇|沅뚰븳|\?꾩|\?섏|\?붿|\?대\?/.test(apiClientSource), 'API client user-facing errors must not contain mojibake text');
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
  checks: sources.size * 3 + 40,
}, null, 2));
