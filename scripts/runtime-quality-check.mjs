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
const landingRenderer = await readFile('src/preview/LandingRenderer.jsx', 'utf8');
const leadDuplicatePolicy = await readFile('src/lib/leadDuplicatePolicy.js', 'utf8');
const leadModel = await readFile('src/lib/leadModel.js', 'utf8');
const statsMetrics = await readFile('src/lib/statsMetrics.js', 'utf8');
const utilityBlocks = await readFile('src/preview/renderers/UtilityBlocks.jsx', 'utf8');
const builderFeedback = await readFile('src/builder/BuilderFeedback.jsx', 'utf8');
const editorControls = await readFile('src/editor/controls.jsx', 'utf8');
const richField = await readFile('src/editor/RichField.jsx', 'utf8');
const previewUtils = await readFile('src/preview/renderers/previewUtils.jsx', 'utf8');
const stylePanel = await readFile('src/panels/StylePanel.jsx', 'utf8');
const inboxPanel = await readFile('src/panels/InboxPanel.jsx', 'utf8');
const settingsPanel = await readFile('src/panels/SettingsPanel.jsx', 'utf8');
const settingsPanelCss = await readFile('src/panels/SettingsPanel.css', 'utf8');
const runtimeConfigSource = await readFile('src/config/runtimeConfig.js', 'utf8');

assert(main.includes('<AppErrorBoundary><Root /></AppErrorBoundary>'), 'root render must stay wrapped in AppErrorBoundary');
assert(app.includes("const InboxPanel = lazy(() => import('./panels/InboxPanel.jsx'))"), 'InboxPanel must stay lazy-loaded');
assert(app.includes("const StatsPanel = lazy(() => import('./panels/StatsPanel.jsx'))"), 'StatsPanel must stay lazy-loaded');
assert(app.includes("const SettingsPanel = lazy(() => import('./panels/SettingsPanel.jsx'))"), 'SettingsPanel must stay lazy-loaded');
assert(app.includes("const AdminPanel = lazy(() => import('./panels/AdminPanel.jsx'))"), 'AdminPanel must stay lazy-loaded');
assert(app.includes("const TemplatesPanel = lazy(() => import('./panels/TemplatesPanel'))"), 'TemplatesPanel must stay lazy-loaded');
assert(app.includes("await import('./templates/landingTemplates')") || app.includes("await import('./templates/landingTemplates.js')"), 'landing templates must stay dynamically imported');
assert(!/import\s+\{?\s*LANDING_TEMPLATES\b/.test(app), 'landing templates must not be statically imported');
assert(!/import\s+(?:InboxPanel|StatsPanel|StylePanel|SettingsPanel|TemplatesPanel|AdminPanel|AiPanel)\b/.test(app), 'heavy panels and AI panel must not be statically imported into App');
assert(!/import\s+(?:\{[^}]*Editor[^}]*\}|[A-Z][A-Za-z]+Editor)\s+from\s+['"]\.\/editor\/blockEditors\//.test(app), 'block editors must not be statically imported into App');
assert(app.includes('function LazyEditorFallback()') && app.includes('class LazyEditorBoundary extends Component'), 'fixed block editor controls must keep lazy fallback and error boundary');
assert(app.includes('componentDidUpdate(prevProps)') && app.includes('this.setState({ error: null })'), 'lazy editor boundaries must reset after selection changes');
assert(authContext.includes("CLIENT_ADMIN: 'clientAdmin'") && authContext.includes("BUILDER: 'builder'") && authContext.includes("MANAGER: 'manager'"), 'access modes must include builder, manager, and client admin');
assert(authContext.includes("export const CLIENT_ADMIN_TABS = ['inbox', 'stats', 'settings']"), 'client admin tabs must stay limited to inbox/stats/settings');
assert(authContext.includes("export const BUILDER_TABS = ['edit', 'style', 'inbox', 'stats', 'settings']"), 'builder tabs must keep admin out of the public workspace navigation');
assert(authContext.includes('MANAGER_PERMISSION_TABS') && authContext.includes('DEFAULT_MANAGER_ACCESS') && authContext.includes('managerForAuthUser'), 'manager permission contract must stay explicit');
assert(authContext.includes('export function canWriteTab') && authContext.includes('export function canReadTab') && authContext.includes('export function canUseAdminSurface'), 'read/write tab permission helpers must stay available');
assert(authContext.includes('ACCESS_MODES.UNAUTHORIZED'), 'missing auth/project state must map to unauthorized');
assert(authContext.includes('clientAdminEnabled = false') && authContext.includes('clientAdminEnabled && ownership.clientAccess'), 'client admin mode must stay behind the internal flag until server enforcement exists');
assert(runtimeConfigSource.includes('VITE_INLET_ENABLE_OWNER_ADMIN_MODE') && runtimeConfigSource.includes('ownerAdminModeEnabled'), 'owner admin internal runtime flag must be explicit');
assert(app.includes('isOwnerAdminModeEnabled') && app.includes('clientAdminEnabled: ownerAdminModeEnabled'), 'App must derive client admin access from the internal runtime flag');
assert(app.includes('canUseBuilder && tab === \'edit\'') && app.includes('canUseBuilder && tab === \'style\''), 'builder-only editor and style tabs must stay permission gated');
assert(app.includes('NAV.filter(([key]) => allowedTabs.includes(key))'), 'navigation must render only allowed tabs');
assert(app.includes('function tabFromLocation') && app.includes('function hasTabDeepLink') && app.includes("new URLSearchParams(location.search).get('tab')") && app.includes('replaceLocationTab(nextTab)'), 'App must support tab query deep links for authenticated visual QA and operator URLs');
assert(app.includes('!tabDeepLink && <Suspense') && app.includes('<StartModeOverlay'), 'tab deep links must bypass the start mode overlay');
assert(app.includes('canManageAdmin && !startMode') && app.includes('canManageAdmin && startMode === \'template\''), 'template/start controls must stay master-admin-only');
assert(app.includes('adminRoute') && app.includes("return /^\\/(?:admin|[^/?#]+\\/admin)\\/?$/.test(routePath)") && app.includes('<AdminPanel'), 'admin panel must stay on a private /admin route');
assert(app.includes('const canWriteTabKey = (key) => canWriteTab(accessMode, page, authUser, key)') && app.includes('blockWrite'), 'App must enforce manager write permissions before mutation');
assert(app.includes('selectedBlockId={canUseBuilder ? openId : \'\'}') && app.includes('onSelectBlock={canUseBuilder ? selectPreviewBlock : undefined}'), 'client admin preview must not route into block editing');
assert(app.includes("['topnav', 'bottombar', 'footer'].includes(target?.type)") && app.includes("setOpenId('');") && app.indexOf("['topnav', 'bottombar', 'footer'].includes(target?.type)") < app.indexOf('document.getElementById(`editor-block-${id}`)'), 'preview fixed layout clicks must not auto-open editor blocks');
assert(!homeScreens.includes('전송 상태') && !homeScreens.includes('알림 전송 상태'), 'public home copy should not expose delivery status as an operator UI feature');
assert(/const openWorkspace = [\s\S]*?setOpenId\(''\);[\s\S]*?setAddOpen\(false\);[\s\S]*?if \(!canUseBuilder\)/.test(app), 'workspace entry must collapse any open editor block and add panel');
assert(app.includes('class LazyEditorBoundary'), 'fixed block editors must isolate lazy chunk failures');
assert(app.includes('<LazyEditorBoundary resetKey=') && app.includes('<Suspense fallback={<LazyEditorFallback />}'), 'fixed block editors must keep lazy loading fallback and boundary');
assert(blockEditor.includes('class LazyEditorErrorBoundary'), 'BlockEditor must isolate lazy editor chunk failures');
assert(blockEditor.includes('<Suspense fallback=') && blockEditor.includes('data-lazy-editor-fallback="true"') && blockEditor.includes('LAZY_EDITOR_FALLBACK_TEXT'), 'BlockEditor must keep a stable lazy editor loading fallback');
assert(blockEditor.includes('role="alert"') && blockEditor.includes('data-lazy-editor-error="true"') && blockEditor.includes('LAZY_EDITOR_ERROR_TEXT'), 'BlockEditor must show a useful lazy editor failure state');
assert(blockEditor.includes('componentDidUpdate(prevProps)') && blockEditor.includes('this.setState({ error: null })'), 'BlockEditor lazy error boundary must reset when the selected block/type changes');
assert(appErrorBoundary.includes('className="error-screen error-screen-v2"'), 'AppErrorBoundary must keep the app recovery screen');
assert(appErrorBoundary.includes('화면을 불러오는 중 오류가 발생했습니다.'), 'AppErrorBoundary must keep readable Korean error text');
assert(appErrorBoundary.includes('페이지 설정만 초기화') && appErrorBoundary.includes('전체 초기화'), 'AppErrorBoundary recovery actions must keep readable Korean labels');
assert(!/[�]|諛|獄|揆|\?ㅼ|\?섏|\?꾩|珥덇린/.test(appErrorBoundary), 'AppErrorBoundary must not contain mojibake recovery text');
assert(appErrorBoundary.includes('localStorage.removeItem(STORAGE_KEY); location.reload();'), 'AppErrorBoundary must keep page-only recovery action');
assert(appErrorBoundary.includes('localStorage.removeItem(LEADS_KEY)') && appErrorBoundary.includes('localStorage.removeItem(EVENTS_KEY)'), 'AppErrorBoundary must keep full recovery action');
assert(!/[�]|諛|獄|揆|덉빟|됰튋/.test(leadDuplicatePolicy), 'lead duplicate policy must not depend on mojibake reservation keywords');
assert(!/[�]|諛|獄|揆|덉빟|됰튋/.test(leadModel), 'lead model must not depend on mojibake reservation keywords');
assert(!/[�]|諛|獄|揆|덉빟|됰튋|\?좉|\?곷|\?꾩/.test(statsMetrics), 'stats metrics must not depend on mojibake labels or reservation keywords');
assert(leadDuplicatePolicy.includes('예약|방문|방문예약|reservation|booking|reserve'), 'lead duplicate policy must detect Korean and English reservation terms');
assert(leadModel.includes("rawType.includes('방문') || rawType.includes('예약')"), 'lead model must detect readable Korean reservation type text');
assert(statsMetrics.includes("const typeData = { 상담: 0, 예약: 0 }") && statsMetrics.includes('예약|방문|방문예약|reservation|booking|reserve'), 'stats metrics must use readable lead type labels');
assert(landingRenderer.includes('class BlockErrorBoundary'), 'LandingRenderer must keep block-level error isolation');
assert(landingRenderer.includes('componentDidUpdate(prevProps)'), 'BlockErrorBoundary must reset when block data changes');
assert(utilityBlocks.includes("return typeof cleanup === 'function' ? cleanup : undefined;"), 'custom code cleanup must return only a function or undefined');
assert(builderFeedback.includes('role="dialog"') && builderFeedback.includes('aria-modal="true"'), 'modals must keep dialog semantics');
assert(builderFeedback.includes("event.key === 'Escape'") && builderFeedback.includes("querySelector?.('button"), 'modals must keep Escape close and initial focus behavior');
assert(builderFeedback.includes('aria-label="닫기"'), 'icon close buttons must keep accessible names');
assert(editorControls.includes('aria-label={`${label} 수정`}') && editorControls.includes('aria-label={`${label} 삭제`}') && editorControls.includes('aria-label={`${label} 업로드`}'), 'image icon buttons must keep accessible names');
assert(editorControls.includes('aria-label={`${label} 색상 추출`}') && stylePanel.includes('aria-label={`${label} 색상 추출`}'), 'eyedropper icon buttons must keep accessible names');

assert(richField.includes('<textarea') && richField.includes('onChange={(event) => onChange(textToHtml(event.target.value))}'), 'RichField must use a simple textarea and save content edits immediately');
assert(!richField.includes('type="color"') && !richField.includes("document.execCommand('foreColor'"), 'RichField must not expose per-widget color formatting controls');
assert(previewUtils.includes('dangerouslySetInnerHTML') && previewUtils.includes('style="color:${color}"') && previewUtils.includes('<u>${inner}</u>') && previewUtils.includes('<strong>${inner}</strong>'), 'preview rich text renderer must preserve color, underline, and bold markup');
assert(stylePanel.includes('onPreviewThemeChange?.(draftTheme)') && app.includes('const [stylePreviewTheme, setStylePreviewTheme] = useState(null)'), 'StylePanel draft changes must keep live preview wiring');
assert(stylePanel.includes("!['topnav', 'bottombar', 'footer'].includes(block.type)") && stylePanel.includes('defaultStyleBlockId'), 'StylePanel must not auto-select fixed layout widgets on first entry');
assert(stylePanel.includes("topnav: '상단 메뉴'") && stylePanel.includes("bottombar: '하단 버튼'") && stylePanel.includes("search: '검색'"), 'StylePanel block labels must stay readable Korean text');
assert(stylePanel.includes("'code',") && stylePanel.includes("'search',") && stylePanel.includes("search: {") && stylePanel.includes("options: [['card', '카드'], ['bar', '바'], ['minimal', '미니멀']]"), 'StylePanel must expose code/search widgets and readable search layout options');
assert(inboxPanel.includes('ensureHeaders(sheet, Object.keys(fields))') && inboxPanel.includes('BASE_HEADERS.concat(customHeaders, [JSON_HEADER])'), 'Google Sheets sample code must create columns for actual form fields');
assert(inboxPanel.includes('advancedOpen') && inboxPanel.includes('connection-advanced-toggle') && inboxPanel.includes('연동 전체 저장'), 'Inbox integrations should keep webhook inside an advanced section and label full save clearly');
assert(settingsPanel.includes("<span className=\"settings-section-state\" aria-hidden=\"true\">{open ? '접기' : '열기'}</span>"), 'Settings sections must render explicit open/close action labels');
assert(settingsPanel.includes("<em aria-hidden=\"true\">{advancedOpen ? '접기' : '열기'}</em>"), 'Settings advanced section must render explicit open/close action labels');
assert(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*58px\s*!important/.test(settingsPanelCss), 'Settings section headers must reserve readable action label space');
assert(/\.settings-panel \.settings-section-state,[\s\S]*?width:\s*58px\s*!important[\s\S]*?writing-mode:\s*horizontal-tb\s*!important/.test(settingsPanelCss), 'Settings action controls must stay horizontal and unclipped');
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
