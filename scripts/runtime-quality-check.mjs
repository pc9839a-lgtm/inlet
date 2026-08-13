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
const scheduleBasicSection = await readFile('src/editor/blockEditors/ScheduleBasicSection.jsx', 'utf8');
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
const bottomBarBasicSection = await readFile('src/editor/blockEditors/BottomBarBasicSection.jsx', 'utf8');
const shareOptionsCard = await readFile('src/editor/editPanelParts/ShareOptionsCard.jsx', 'utf8');
const bottomShareCss = await readFile('src/styles/preview-bottom-share.css', 'utf8');
const leadDuplicatePolicy = await readFile('src/lib/leadDuplicatePolicy.js', 'utf8');
const leadModel = await readFile('src/lib/leadModel.js', 'utf8');
const statsMetrics = await readFile('src/lib/statsMetrics.js', 'utf8');
const utilityBlocks = await readFile('src/preview/renderers/UtilityBlocks.jsx', 'utf8');
const infoBlocks = await readFile('src/preview/renderers/InfoBlocks.jsx', 'utf8');
const searchBasicSection = await readFile('src/editor/blockEditors/SearchBasicSection.jsx', 'utf8');
const formSuccessSettings = await readFile('src/editor/blockEditors/FormSuccessSettings.jsx', 'utf8');
const reservationBasicSection = await readFile('src/editor/blockEditors/ReservationBasicSection.jsx', 'utf8');
const contentBlocks = await readFile('src/preview/renderers/ContentBlocks.jsx', 'utf8');
const signalBlocks = await readFile('src/preview/renderers/SignalBlocks.jsx', 'utf8');
const faqEditorModel = await readFile('src/editor/blockEditors/faqEditorModel.js', 'utf8');
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
const accountProjectAccess = await readFile('src/lib/accountProjectAccess.js', 'utf8');
const dashboardScreen = await readFile('src/screens/DashboardScreen.jsx', 'utf8');
const projectsApi = await readFile('functions/api/projects.js', 'utf8');
const pageApi = await readFile('functions/api/pages/[slug].js', 'utf8');
const pageSaveOptimizer = await readFile('src/lib/pageSaveOptimizer.js', 'utf8');
const d1Adapter = await readFile('server/storage/d1Adapter.mjs', 'utf8');
const adminSummary = await readFile('functions/api/admin/summary.js', 'utf8');
const pageSlugs = await readFile('src/lib/pageSlugs.js', 'utf8');
const leadIntegrations = await readFile('src/lib/leadIntegrations.js', 'utf8');
const apiClientSource = await readFile('src/lib/apiClient.js', 'utf8');
const settingsPanel = await readFile('src/panels/SettingsPanel.jsx', 'utf8');
const settingsPanelCss = await readFile('src/styles/panels-settings.css', 'utf8');
const baseCss = await readFile('src/styles/base.css', 'utf8');
const runtimeConfigSource = await readFile('src/config/runtimeConfig.js', 'utf8');
const previewFormBlocks = await readFile('src/preview/renderers/FormBlocks.jsx', 'utf8');
const publicEmbedForm = await readFile('public/embed/form.js', 'utf8');
const formEmbedSource = await readFile('src/lib/formEmbed.js', 'utf8');
const localServer = await readFile('server/index.mjs', 'utf8');
const settingsBody = await readFile('src/panels/settings/SettingsPanelBody.jsx', 'utf8');
const publicHomeRoute = await readFile('src/screens/PublicHomeRoute.jsx', 'utf8');
const workspaceEditorScreen = await readFile('src/screens/WorkspaceEditorScreen.jsx', 'utf8');
const workspaceShellActions = await readFile('src/runtime/useWorkspaceShellActions.js', 'utf8');
const workspaceTabsSource = await readFile('src/screens/workspace/WorkspaceTabs.jsx', 'utf8');
const inboxLeadHelpers = await readFile('src/panels/inbox/inboxLeadHelpers.js', 'utf8');
const inboxConnectionsPanel = await readFile('src/panels/inbox/InboxConnectionsPanel.jsx', 'utf8');
const fixedBlockRenderers = await readFile('src/editor/fixedBlockRenderers.jsx', 'utf8');
const lazyRuntimeBoundary = await readFile('src/runtime/LazyRuntimeBoundary.jsx', 'utf8');

const cssFiles = (await walk('src/styles')).filter((file) => file.endsWith('.css'));
const cssSources = new Map(await Promise.all(cssFiles.map(readSource)));
const cssAll = [...cssSources.values()].join('\n');

const files = [...sources.keys()];
assert(files.length > 0, 'runtime source scan must not be empty');
assert(cssFiles.length > 0, 'runtime CSS scan must not be empty');

const sourceText = [...sources.values()].join('\n');
assert(!/\bwindow\.__INLET_[A-Z0-9_]*KEY\b/.test(sourceText), 'runtime must not expose secrets on window globals');
assert(!/\bVITE_[A-Z0-9_]*(?:SECRET|PASSWORD|TOKEN|PRIVATE_KEY)\b/.test(sourceText), 'browser source must not embed secret-like VITE variables');

// Application root and recovery contracts.
assert(main.includes('<AppErrorBoundary>') && main.includes('</AppErrorBoundary>'), 'main must keep the root AppErrorBoundary');
assert(app.includes('CHUNK_RELOAD_LIMIT = 1') && app.includes("url.searchParams.set('__fresh'"), 'lazy panel recovery must remain bounded and refresh the runtime URL');

// Authentication and account routing contracts.
assert(homeScreens.includes('loginAuthAccount') && homeScreens.includes('registerAuthAccount'), 'auth screens must use account-backed login and signup');
assert(homeScreens.includes('requestEmailVerification') && homeScreens.includes('confirmEmailVerification'), 'auth screens must preserve email verification');
assert(authContext.includes('canUseBuilderSurface') && authContext.includes('canWriteTab'), 'auth context must preserve builder/write capability gates');

// Public / editor access and account-page contracts.
assert(accountProjectAccess.includes('rememberAccountProjectAccess') && accountProjectAccess.includes('hasAccountProjectAccess'), 'account page editor access must retain explicit remembered access');
assert(dashboardScreen.includes('fetchSelectedAccountPage') && dashboardScreen.includes('rememberAccountProjectAccess') && dashboardScreen.includes('window.location.assign(`/app?${params.toString()}`)'), 'dashboard page open must load an authenticated account page before entering the editor');
assert(projectsApi.includes('listPagesForOwner') && projectsApi.includes('isPlatformMasterIdentity'), 'project listing must stay owner scoped with an explicit platform-master exception');
assert(pageApi.includes('hasAccountProjectAccess') || pageApi.includes('loadPageBySlug'), 'page API must retain guarded or scoped page loading');

// Server storage and save contracts.
assert(pageSaveOptimizer.includes('normalizePageForSave') && pageSaveOptimizer.includes('cloneDeep'), 'page save optimizer must normalize and clone before persistence');
assert(d1Adapter.includes('INSERT') && d1Adapter.includes('UPDATE') && d1Adapter.includes('DELETE'), 'D1 adapter must keep persistence mutations');
assert(apiClientSource.includes("'X-Inlet-Session'") || apiClientSource.includes('X-Inlet-Session'), 'API client must support authenticated session headers');

// Settings source of truth remains the consolidated settings stylesheet.
assert(settingsPanelCss.includes('.settings-panel') && settingsPanelCss.includes('.settings-row'), 'consolidated settings stylesheet must own core settings structure');
assert(!cssAll.includes('SettingsPanel.css'), 'deleted legacy SettingsPanel.css must not be reintroduced through imports');

// Workspace layout contract.
const editorWorkspaceCss = await readFile('src/styles/editor-workspace-v2.css', 'utf8');
assert(editorWorkspaceCss.includes('height: 100dvh') && editorWorkspaceCss.includes('overflow: hidden') && editorWorkspaceCss.includes('.work-panel') && editorWorkspaceCss.includes('overflow-y: auto'), 'desktop workspace must own the viewport and keep panel content scrollable');
assert(editorWorkspaceCss.includes('~ .wayzi-global-footer') && editorWorkspaceCss.includes('display: none'), 'desktop editor must not stack the global footer below the viewport');
assert(editorWorkspaceCss.includes('@media (max-width: 899px)') && editorWorkspaceCss.includes('mobile-operations-shell') && editorWorkspaceCss.includes('overflow: visible'), 'mobile operations mode must restore natural document flow');

// Existing runtime UI behavior checks.
assert(settingsBody.includes('SettingsAccountSection') && settingsBody.includes('SettingsDomainSection'), 'settings body must keep account and domain sections');
assert(publicHomeRoute.includes('PublicHomeRoute') && landingRenderer.includes('LandingRenderer'), 'public route must retain the landing renderer');
assert(workspaceEditorScreen.includes('WorkspaceLeftPanel') && workspaceEditorScreen.includes('WorkspacePreviewPane'), 'workspace editor must retain panel and preview surfaces');
assert(workspaceTabsSource.includes("['edit', '편집']") && workspaceTabsSource.includes("['inbox', '접수함']"), 'workspace tabs must retain edit and inbox navigation');

assert(previewFormBlocks.includes('status === 409') && previewFormBlocks.includes('status === 429'), 'form submission must distinguish duplicate and rate-limit responses');
assert(inboxPanel.includes('InboxPanel') && inboxPanel.includes('inbox-panel'), 'inbox panel must retain the operational inbox surface');
assert(inboxLeadHelpers.includes('normalize') || inboxLeadHelpers.includes('lead'), 'inbox lead helpers must retain lead normalization logic');
assert(inboxConnectionsPanel.includes('계정 이메일') || inboxConnectionsPanel.includes('email'), 'inbox connection settings must retain email delivery controls');

assert(fixedBlockRenderers.includes('renderLazyEditor') && lazyRuntimeBoundary.includes('LazyEditorBoundary'), 'fixed block editors must keep lazy editor recovery isolation');
assert(blockEditor.includes('LazyEditorBoundary') && lazyEditorBoundary.includes('LazyEditorErrorBoundary'), 'block editors must keep lazy chunk failure isolation');

assert(appErrorBoundary.includes('className="error-screen error-screen-v2"'), 'AppErrorBoundary must keep the app recovery screen');
assert(appErrorBoundary.includes('recoverRootChunkLoad(error)') && appErrorBoundary.includes('clearBrowserRuntimeCaches().finally(replaceWithFreshRuntime)'), 'AppErrorBoundary must auto-recover from stale deployment chunk failures');
assert(appErrorBoundary.includes('ROOT_CHUNK_RELOAD_LIMIT = 3') && appErrorBoundary.includes('ROOT_CHUNK_RELOAD_WINDOW_MS = 45000') && appErrorBoundary.includes('chunkErrorFingerprint(error)') && appErrorBoundary.includes("url.searchParams.set('__runtimefix'"), 'AppErrorBoundary stale chunk recovery must remain fingerprinted, time-window bounded, attempt bounded, and use a fresh runtime URL');
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

assert(richField.includes('<textarea') && richField.includes("querySelectorAll('br')") && richField.includes("replaceWith('\\n')") && richField.includes('onChange={(event) => onChange(textToHtml(event.target.value))}'), 'RichField must preserve textarea line breaks and save content edits immediately');
assert(!richField.includes('type="color"') && !richField.includes("document.execCommand('foreColor'"), 'RichField must not expose per-widget color formatting controls');
assert(previewUtils.includes('dangerouslySetInnerHTML') && previewUtils.includes('style="color:${color}"') && previewUtils.includes('<u>${inner}</u>') && previewUtils.includes('<strong>${inner}</strong>'), 'preview rich text renderer must preserve color, underline, and bold markup');
assert(stylePanel.includes('onPreviewThemeChange?.(draftTheme)') && app.includes('const [stylePreviewTheme, setStylePreviewTheme] = useState(null)'), 'StylePanel draft changes must keep live preview wiring');
assert(app.includes('setStylePreviewTheme(null)') && app.includes('stylePreviewTheme ? { ...page, theme: stylePreviewTheme } : page'), 'StylePanel live preview must reset and feed previewPage');

const inboxClassTokens = [...inboxPanel.matchAll(/className=["'`]([^"'`]+)["'`]/g)].flatMap((match) => match[1].split(/\s+/)).filter(Boolean);
assert(inboxClassTokens.some((token) => token.includes('inbox')), 'inbox panel must retain inbox class hooks');

const jsStats = await Promise.all([...sourceFiles].map(async (file) => ({ file, size: (await stat(file)).size })));
const cssStats = await Promise.all(cssFiles.map(async (file) => ({ file, size: (await stat(file)).size })));
const largeJs = jsStats.filter((item) => item.size > 160000).map((item) => item.file);
const largeCss = cssStats.filter((item) => item.size > 160000).map((item) => item.file);
assert(largeJs.length <= 8, `too many oversized runtime JS modules: ${largeJs.join(', ')}`);
assert(largeCss.length <= 8, `too many oversized runtime CSS modules: ${largeCss.join(', ')}`);

console.log(JSON.stringify({
  ok: true,
  check: 'runtime-quality',
  sources: sourceFiles.length,
  scripts: scriptFiles.length,
  css: cssFiles.length,
  appErrorRecovery: 'fingerprinted-windowed-bounded',
  workspaceViewportOwned: true,
  largeJs,
  largeCss,
}, null, 2));
