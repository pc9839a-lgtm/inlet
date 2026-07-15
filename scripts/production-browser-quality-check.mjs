import { spawn } from 'node:child_process';

const baseUrl = process.env.INLET_PRODUCTION_QA_URL || 'https://pagero.kr';
const requireRealBrowser = process.env.INLET_PRODUCTION_BROWSER_QA_REQUIRE === '1' || process.env.INLET_BROWSER_QA_REQUIRE === '1';
const includeAuthenticatedCases = process.env.INLET_PRODUCTION_QA_INCLUDE_AUTHENTICATED === '1';
const includeMockCases = process.env.INLET_PRODUCTION_QA_INCLUDE_MOCKS === '1';
const includeNextSettingsCases = process.env.INLET_PRODUCTION_QA_INCLUDE_NEXT_SETTINGS === '1';
const publicSlug = String(process.env.INLET_PRODUCTION_QA_PUBLIC_SLUG || '').trim();
const serverSaveSetInput = String(process.env.INLET_PRODUCTION_QA_SAVE_SET_INPUT || '').trim();
const serverSavePostClickSelector = String(process.env.INLET_PRODUCTION_QA_SAVE_POST_CLICK_SELECTOR || '').trim();
const serverSaveExpectedText = String(process.env.INLET_PRODUCTION_QA_SAVE_EXPECT_TEXT || '서버 저장됨').trim();
const includeServerSaveCase = Boolean(serverSaveSetInput && serverSavePostClickSelector);

const forbiddenErrorText = [
  '\uD654\uBA74\uC744 \uBD88\uB7EC\uC624\uB294 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4',
  'Failed to fetch dynamically imported module',
  'ApiError is not defined',
  'Project access is required',
  'Page not found',
  '\uD398\uC774\uC9C0\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4',
].join(',');

const cases = [
  { name: 'public home desktop', url: `${baseUrl}/`, viewports: 'desktop', expectedText: 'WAYZI', forbiddenText: forbiddenErrorText },
  { name: 'public home mobile', url: `${baseUrl}/`, viewports: 'mobile', expectedText: 'WAYZI', forbiddenText: forbiddenErrorText },
  { name: 'public about route', url: `${baseUrl}/about`, viewports: 'desktop', expectedText: 'WAYZI', expectedSelector: '.wayzi-global-footer', forbiddenText: forbiddenErrorText },
  { name: 'public contact route', url: `${baseUrl}/contact`, viewports: 'desktop', expectedText: 'WAYZI', expectedSelector: '.wayzi-global-footer', forbiddenText: forbiddenErrorText },
  { name: 'public privacy route', url: `${baseUrl}/privacy`, viewports: 'desktop', expectedText: 'WAYZI', expectedSelector: '.wayzi-global-footer', forbiddenText: forbiddenErrorText },
  { name: 'public terms route', url: `${baseUrl}/terms`, viewports: 'desktop', expectedText: 'WAYZI', expectedSelector: '.wayzi-global-footer', forbiddenText: forbiddenErrorText },
  { name: 'owner edit cards', authenticated: true, url: `${baseUrl}/?tab=edit`, statePreset: 'owner-settings', expectedSelector: '.top-tabs,.editor-list,.phone-frame', forbiddenText: forbiddenErrorText },
  { name: 'owner start modal', authenticated: true, url: `${baseUrl}/`, statePreset: 'owner-start-modal', expectedSelector: '.start-choice-modal,.start-choice-card', forbiddenText: '\uD654\uBA74\uC744 \uBD88\uB7EC\uC624\uB294 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4,Failed to fetch dynamically imported module,ApiError is not defined' },
  { name: 'template debt first viewport', authenticated: true, url: `${baseUrl}/?tab=edit`, statePreset: 'template-preview:debt-relief-consult', expectedSelector: '.landing-page,.landing-section.topnav,.landing-section.hero,.landing-section.form', forbiddenText: forbiddenErrorText },
  { name: 'template wedding first viewport', authenticated: true, url: `${baseUrl}/?tab=edit`, statePreset: 'template-preview:wedding-invitation', expectedSelector: '.landing-page,.landing-section.hero,.landing-section.form', forbiddenText: forbiddenErrorText },
  { name: 'template real-estate first viewport', authenticated: true, url: `${baseUrl}/?tab=edit`, statePreset: 'template-preview:quote-request', expectedSelector: '.landing-page,.landing-section.topnav,.landing-section.hero,.landing-section.form,.landing-section.reservation', forbiddenText: forbiddenErrorText },
  { name: 'owner inbox', authenticated: true, url: `${baseUrl}/?tab=inbox`, statePreset: 'owner-settings', expectedSelector: '.inbox-panel,.inbox-list', forbiddenText: forbiddenErrorText },
  { name: 'manager stats', authenticated: true, url: `${baseUrl}/?tab=stats`, statePreset: 'manager-limited', expectedSelector: '.stats-panel,.stats-channel-filter', forbiddenText: '\uC2DC\uC791 \uBC29\uC2DD \uC120\uD0DD,\uCC98\uC74C \uD654\uBA74\uC744 \uC5B4\uB5BB\uAC8C \uB9CC\uB4E4\uAE4C\uC694,\uB9E4\uB2C8\uC800 \uAD8C\uD55C,\uD654\uBA74\uC744 \uBD88\uB7EC\uC624\uB294 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4,ApiError is not defined' },
  { name: 'owner settings manager permissions', authenticated: true, url: `${baseUrl}/?tab=settings`, statePreset: 'owner-settings', expectedSelector: '.settings-panel,.manager-access-card,.manager-access-card .settings-section-head', forbiddenText: '\uC2DC\uC791 \uBC29\uC2DD \uC120\uD0DD,\uCC98\uC74C \uD654\uBA74\uC744 \uC5B4\uB5BB\uAC8C \uB9CC\uB4E4\uAE4C\uC694,\uD654\uBA74\uC744 \uBD88\uB7EC\uC624\uB294 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4,ApiError is not defined' },
  { name: 'internal admin ownership queue', authenticated: true, url: `${baseUrl}/admin`, statePreset: 'owner-settings', expectedSelector: '.master-admin-panel,.admin-shell,.admin-panel', forbiddenText: '\uCC98\uC74C \uD654\uBA74\uC744 \uC5B4\uB5BB\uAC8C \uB9CC\uB4E4\uAE4C\uC694,\uD654\uBA74\uC744 \uBD88\uB7EC\uC624\uB294 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4,ApiError is not defined' },
  { name: 'owner settings manager permissions compact', authenticated: true, url: `${baseUrl}/?tab=settings`, statePreset: 'owner-settings', viewports: 'compact', expectedSelector: '.manager-access-card,.manager-access-card .settings-section-head', forbiddenText: '\uCC98\uC74C \uD654\uBA74\uC744 \uC5B4\uB5BB\uAC8C \uB9CC\uB4E4\uAE4C\uC694,\uD654\uBA74\uC744 \uBD88\uB7EC\uC624\uB294 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4,ApiError is not defined' },
  { name: 'owner style text color live preview', authenticated: true, url: `${baseUrl}/?tab=style`, statePreset: 'owner-settings', viewports: 'desktop', clickSelector: '.style-subnav button:nth-child(3)', setInput: '.style-card input[type="color"]=>#dc2626', expectedSelector: '.style-card input[type="color"],.phone-frame .landing-page', expectedComputed: '.phone-frame .landing-page|color|rgb(220, 38, 38)', forbiddenText: '\uD654\uBA74\uC744 \uBD88\uB7EC\uC624\uB294 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4,ApiError is not defined' },
  { name: 'owner style font tone live preview', authenticated: true, url: `${baseUrl}/?tab=style`, statePreset: 'owner-settings', viewports: 'desktop', clickSelector: '.style-subnav button:nth-child(3),.style-panel-box .style-segment-line:nth-child(2) button:nth-child(3),.style-panel-box .style-segment-line:nth-child(3) button:nth-child(3)', expectedSelector: '.phone-frame .landing-page.font-bold.font-family-serif', forbiddenText: '\uD654\uBA74\uC744 \uBD88\uB7EC\uC624\uB294 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4,ApiError is not defined' },
  { name: 'owner rich text bold underline toolbar', authenticated: true, url: `${baseUrl}/?tab=edit`, statePreset: 'owner-settings', viewports: 'desktop', expectedSelector: '.rich-field-wysiwyg .rich-editor', richFormat: '.rich-field-wysiwyg:nth-of-type(1) .rich-editor|.rich-field-wysiwyg:nth-of-type(1) .rich-head button:nth-child(1)|<strong>||<b>||font-weight: bold||font-weight: 700;.rich-field-wysiwyg:nth-of-type(1) .rich-editor|.rich-field-wysiwyg:nth-of-type(1) .rich-head button:nth-child(2)|<u>||text-decoration', forbiddenText: '\uD654\uBA74\uC744 \uBD88\uB7EC\uC624\uB294 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4,ApiError is not defined' },
  { name: 'manager invite acceptance', mocked: true, url: `${baseUrl}/invite/qa-visual-invite`, statePreset: 'invite-acceptance', expectedText: 'manager@example.test', expectedSelector: '.auth-shell,.auth-card,.auth-form', forbiddenText: forbiddenErrorText },
  { name: 'owner inbox duplicate policy', authenticated: true, nextReleaseOnly: true, url: `${baseUrl}/?tab=inbox`, statePreset: 'owner-settings', viewports: 'desktop', clickSelector: '.inbox-policy-head', expectedSelector: '.inbox-policy-card,.inbox-policy-grid,.inbox-policy-select,.inbox-policy-history', forbiddenText: '\uD654\uBA74\uC744 \uBD88\uB7EC\uC624\uB294 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4,ApiError is not defined' },
  { name: 'owner settings page duplication modal', authenticated: true, nextReleaseOnly: true, url: `${baseUrl}/?tab=settings`, statePreset: 'owner-settings', viewports: 'desktop', clickSelector: '.page-duplicate-summary button', expectedSelector: '.settings-panel,.page-duplicate-summary button,.settings-url-modal', forbiddenText: '\uD654\uBA74\uC744 \uBD88\uB7EC\uC624\uB294 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4,ApiError is not defined' },
  ...(includeServerSaveCase ? [{
    name: 'owner server save round trip',
    authenticated: true,
    url: baseUrl + '/?tab=edit',
    statePreset: 'owner-settings',
    viewports: 'desktop',
    setInput: serverSaveSetInput,
    postClickSelector: serverSavePostClickSelector,
    expectedText: serverSaveExpectedText,
    expectedSelector: '.top-tabs,.editor-list,.phone-frame',
    forbiddenText: forbiddenErrorText,
  }] : []),  ...(publicSlug ? [{ name: 'public landing direct route', url: `${baseUrl}/${publicSlug}`, viewports: 'desktop,mobile', expectedSelector: '.public-landing-shell,.public-landing-viewport,.landing-page.public-render,.landing-section.hero', forbiddenText: '\uD398\uC774\uC9C0\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4,\uD654\uBA74\uC744 \uBD88\uB7EC\uC624\uB294 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4,ApiError is not defined,Project access is required' }] : []),
];

function safeCaseName(name) {
  return name
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function parseBrowserOutput(stdout, name) {
  const text = stdout.trim();
  if (!text) return { name, ok: true, engine: '', screenshotCount: 0, screenshots: [] };
  try {
    const data = JSON.parse(text);
    const screenshots = Array.isArray(data.results)
      ? data.results.map((item) => item.screenshot).filter(Boolean)
      : [];
    return {
      name,
      ok: true,
      engine: data.engine || '',
      screenshotCount: screenshots.length,
      screenshots,
      viewports: Array.from(new Set((data.results || []).map((item) => item.viewport).filter(Boolean))),
    };
  } catch {
    return { name, ok: true, engine: '', screenshotCount: 0, screenshots: [], parseWarning: 'browser QA output was not JSON' };
  }
}

function runCase(testCase) {
  return new Promise((resolve, reject) => {
    const baseEnv = Object.fromEntries(
      Object.entries(process.env).filter(([key, value]) => key && !key.startsWith('=') && typeof value === 'string'),
    );
    const env = {
      ...baseEnv,
      INLET_BROWSER_QA_URL: testCase.url,
      INLET_BROWSER_QA_STATE_PRESET: testCase.statePreset || '',
      INLET_BROWSER_QA_VIEWPORTS: testCase.viewports || 'desktop',
      INLET_BROWSER_QA_EXPECT_TEXT: testCase.expectedText || '',
      INLET_BROWSER_QA_FORBID_TEXT: testCase.forbiddenText || '',
      INLET_BROWSER_QA_EXPECT_SELECTOR: testCase.expectedSelector || '',
      INLET_BROWSER_QA_SCREENSHOT_DIR: `.tmp-browser-visual/production-${safeCaseName(testCase.name)}`,
    };
    if (requireRealBrowser) env.INLET_BROWSER_QA_REQUIRE = '1';
    if (testCase.clickText) env.INLET_BROWSER_QA_CLICK_TEXT = testCase.clickText;
    if (testCase.clickSelector) env.INLET_BROWSER_QA_CLICK_SELECTOR = testCase.clickSelector;
    if (testCase.setInput) env.INLET_BROWSER_QA_SET_INPUT = testCase.setInput;
    if (testCase.postClickSelector) env.INLET_BROWSER_QA_POST_CLICK_SELECTOR = testCase.postClickSelector;
    if (testCase.richFormat) env.INLET_BROWSER_QA_RICH_FORMAT = testCase.richFormat;
    if (testCase.expectedComputed) env.INLET_BROWSER_QA_EXPECT_COMPUTED = testCase.expectedComputed;

    const child = spawn(process.execPath, ['scripts/browser-visual-quality-check.mjs'], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${testCase.name} failed with exit ${code}\n${stdout}\n${stderr}`));
        return;
      }
      resolve(parseBrowserOutput(stdout, testCase.name));
    });
  });
}

const results = [];
const activeCases = cases.filter((testCase) => {
  if (testCase.authenticated && !includeAuthenticatedCases) return false;
  if (testCase.mocked && !includeMockCases) return false;
  if (testCase.nextReleaseOnly && !includeNextSettingsCases) return false;
  return true;
});
const skippedCases = cases
  .filter((testCase) => (testCase.authenticated && !includeAuthenticatedCases) || (testCase.mocked && !includeMockCases) || (testCase.nextReleaseOnly && !includeNextSettingsCases))
  .map((testCase) => ({
    name: testCase.name,
    status: 'skipped-live',
    reason: testCase.authenticated && !includeAuthenticatedCases
      ? 'set INLET_PRODUCTION_QA_INCLUDE_AUTHENTICATED=1 with a valid production session strategy to enforce this case'
      : testCase.mocked && !includeMockCases
        ? 'set INLET_PRODUCTION_QA_INCLUDE_MOCKS=1 to enforce mock-only browser cases'
      : 'set INLET_PRODUCTION_QA_INCLUDE_NEXT_SETTINGS=1 after deployment to enforce this case',
  }));

for (const testCase of activeCases) {
  results.push(await runCase(testCase));
}

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  requireRealBrowser,
  includeAuthenticatedCases,
  includeMockCases,
  includeNextSettingsCases,
  includeServerSaveCase,
  publicSlug,
  activeCases: activeCases.length,
  skippedCases,
  results,
}, null, 2));
