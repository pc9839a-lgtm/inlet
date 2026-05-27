const env = process.env;

function status(name, ready, missing = [], manualCheck = '') {
  return {
    name,
    status: ready ? 'ready' : 'skipped-live',
    missing,
    manualCheck,
  };
}

function hasAll(keys = []) {
  return keys.every((key) => String(env[key] || '').trim());
}

function summarize(items = []) {
  return items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
}

const smtpKeys = ['INLET_SMTP_HOST', 'INLET_SMTP_PORT', 'INLET_SMTP_USER', 'INLET_SMTP_PASS', 'INLET_SMTP_FROM'];
const oauthKeys = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
const checks = [
  status(
    'AI live generation',
    env.INLET_AI_QA_LIVE === '1' && !!String(env.OPENAI_API_KEY || '').trim(),
    ['INLET_AI_QA_LIVE=1', 'OPENAI_API_KEY'].filter((key) => key.includes('=') ? env.INLET_AI_QA_LIVE !== '1' : !String(env[key] || '').trim()),
    'Generate one short prompt and confirm editable blocks.',
  ),
  status(
    'SMTP live delivery',
    hasAll(smtpKeys),
    smtpKeys.filter((key) => !String(env[key] || '').trim()),
    'Submit one test lead and confirm operator inbox delivery plus sent delivery log.',
  ),
  status(
    'Google OAuth consent',
    hasAll(oauthKeys),
    oauthKeys.filter((key) => !String(env[key] || '').trim()),
    'Complete consent with a test account, create one event, revoke, then verify revoked state.',
  ),
  status(
    'Conversion public diagnostics',
    !!String(env.INLET_PUBLIC_QA_URL || env.INLET_BROWSER_QA_URL || '').trim(),
    ['INLET_PUBLIC_QA_URL or INLET_BROWSER_QA_URL'].filter(() => !String(env.INLET_PUBLIC_QA_URL || env.INLET_BROWSER_QA_URL || '').trim()),
    'Run GTM/Meta/Ads/Naver/Kakao diagnostics on the public route, not editor preview.',
  ),
  status(
    'Real browser visual QA',
    !!String(env.INLET_BROWSER_QA_URL || '').trim(),
    ['INLET_BROWSER_QA_URL'].filter(() => !String(env.INLET_BROWSER_QA_URL || '').trim()),
    'Run desktop/mobile screenshots with INLET_BROWSER_QA_REQUIRE=1 when browser dependency exists.',
  ),
];

console.log(JSON.stringify({
  ok: true,
  liveSummary: summarize(checks),
  checks,
  commands: {
    ai: 'INLET_AI_QA_LIVE=1 npm run ai:qa',
    browser: 'INLET_BROWSER_QA_URL=http://localhost:5173 INLET_BROWSER_QA_REQUIRE=1 npm run browser:visual:qa',
    mock: 'npm run integration:mock:qa',
    conversion: 'npm run conversion:qa',
  },
}, null, 2));
