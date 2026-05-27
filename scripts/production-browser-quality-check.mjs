import { spawn } from 'node:child_process';

const baseUrl = process.env.INLET_PRODUCTION_QA_URL || 'https://inlet-8mr.pages.dev';
const requireRealBrowser = process.env.INLET_PRODUCTION_BROWSER_QA_REQUIRE === '1';

const cases = [
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
];

function runCase(testCase) {
  return new Promise((resolve, reject) => {
    const baseEnv = Object.fromEntries(
      Object.entries(process.env).filter(([key, value]) => key && !key.startsWith('=') && typeof value === 'string'),
    );
    const env = {
      ...baseEnv,
      INLET_BROWSER_QA_URL: testCase.url,
      INLET_BROWSER_QA_STATE_PRESET: testCase.statePreset,
      INLET_BROWSER_QA_VIEWPORTS: 'desktop',
      INLET_BROWSER_QA_EXPECT_TEXT: testCase.expectedText,
      INLET_BROWSER_QA_FORBID_TEXT: testCase.forbiddenText,
    };
    if (requireRealBrowser) env.INLET_BROWSER_QA_REQUIRE = '1';
    if (testCase.clickText) env.INLET_BROWSER_QA_CLICK_TEXT = testCase.clickText;

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
      resolve({ name: testCase.name, ok: true, output: stdout.trim() });
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
  cases: results.map(({ name, ok }) => ({ name, ok })),
}, null, 2));
