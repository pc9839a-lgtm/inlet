import { spawn } from 'node:child_process';

const baseUrl = process.env.INLET_PRODUCTION_QA_URL || 'https://pagero.kr';
const requireRealBrowser = process.env.INLET_PRODUCTION_BROWSER_QA_REQUIRE === '1' || process.env.INLET_BROWSER_QA_REQUIRE === '1';
const includeAuthenticatedCases = process.env.INLET_PRODUCTION_QA_INCLUDE_AUTHENTICATED === '1';
const includeMockCases = process.env.INLET_PRODUCTION_QA_INCLUDE_MOCKS === '1';
const includeNextSettingsCases = process.env.INLET_PRODUCTION_QA_INCLUDE_NEXT_SETTINGS === '1';
const publicSlug = String(process.env.INLET_PRODUCTION_QA_PUBLIC_SLUG || '').trim();

const forbiddenErrorText = [
  '화면을 불러오는 중 오류가 발생했습니다',
  'Failed to fetch dynamically imported module',
  'ApiError is not defined',
  'Project access is required',
  'Page not found',
  '페이지를 찾을 수 없습니다',
].join(',');

const cases = [
  {
    name: 'public home desktop',
    url: `${baseUrl}/`,
    viewports: 'desktop',
    expectedText: '페이지로,고객이 들어오는,무료로 시작하기,WAYZI',
    forbiddenText: forbiddenErrorText,
  },
  {
    name: 'public home mobile guard',
    url: `${baseUrl}/`,
    viewports: 'mobile',
    expectedText: '편집은 PC에서 이용해주세요,WAYZI',
    forbiddenText: forbiddenErrorText,
  },
  {
    name: 'public about route',
    url: `${baseUrl}/about`,
    viewports: 'desktop',
    expectedText: '사이트 소개,WAYZI',
    expectedSelector: '.wayzi-global-footer',
    forbiddenText: forbiddenErrorText,
  },
  {
    name: 'public contact route',
    url: `${baseUrl}/contact`,
    viewports: 'desktop',
    expectedText: '문의하기,WAYZI',
    expectedSelector: '.wayzi-global-footer',
    forbiddenText: forbiddenErrorText,
  },
  {
    name: 'public privacy route',
    url: `${baseUrl}/privacy`,
    viewports: 'desktop',
    expectedText: '개인정보처리방침,WAYZI',
    expectedSelector: '.wayzi-global-footer',
    forbiddenText: forbiddenErrorText,
  },
  {
    name: 'public terms route',
    url: `${baseUrl}/terms`,
    viewports: 'desktop',
    expectedText: '이용약관,WAYZI',
    expectedSelector: '.wayzi-global-footer',
    forbiddenText: forbiddenErrorText,
  },
  {
    name: 'owner edit cards',
    authenticated: true,
    url: `${baseUrl}/?tab=edit`,
    statePreset: 'owner-settings',
    expectedText: '편집,브라우저 QA 페이지,카드,첫 번째 카드,두 번째 카드',
    forbiddenText: forbiddenErrorText,
  },
  {
    name: 'owner start modal',
    authenticated: true,
    url: `${baseUrl}/`,
    statePreset: 'owner-start-modal',
    expectedText: '처음 화면을 어떻게 만들까요,AI 초안으로 시작,직접 만들기,템플릿으로 시작',
    forbiddenText: '화면을 불러오는 중 오류가 발생했습니다,Failed to fetch dynamically imported module,ApiError is not defined',
  },
  {
    name: 'template debt first viewport',
    authenticated: true,
    url: `${baseUrl}/?tab=edit`,
    statePreset: 'template-preview:debt-relief-consult',
    expectedSelector: '.landing-page,.landing-section.topnav,.landing-section.hero,.landing-section.form',
    forbiddenText: forbiddenErrorText,
  },
  {
    name: 'template wedding first viewport',
    authenticated: true,
    url: `${baseUrl}/?tab=edit`,
    statePreset: 'template-preview:wedding-invitation',
    expectedSelector: '.landing-page,.landing-section.hero,.landing-section.form',
    forbiddenText: forbiddenErrorText,
  },
  {
    name: 'template real-estate first viewport',
    authenticated: true,
    url: `${baseUrl}/?tab=edit`,
    statePreset: 'template-preview:quote-request',
    expectedSelector: '.landing-page,.landing-section.topnav,.landing-section.hero,.landing-section.form,.landing-section.reservation',
    forbiddenText: forbiddenErrorText,
  },
  {
    name: 'owner inbox',
    authenticated: true,
    url: `${baseUrl}/?tab=inbox`,
    statePreset: 'owner-settings',
    expectedText: '접수함,CSV,초기화',
    forbiddenText: forbiddenErrorText,
  },
  {
    name: 'manager stats',
    authenticated: true,
    url: `${baseUrl}/?tab=stats`,
    statePreset: 'manager-limited',
    expectedText: '기간 통계,유입 채널,전환율',
    expectedSelector: '.stats-panel,.stats-channel-filter',
    forbiddenText: '시작 방식 선택,처음 화면을 어떻게 만들까요,매니저 권한,화면을 불러오는 중 오류가 발생했습니다,ApiError is not defined',
  },
  {
    name: 'owner settings manager permissions',
    authenticated: true,
    url: `${baseUrl}/?tab=settings`,
    statePreset: 'owner-settings',
    expectedText: '브라우저 QA 페이지,설정,매니저 권한',
    expectedSelector: '.settings-panel,.manager-access-card,.manager-access-card .settings-section-head',
    forbiddenText: '시작 방식 선택,처음 화면을 어떻게 만들까요,화면을 불러오는 중 오류가 발생했습니다,ApiError is not defined',
  },
  {
    name: 'internal admin ownership queue',
    authenticated: true,
    url: `${baseUrl}/admin`,
    statePreset: 'owner-settings',
    expectedText: '내부 관리자,소유권이전 승인,새로고침',
    forbiddenText: '처음 화면을 어떻게 만들까요,화면을 불러오는 중 오류가 발생했습니다,ApiError is not defined',
  },
  {
    name: 'owner settings manager permissions compact',
    authenticated: true,
    url: `${baseUrl}/?tab=settings`,
    statePreset: 'owner-settings',
    viewports: 'compact',
    expectedText: '매니저 권한',
    expectedSelector: '.manager-access-card,.manager-access-card .settings-section-head',
    forbiddenText: '처음 화면을 어떻게 만들까요,화면을 불러오는 중 오류가 발생했습니다,ApiError is not defined',
  },
  {
    name: 'owner style text color live preview',
    authenticated: true,
    url: `${baseUrl}/?tab=style`,
    statePreset: 'owner-settings',
    viewports: 'desktop',
    clickSelector: '.style-subnav button:nth-child(3)',
    setInput: '.style-card input[type="color"]=>#dc2626',
    expectedSelector: '.style-card input[type="color"],.phone-frame .landing-page',
    expectedComputed: '.phone-frame .landing-page|color|rgb(220, 38, 38)',
    forbiddenText: '화면을 불러오는 중 오류가 발생했습니다,ApiError is not defined',
  },
  {
    name: 'owner style font tone live preview',
    authenticated: true,
    url: `${baseUrl}/?tab=style`,
    statePreset: 'owner-settings',
    viewports: 'desktop',
    clickSelector: '.style-subnav button:nth-child(3),.style-panel-box .style-segment-line:nth-child(2) button:nth-child(3),.style-panel-box .style-segment-line:nth-child(3) button:nth-child(3)',
    expectedSelector: '.phone-frame .landing-page.font-bold.font-family-serif',
    forbiddenText: '화면을 불러오는 중 오류가 발생했습니다,ApiError is not defined',
  },
  {
    name: 'owner rich text bold underline toolbar',
    authenticated: true,
    url: `${baseUrl}/?tab=edit`,
    statePreset: 'owner-settings',
    viewports: 'desktop',
    expectedSelector: '.rich-field-wysiwyg .rich-editor',
    richFormat: '.rich-field-wysiwyg:nth-of-type(1) .rich-editor|.rich-field-wysiwyg:nth-of-type(1) .rich-head button:nth-child(1)|<strong>||<b>||font-weight: bold||font-weight: 700;.rich-field-wysiwyg:nth-of-type(1) .rich-editor|.rich-field-wysiwyg:nth-of-type(1) .rich-head button:nth-child(2)|<u>||text-decoration',
    forbiddenText: '화면을 불러오는 중 오류가 발생했습니다,ApiError is not defined',
  },
  {
    name: 'manager invite acceptance',
    mocked: true,
    url: `${baseUrl}/invite/qa-visual-invite`,
    statePreset: 'invite-acceptance',
    expectedText: '페이지로,manager@example.test',
    expectedSelector: '.auth-shell,.auth-card,.auth-form',
    forbiddenText: forbiddenErrorText,
  },
  {
    name: 'owner inbox duplicate policy',
    authenticated: true,
    nextReleaseOnly: true,
    url: `${baseUrl}/?tab=inbox`,
    statePreset: 'owner-settings',
    viewports: 'desktop',
    clickSelector: '.inbox-policy-head',
    expectedText: '중복 접수 차단,IP 중복 차단,쿠키 중복 차단,차단 내역',
    expectedSelector: '.inbox-policy-card,.inbox-policy-grid,.inbox-policy-select,.inbox-policy-history',
    forbiddenText: '화면을 불러오는 중 오류가 발생했습니다,ApiError is not defined',
  },
  {
    name: 'owner settings page duplication modal',
    authenticated: true,
    nextReleaseOnly: true,
    url: `${baseUrl}/?tab=settings`,
    statePreset: 'owner-settings',
    viewports: 'desktop',
    clickSelector: '.page-duplicate-summary button',
    expectedText: '설정,고급 설정,URL 설정,기본 제공 도메인,페이지 복제',
    expectedSelector: '.settings-panel,.page-duplicate-summary button,.settings-url-modal',
    forbiddenText: '화면을 불러오는 중 오류가 발생했습니다,ApiError is not defined',
  },
  ...(publicSlug ? [{
    name: 'public landing direct route',
    url: `${baseUrl}/${publicSlug}`,
    viewports: 'desktop,mobile',
    expectedSelector: '.public-landing-shell,.public-landing-viewport,.landing-page.public-render,.landing-section.hero',
    forbiddenText: '페이지를 찾을 수 없습니다,화면을 불러오는 중 오류가 발생했습니다,ApiError is not defined,Project access is required',
  }] : []),
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
  publicSlug,
  activeCases: activeCases.length,
  skippedCases,
  results,
}, null, 2));
