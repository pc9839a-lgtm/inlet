import { readFile } from 'node:fs/promises';

await import('./page-edit-history-quality-check.mjs');
await import('./page-revision-restore-quality-check.mjs');
await import('./page-publish-semantics-quality-check.mjs');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browserSource = await readFile('scripts/editor-browser-regression-check.mjs', 'utf8');
const imageLibraryBrowserSource = await readFile('scripts/editor-image-library-browser-check.mjs', 'utf8');
const cdpCompatSource = await readFile('scripts/editor-browser-cdp-compat.mjs', 'utf8');
const workflowSource = await readFile('.github/workflows/qa.yml', 'utf8');
const qaAllSource = await readFile('scripts/qa-all.mjs', 'utf8');
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const panelHeaderSource = await readFile('src/builder/PanelHeader.jsx', 'utf8');
const editHistorySource = await readFile('src/runtime/pageEditHistory.js', 'utf8');
const addBlockPanelSource = await readFile('src/editor/editPanelParts/AddBlockPanel.jsx', 'utf8');
const addBlockGridSource = await readFile('src/editor/editPanelParts/AddBlockGroupGrid.jsx', 'utf8');
const addBlockOptionSource = await readFile('src/editor/editPanelParts/AddBlockOption.jsx', 'utf8');
const addBlockDockCssSource = await readFile('src/styles/editor-widget-add-dock.css', 'utf8');

assert(packageJson.scripts?.['browser:editor:qa'] === 'node --import ./scripts/editor-browser-cdp-compat.mjs scripts/editor-browser-regression-check.mjs && node --import ./scripts/editor-browser-cdp-compat.mjs scripts/editor-image-library-browser-check.mjs', 'browser:editor:qa must run the authenticated editor regression and project image-library E2E');
assert(packageJson.scripts?.['browser:editor:image-library:qa'] === 'node --import ./scripts/editor-browser-cdp-compat.mjs scripts/editor-image-library-browser-check.mjs', 'browser:editor:image-library:qa script is missing');
assert(packageJson.scripts?.['browser:editor:contract:qa'] === 'node scripts/editor-browser-regression-contract-check.mjs', 'browser:editor:contract:qa script is missing');
assert(qaAllSource.includes("['browser:editor:contract:qa', ['scripts/editor-browser-regression-contract-check.mjs']]"), 'qa:all must enforce the editor browser contract');

assert(cdpCompatSource.includes("payload?.method === 'Emulation.setTouchEmulationEnabled'"), 'CDP compatibility must target touch emulation only');
assert(cdpCompatSource.includes("payload.params = { enabled: false }"), 'desktop touch emulation must omit an invalid zero touch-point count');
assert(cdpCompatSource.includes("document.querySelector('.top-tabs')"), 'mobile editor bounds must use the current top-tabs DOM selector');
assert(cdpCompatSource.includes("'run-started.txt'"), 'early browser failures must leave an uploadable diagnostic artifact');

assert(workflowSource.includes('editor-browser-regression:'), 'QA workflow must contain an authenticated editor browser job');
assert(workflowSource.includes('VITE_INLET_PAGE_MODE: server') && workflowSource.includes('VITE_INLET_LEAD_MODE: server'), 'editor browser build must run in server data mode');
assert(workflowSource.includes('INLET_EDITOR_BROWSER_QA_ORIGIN: http://127.0.0.1:4174'), 'editor browser origin must use the isolated preview port');
assert(workflowSource.includes('npm run browser:editor:qa'), 'editor browser job must execute browser:editor:qa');
assert(workflowSource.includes('.tmp-editor-browser-regression'), 'editor browser screenshots must be uploaded');
assert(workflowSource.includes('include-hidden-files: true'), 'hidden browser screenshot directories must be included');

assert(browserSource.includes("`${origin}/login`") && browserSource.includes("input[placeholder=\"email@example.com\"]"), 'browser QA must start from the real login screen');
assert(browserSource.includes("pathname === '/api/auth/login'") && browserSource.includes("pathname === '/api/auth/session'"), 'browser QA must mock login and session refresh APIs');
assert(browserSource.includes("pathname === '/api/projects'") && browserSource.includes(".service-landing-card"), 'browser QA must load and select a dashboard page');
assert(browserSource.includes("pathname === '/api/account-page'") && browserSource.includes("#editor-block-editor-hero") && browserSource.includes(".screen-order-v2-head") && browserSource.includes("#editor-block-editor-hero textarea[placeholder=\"핵심 제목을 입력하세요\"]") && browserSource.includes('브라우저 저장 검증 완료'), 'browser QA must open the current account page, edit the active EditPanel block, and verify live preview');
assert(browserSource.includes(".panel-actions .primary-btn") && browserSource.includes("Page.reload"), 'browser QA must publish and verify the page after reload');
assert(browserSource.includes("clickButtonByText(client, '.add-panel', '구분선')") && browserSource.includes("panel-history-btn[aria-label=\"실행 취소\"]") && browserSource.includes("panel-history-btn[aria-label=\"다시 실행\"]"), 'browser QA must add a block and verify undo/redo through the real editor controls');
assert(browserSource.includes("#editor-block-editor-text .screen-order-v2-visibility-button") && browserSource.includes("#editor-block-editor-form .screen-order-v2-action") && browserSource.includes("'위로 이동'"), 'browser QA must verify visibility and order changes through the current screen-order V2 controls');
assert(browserSource.includes("clickButtonByText(client, '.top-tabs', '스타일')") && browserSource.includes("updatedAccent") && browserSource.includes(".style-apply-btn"), 'browser QA must preview and apply a style change before publish');
assert(browserSource.includes("window.__pageroQaPreviewCalls") && browserSource.includes("clickButtonByText(client, '.panel-actions', '미리보기')"), 'browser QA must verify preview can open without interrupting continued editing');
assert(browserSource.includes("saveDelayMs = 900") && browserSource.includes("continuedHeroTitle") && browserSource.includes("newer local draft after delayed publish response"), 'browser QA must cover edits made while a publish response is in flight');
assert(browserSource.includes("setViewport(client, 1180, 900, false)") && browserSource.includes("assertNarrowDesktop"), 'browser QA must cover narrow desktop overflow separately from mobile operations mode');
assert(browserSource.includes("publicVerifyCount") && browserSource.includes("saveCount === 0"), 'browser QA must verify that editing stays local until explicit publish and then verifies the public page');
assert(browserSource.includes("{ name: 'mobile-360', width: 360") && browserSource.includes("{ name: 'mobile-390', width: 390") && browserSource.includes("{ name: 'mobile-430', width: 430"), 'browser QA must cover 360, 390, and 430 pixel mobile widths');
assert(browserSource.includes("mobile-operations-shell") && browserSource.includes("bodyScrollWidth <= viewport.width + 3"), 'mobile editor regression must reject overflow and verify operations mode');
assert(browserSource.includes("unexpectedApis.length === 0") && browserSource.includes("browserErrors.length === 0"), 'browser QA must fail on unexpected API calls or browser exceptions');
assert(!browserSource.includes('pagero.kr/api/auth/login') && !browserSource.includes('productionPassword'), 'browser QA must not use production credentials or production auth endpoints');

assert(imageLibraryBrowserSource.includes("id: 'editor-image', type: 'image'") && imageLibraryBrowserSource.includes("#editor-block-editor-image"), 'image-library browser QA must use the real image block editor instead of assuming hero image controls');
assert(imageLibraryBrowserSource.includes("pathname === '/api/files/list'") && imageLibraryBrowserSource.includes("kind: 'image'"), 'image-library browser QA must load project images through the real list route contract');
assert(imageLibraryBrowserSource.includes("projectId === 'editor-project'") && imageLibraryBrowserSource.includes("ownerId === 'editor-owner'") && imageLibraryBrowserSource.includes("slug === 'editor-e2e'"), 'image-library browser QA must verify project, owner, and page scope');
assert(imageLibraryBrowserSource.includes('.image-input-library-action') && imageLibraryBrowserSource.includes('.image-library-picker-item'), 'image-library browser QA must click the real picker action and a real picker item');
assert(imageLibraryBrowserSource.includes("(document.body?.innerText || '').includes('내 이미지에서 선택 완료')"), 'image-library browser QA must verify selection feedback');
assert(imageLibraryBrowserSource.includes("saveCount === 0") && imageLibraryBrowserSource.includes(".panel-actions .primary-btn"), 'image-library selection must stay local before explicit publish');
assert(imageLibraryBrowserSource.includes("savedImageBlock?.s?.image === selectedImageValue") && imageLibraryBrowserSource.includes("Page.reload"), 'image-library browser QA must verify the selected image is published and survives reload');
assert(imageLibraryBrowserSource.includes("imageDownloadCount >= 1") && imageLibraryBrowserSource.includes("unexpectedApis.length === 0") && imageLibraryBrowserSource.includes("browserErrors.length === 0"), 'image-library browser QA must verify image readback and fail on unexpected runtime errors');
assert(!imageLibraryBrowserSource.includes('pagero.kr/api/auth/login') && !imageLibraryBrowserSource.includes('productionPassword'), 'image-library browser QA must not use production credentials or production auth endpoints');

assert(addBlockPanelSource.includes("const RECENT_BLOCKS_KEY = 'pagero.editor.recent-blocks.v1'") && addBlockPanelSource.includes('const MAX_RECENT_BLOCKS = 5'), 'block add picker must keep a bounded browser-local recent list');
assert(addBlockPanelSource.includes('window.localStorage.setItem(RECENT_BLOCKS_KEY') && addBlockPanelSource.includes("<b>최근 사용</b>"), 'block add picker must persist and expose recent blocks without changing page data');
assert(addBlockPanelSource.includes('aria-label="위젯 카테고리"') && addBlockPanelSource.includes("setCategory('all')"), 'block add picker must expose category shortcuts and reset to all for global search');
assert(addBlockGridSource.includes("category === 'all' || categoryKey === category") && addBlockGridSource.includes('조건에 맞는 위젯이 없습니다.'), 'block add grid must filter categories and show a clear empty state');
assert(addBlockOptionSource.includes("meta.preset || '', type"), 'block add options must preserve the catalog type for recent-block history');
assert(addBlockDockCssSource.includes('.widget-category-filter button') && addBlockDockCssSource.includes('min-height: 44px !important;'), 'block add picker mobile actions must keep 44px touch targets');

assert(panelHeaderSource.includes('undoPageEdit') && panelHeaderSource.includes('redoPageEdit') && panelHeaderSource.includes('Ctrl/Cmd+Z'), 'editor header must expose undo/redo controls and keyboard shortcuts');
assert(editHistorySource.includes('const MAX_HISTORY = 50') && editHistorySource.includes('future = []'), 'editor history must cap snapshots and invalidate redo after fresh edits');

console.log(JSON.stringify({
  ok: true,
  scope: 'authenticated-editor-browser-contract',
  desktopFlow: ['login', 'dashboard', 'account-page', 'page-select', 'edit-panel', 'add-block', 'undo-redo', 'visibility', 'reorder', 'style-apply', 'preview-continue', 'publish-race', 'publish', 'reload', 'narrow-desktop'],
  imageLibraryFlow: ['image-block', 'open-library', 'project-scoped-list', 'select-existing-image', 'local-draft', 'publish', 'reload'],
  mobileWidths: [360, 390, 430],
  productionCredentials: false,
  accountPageMock: true,
  activeEditorDom: 'EditPanel/ScreenOrderRow',
  chromeCdpCompatibility: true,
  editHistory: ['undo', 'redo', '50-snapshots', 'page-isolation'],
  revisionDraftRestore: true,
  draftPublishSemantics: true,
  imageLibraryBrowserE2E: true,
  blockAddPicker: ['search', 'category-filter', 'recent-5', 'empty-state', 'mobile-44px'],
}, null, 2));
