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
assert(browserSource.includes("publicVerifyCount") && browserSource.includes("saveCount === 0"), 'browser QA must verify that editing stays local until explicit publish and then verifies the public page');
assert(browserSource.includes("{ name: 'mobile-360', width: 360") && browserSource.includes("{ name: 'mobile-390', width: 390") && browserSource.includes("{ name: 'mobile-430', width: 430"), 'browser QA must cover 360, 390, and 430 pixel mobile widths');
assert(browserSource.includes("mobile-operations-shell") && browserSource.includes("bodyScrollWidth <= viewport.width + 3"), 'mobile editor regression must reject overflow and verify operations mode');
assert(browserSource.includes("unexpectedApis.length === 0") && browserSource.includes("browserErrors.length === 0"), 'browser QA must fail on unexpected API calls or browser exceptions');
assert(!browserSource.includes('pagero.kr/api/auth/login') && !browserSource.includes('productionPassword'), 'browser QA must not use production credentials or production auth endpoints');

assert(imageLibraryBrowserSource.includes("pathname === '/api/files/list'") && imageLibraryBrowserSource.includes("kind: 'image'"), 'image-library browser QA must load project images through the real list route contract');
assert(imageLibraryBrowserSource.includes("projectId === 'editor-project'") && imageLibraryBrowserSource.includes("ownerId === 'editor-owner'") && imageLibraryBrowserSource.includes("slug === 'editor-e2e'"), 'image-library browser QA must verify project, owner, and page scope');
assert(imageLibraryBrowserSource.includes('.image-input-library-action') && imageLibraryBrowserSource.includes('.image-library-picker-item'), 'image-library browser QA must click the real picker action and a real picker item');
assert(imageLibraryBrowserSource.includes("(document.body?.innerText || '').includes('내 이미지에서 선택 완료')"), 'image-library browser QA must verify selection feedback');
assert(imageLibraryBrowserSource.includes("saveCount === 0") && imageLibraryBrowserSource.includes(".panel-actions .primary-btn"), 'image-library selection must stay local before explicit publish');
assert(imageLibraryBrowserSource.includes("savedHero?.s?.image === selectedImageValue") && imageLibraryBrowserSource.includes("Page.reload"), 'image-library browser QA must verify the selected image is published and survives reload');
assert(imageLibraryBrowserSource.includes("imageDownloadCount >= 1") && imageLibraryBrowserSource.includes("unexpectedApis.length === 0") && imageLibraryBrowserSource.includes("browserErrors.length === 0"), 'image-library browser QA must verify image readback and fail on unexpected runtime errors');
assert(!imageLibraryBrowserSource.includes('pagero.kr/api/auth/login') && !imageLibraryBrowserSource.includes('productionPassword'), 'image-library browser QA must not use production credentials or production auth endpoints');

assert(panelHeaderSource.includes('undoPageEdit') && panelHeaderSource.includes('redoPageEdit') && panelHeaderSource.includes('Ctrl/Cmd+Z'), 'editor header must expose undo/redo controls and keyboard shortcuts');
assert(editHistorySource.includes('const MAX_HISTORY = 50') && editHistorySource.includes('future = []'), 'editor history must cap snapshots and invalidate redo after fresh edits');

console.log(JSON.stringify({
  ok: true,
  scope: 'authenticated-editor-browser-contract',
  desktopFlow: ['login', 'dashboard', 'account-page', 'page-select', 'edit-panel', 'publish', 'reload'],
  imageLibraryFlow: ['open-library', 'project-scoped-list', 'select-existing-image', 'local-draft', 'publish', 'reload'],
  mobileWidths: [360, 390, 430],
  productionCredentials: false,
  accountPageMock: true,
  activeEditorDom: 'EditPanel/ScreenOrderRow',
  chromeCdpCompatibility: true,
  editHistory: ['undo', 'redo', '50-snapshots', 'page-isolation'],
  revisionDraftRestore: true,
  draftPublishSemantics: true,
  imageLibraryBrowserE2E: true,
}, null, 2));