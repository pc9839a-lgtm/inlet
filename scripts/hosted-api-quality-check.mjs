const baseUrl = String(process.env.INLET_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
const requireHosted = process.env.INLET_HOSTED_API_QA_REQUIRE === '1';
const expectD1 = process.env.INLET_HOSTED_API_EXPECT_D1 !== '0';

function summarize(checks = []) {
  return checks.reduce((acc, check) => {
    acc[check.status] = (acc[check.status] || 0) + 1;
    return acc;
  }, {});
}

function skipped(missing = []) {
  return {
    ok: true,
    liveSummary: { 'skipped-live': 1 },
    checks: [{
      name: 'Hosted API runtime',
      status: 'skipped-live',
      missing,
      manualCheck: 'Set INLET_PUBLIC_API_URL and INLET_HOSTED_API_QA_REQUIRE=1 before launch to verify /api/health and /api/admin/summary are real API routes, not the static Pages app.',
    }],
  };
}

function normalizeCheckOutput(check = {}) {
  if (!Object.prototype.hasOwnProperty.call(check, 'failureReason')) return check;
  const { failureReason, ...rest } = check;
  if (check.status === 'ready') return rest;
  return { ...rest, failureReason };
}

async function run() {
  if (!baseUrl) return skipped(['INLET_PUBLIC_API_URL']);

  const healthUrl = `${baseUrl}/api/health`;
  try {
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(8000) });
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }

    const htmlFallback = /<!doctype html|<html[\s>]/i.test(text);
    const apiOk = res.ok && payload?.ok === true && payload?.service === 'inlet-api';
    const authOk = payload?.auth?.sourceOfTruth === 'signed-session';
    const storageActive = payload?.storage?.active || '';
    const storageOk = expectD1 ? storageActive === 'd1' : ['d1', 'jsonl'].includes(storageActive);
    const coverageOk = Array.isArray(payload?.storage?.coverage) && payload.storage.coverage.length > 0;
    const ready = apiOk && authOk && storageOk && coverageOk && !htmlFallback;

    const check = normalizeCheckOutput({
      name: 'Hosted API runtime',
      status: ready ? 'ready' : 'failed-live',
      missing: [],
      url: healthUrl,
      httpStatus: res.status,
      contentType,
      failureReason: ready ? '' : htmlFallback ? 'static-pages-html-fallback' : 'health-contract-mismatch',
      health: {
        ok: payload?.ok === true,
        service: payload?.service || '',
        authSource: payload?.auth?.sourceOfTruth || '',
        storageActive,
        storageRequested: payload?.storage?.requested || '',
        coverageCount: Array.isArray(payload?.storage?.coverage) ? payload.storage.coverage.length : 0,
      },
    });
    return {
      ok: ready || !requireHosted,
      liveSummary: summarize([check]),
      checks: [check],
    };
  } catch (error) {
    const check = {
      name: 'Hosted API runtime',
      status: 'failed-live',
      missing: [],
      url: healthUrl,
      error: error?.message || String(error),
    };
    return {
      ok: !requireHosted,
      liveSummary: summarize([check]),
      checks: [check],
    };
  }
}

const result = await run();
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
