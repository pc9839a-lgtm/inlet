import { spawn } from 'node:child_process';

const baseUrl = process.env.INLET_PRODUCTION_QA_URL || 'https://inlet-8mr.pages.dev';
const requireRealBrowser = process.env.INLET_PRODUCTION_BROWSER_QA_REQUIRE === '1' || process.env.INLET_BROWSER_QA_REQUIRE === '1';

const cases = [
  {
    name: 'public home desktop',
    url: `${baseUrl}/`,
    viewports: 'desktop',
    expectedText: 'Inlet,고객이 들어오는,무료로 시작하기,WAYZI',
    forbiddenText: '화면을 불러오는 중 오류가 발생했습니다,처음 화면을 어떻게 만들까요?',
  },
  {
    name: 'public mobile guard',
    url: `${baseUrl}/`,
    viewports: 'mobile',
    expectedText: '편집은 PC에서 이용해주세요,WAYZI',
    forbiddenText: '화면을 불러오는 중 오류가 발생했습니다,처음 화면을 어떻게 만들까요?',
  },
  {
    name: 'public about route',
    url: `${baseUrl}/about`,
    viewports: 'desktop',
    expectedText: 'WAYZI',
    expectedSelector: '.wayzi-global-footer',
    forbiddenText: '화면을 불러오는 중 오류가 발생했습니다',
  },
  {
    name: 'public contact route',
    url: `${baseUrl}/contact`,
    viewports: 'desktop',
    expectedText: 'WAYZI',
    expectedSelector: '.wayzi-global-footer',
    forbiddenText: '화면을 불러오는 중 오류가 발생했습니다',
  },
  {
    name: 'public privacy route',
    url: `${baseUrl}/privacy`,
    viewports: 'desktop',
    expectedText: 'WAYZI',
    expectedSelector: '.wayzi-global-footer',
    forbiddenText: '화면을 불러오는 중 오류가 발생했습니다',
  },
  {
    name: 'public terms route',
    url: `${baseUrl}/terms`,
    viewports: 'desktop',
    expectedText: 'WAYZI',
    expectedSelector: '.wayzi-global-footer',
    forbiddenText: '화면을 불러오는 중 오류가 발생했습니다',
  },
  {
    name: 'owner edit cards',
    url: `${baseUrl}/?tab=edit`,
    statePreset: 'owner-settings',
    expectedText: '편집,브라우저 QA 페이지,카드,첫 번째 카드,두 번째 카드',
    forbiddenText: '화면을 불러오는 중 오류가 발생했습니다,처음 화면을 어떻게 만들까요?',
  },
  {
    name: 'owner start modal',
    url: `${baseUrl}/`,
    statePreset: 'owner-start-modal',
    expectedText: '처음 화면을 어떻게 만들까요?,AI 초안으로 시작,직접 만들기,템플릿으로 시작',
    forbiddenText: '화면을 불러오는 중 오류가 발생했습니다',
  },
  {
    name: 'template debt first viewport',
    url: `${baseUrl}/?tab=edit`,
    statePreset: 'template-preview:debt-relief-consult',
    expectedSelector: '.landing-page,.landing-section.topnav,.landing-section.hero,.landing-section.form',
  },
  {
    name: 'template wedding first viewport',
    url: `${baseUrl}/?tab=edit`,
    statePreset: 'template-preview:wedding-invitation',
    expectedSelector: '.landing-page,.landing-section.hero,.landing-section.form',
  },
  {
    name: 'template quote first viewport',
    url: `${baseUrl}/?tab=edit`,
    statePreset: 'template-preview:quote-request',
    expectedSelector: '.landing-page,.landing-section.topnav,.landing-section.hero,.landing-section.form,.landing-section.reservation',
  },
  {
    name: 'owner inbox',
    url: `${baseUrl}/?tab=inbox`,
    statePreset: 'owner-settings',
    expectedText: '접수 DB,CSV,초기화',
    forbiddenText: '화면을 불러오는 중 오류가 발생했습니다,처음 화면을 어떻게 만들까요?',
  },
  {
    name: 'manager stats',
    url: `${baseUrl}/?tab=stats`,
    statePreset: 'manager-limited',
    expectedText: '기간,CTA 전환,유입 채널',
    forbiddenText: '시작 방식 선택,처음 화면을 어떻게 만들까요?,매니저 권한',
  },
  {
    name: 'owner settings manager permissions',
    url: `${baseUrl}/?tab=settings`,
    statePreset: 'owner-settings',
    clickText: '매니저 권한,관리',
    expectedText: '브라우저 QA 페이지,설정,매니저 권한,빠른 권한,초대 링크 만들기',
    forbiddenText: '시작 방식 선택,처음 화면을 어떻게 만들까요?',
  },
  {
    name: 'internal admin ownership queue',
    url: `${baseUrl}/admin`,
    statePreset: 'owner-settings',
    expectedText: '내부 관리자,소유권이전 승인,새로고침',
    forbiddenText: '처음 화면을 어떻게 만들까요?,화면을 불러오는 중 오류가 발생했습니다',
  },
  {
    name: 'owner settings manager permissions compact',
    url: `${baseUrl}/?tab=settings`,
    statePreset: 'owner-settings',
    viewports: 'compact',
    clickText: '매니저 권한,관리,메뉴권한',
    expectedText: '매니저 권한,메뉴권한,편집,통계',
    expectedSelector: '.manager-access-card,.manager-card-body,.manager-permission-panel,.manager-permission-row',
    forbiddenText: '처음 화면을 어떻게 만들까요?,화면을 불러오는 중 오류가 발생했습니다',
  },
  {
    name: 'owner style text color live preview',
    url: `${baseUrl}/?tab=style`,
    statePreset: 'owner-settings',
    viewports: 'desktop',
    clickSelector: '.style-subnav button:nth-child(3)',
    setInput: '.style-card input[type="color"]=>#dc2626',
    expectedSelector: '.style-card input[type="color"],.phone-frame .landing-page',
    expectedComputed: '.phone-frame .landing-page|color|rgb(220, 38, 38)',
    forbiddenText: '泥섏쓬 ?붾㈃???대뼸寃?留뚮뱾源뚯슂?,?붾㈃??遺덈윭?ㅻ뒗 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎',
  },
  {
    name: 'owner style font tone live preview',
    url: `${baseUrl}/?tab=style`,
    statePreset: 'owner-settings',
    viewports: 'desktop',
    clickSelector: '.style-subnav button:nth-child(3),.style-panel-box .style-segment-line:nth-child(2) button:nth-child(3),.style-panel-box .style-segment-line:nth-child(3) button:nth-child(3)',
    expectedSelector: '.phone-frame .landing-page.font-bold.font-family-serif',
    forbiddenText: '泥섏쓬 ?붾㈃???대뼸寃?留뚮뱾源뚯슂?,?붾㈃??遺덈윭?ㅻ뒗 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎',
  },
  {
    name: 'manager invite acceptance',
    url: `${baseUrl}/invite/qa-visual-invite`,
    statePreset: 'invite-acceptance',
    expectedText: 'Inlet,manager@example.test',
    expectedSelector: '.auth-shell,.auth-card,.auth-form',
    forbiddenText: '화면을 불러오는 중 오류가 발생했습니다',
  },
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
      INLET_BROWSER_QA_EXPECT_TEXT: testCase.expectedText,
      INLET_BROWSER_QA_FORBID_TEXT: testCase.forbiddenText,
      INLET_BROWSER_QA_EXPECT_SELECTOR: testCase.expectedSelector || '',
      INLET_BROWSER_QA_SCREENSHOT_DIR: `.tmp-browser-visual/production-${safeCaseName(testCase.name)}`,
    };
    if (requireRealBrowser) env.INLET_BROWSER_QA_REQUIRE = '1';
    if (testCase.clickText) env.INLET_BROWSER_QA_CLICK_TEXT = testCase.clickText;
    if (testCase.clickSelector) env.INLET_BROWSER_QA_CLICK_SELECTOR = testCase.clickSelector;
    if (testCase.setInput) env.INLET_BROWSER_QA_SET_INPUT = testCase.setInput;
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
for (const testCase of cases) {
  results.push(await runCase(testCase));
}

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  requireRealBrowser,
  cases: results.map(({ name, ok, engine, screenshotCount, screenshots, viewports, parseWarning }) => ({
    name,
    ok,
    engine,
    screenshotCount,
    viewports,
    screenshots,
    ...(parseWarning ? { parseWarning } : {}),
  })),
}, null, 2));
