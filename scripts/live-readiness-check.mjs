const env = process.env;

function status(name, ready, missing = [], manualCheck = '', extra = {}) {
  return {
    name,
    status: ready ? 'ready' : 'skipped-live',
    missing,
    manualCheck,
    ...extra,
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

function normalizeBaseUrl(value = '') {
  return String(value || '').trim().replace(/\/+$/, '');
}

function hostedQaCleanupReadiness() {
  const missing = ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'].filter((key) => !String(env[key] || '').trim());
  const writeRequested = env.INLET_D1_QA_CLEANUP_WRITE === '1';
  const approvalOk = env.INLET_D1_QA_CLEANUP_APPROVAL === 'I_APPROVE_HOSTED_QA_CLEANUP';
  return status(
    'Hosted QA D1 cleanup plan',
    missing.length === 0,
    missing,
    'Run npm run d1:hosted-qa:cleanup to review test-only hosted-route-qa-* and @inlet.test rows. Write mode must stay blocked unless the operator explicitly approves cleanup.',
    {
      mode: writeRequested && approvalOk ? 'write-enabled' : 'plan-only',
      projectPrefix: 'hosted-route-qa-',
      emailDomain: 'inlet.test',
      writeGuard: 'INLET_D1_QA_CLEANUP_WRITE=1 + INLET_D1_QA_CLEANUP_APPROVAL=I_APPROVE_HOSTED_QA_CLEANUP',
    },
  );
}

async function hostedApiHealthCheck() {
  const missing = apiKeys.filter((key) => !String(env[key] || '').trim());
  const baseUrl = normalizeBaseUrl(env.INLET_PUBLIC_API_URL || '');
  if (missing.length > 0) {
    return status(
      'Hosted API health',
      false,
      missing,
      'Call GET $INLET_PUBLIC_API_URL/api/health and confirm auth.sourceOfTruth=signed-session plus storage.active=d1 or expected fallback.',
    );
  }

  const healthUrl = `${baseUrl}/api/health`;
  try {
    const res = await fetch(healthUrl, {
      signal: AbortSignal.timeout(5000),
      headers: env.INLET_API_TOKEN ? { Authorization: `Bearer ${env.INLET_API_TOKEN}` } : {},
    });
    const payload = await res.json().catch(() => null);
    const sourceOk = payload?.auth?.sourceOfTruth === 'signed-session';
    const storageOk = ['d1', 'jsonl'].includes(payload?.storage?.active);
    const coverageOk = Array.isArray(payload?.storage?.coverage) && payload.storage.coverage.length > 0;
    const ready = res.ok && payload?.ok === true && sourceOk && storageOk && coverageOk;
    return {
      name: 'Hosted API health',
      status: ready ? 'ready' : 'failed-live',
      missing: [],
      manualCheck: 'Hosted API responded, but launch requires signed-session auth and storage coverage in /api/health.',
      url: healthUrl,
      httpStatus: res.status,
      health: {
        ok: payload?.ok === true,
        authSource: payload?.auth?.sourceOfTruth || '',
        storageActive: payload?.storage?.active || '',
        coverageCount: Array.isArray(payload?.storage?.coverage) ? payload.storage.coverage.length : 0,
      },
    };
  } catch (error) {
    return {
      name: 'Hosted API health',
      status: 'failed-live',
      missing: [],
      manualCheck: 'Hosted API URL is configured but /api/health is unreachable.',
      url: healthUrl,
      error: error?.message || String(error),
    };
  }
}

const sesKeys = ['INLET_AUTH_EMAIL_MODE=api or ses', 'INLET_EMAIL_PROVIDER=ses', 'AWS_SES_REGION', 'AWS_SES_ACCESS_KEY_ID', 'AWS_SES_SECRET_ACCESS_KEY', 'INLET_AUTH_EMAIL_FROM'];
const oauthKeys = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
const apiKeys = ['INLET_PUBLIC_API_URL'];
const checks = [
  await hostedApiHealthCheck(),
  status(
    'Cloudflare D1 live schema',
    env.INLET_D1_LIVE_QA === '1' && hasAll(['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN']),
    [
      env.INLET_D1_LIVE_QA === '1' ? '' : 'INLET_D1_LIVE_QA=1',
      env.CLOUDFLARE_ACCOUNT_ID ? '' : 'CLOUDFLARE_ACCOUNT_ID',
      env.CLOUDFLARE_API_TOKEN ? '' : 'CLOUDFLARE_API_TOKEN',
    ].filter(Boolean),
    'Run npm run d1:live:qa to confirm inlet-prod table schema and basic counts through the Cloudflare D1 API.',
  ),
  hostedQaCleanupReadiness(),
  status(
    'AI live generation',
    env.INLET_AI_QA_LIVE === '1' && !!String(env.OPENAI_API_KEY || '').trim(),
    ['INLET_AI_QA_LIVE=1', 'OPENAI_API_KEY'].filter((key) => key.includes('=') ? env.INLET_AI_QA_LIVE !== '1' : !String(env[key] || '').trim()),
    'Generate one short prompt and confirm editable blocks.',
  ),
  status(
    'AWS SES auth email delivery',
    ['api', 'ses'].includes(env.INLET_AUTH_EMAIL_MODE) && env.INLET_EMAIL_PROVIDER === 'ses' && hasAll(['AWS_SES_REGION', 'AWS_SES_ACCESS_KEY_ID', 'AWS_SES_SECRET_ACCESS_KEY', 'INLET_AUTH_EMAIL_FROM']),
    sesKeys.filter((key) => {
      if (key === 'INLET_AUTH_EMAIL_MODE=api or ses') return !['api', 'ses'].includes(env.INLET_AUTH_EMAIL_MODE);
      if (key === 'INLET_EMAIL_PROVIDER=ses') return env.INLET_EMAIL_PROVIDER !== 'ses';
      return !String(env[key] || '').trim();
    }),
    'Send one auth verification email through SES and confirm no verification token is exposed in the browser response.',
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
    api: 'INLET_PUBLIC_API_URL=https://api.example.com npm run live:qa',
    hostedApi: 'INLET_PUBLIC_API_URL=https://api.example.com INLET_HOSTED_API_QA_REQUIRE=1 npm run api:hosted:qa',
    d1: 'INLET_D1_LIVE_QA=1 npm run d1:live:qa',
    hostedQaCleanup: 'npm run d1:hosted-qa:cleanup',
    browser: 'INLET_BROWSER_QA_URL=http://localhost:5173 INLET_BROWSER_QA_REQUIRE=1 npm run browser:visual:qa',
    mock: 'npm run integration:mock:qa',
    conversion: 'npm run conversion:qa',
  },
}, null, 2));
