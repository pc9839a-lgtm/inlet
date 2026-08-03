import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import {
  evaluateConversionProductionGate,
  normalizeAllowedOrigins,
} from './conversion-production-safe-entry.mjs';
import { runConversionProductionCheck } from './conversion-production-check.mjs';

const root = process.cwd();
const read = (file) => readFile(`${root}/${file}`, 'utf8');

const [safeEntry, liveCheck, workflow, docs, packageJson, qaAll, leadIntegrations, conversionQa, envExample] = await Promise.all([
  read('scripts/conversion-production-safe-entry.mjs'),
  read('scripts/conversion-production-check.mjs'),
  read('.github/workflows/conversion-production-verify.yml'),
  read('docs/ops-conversion-production-verification.md'),
  read('package.json'),
  read('scripts/qa-all.mjs'),
  read('src/lib/leadIntegrations.js'),
  read('scripts/conversion-quality-check.mjs'),
  read('.env.example'),
]);

for (const token of [
  'https://pagero.kr',
  'PAGERO_CONVERSION_ALLOWED_ORIGINS',
  'qa-conversion-',
  'blocked-before-network',
  'INLET_CONVERSION_ORIGIN_VERIFIED',
]) assert(safeEntry.includes(token), `safe entry missing ${token}`);
assert.match(safeEntry, /parsed\.protocol !== 'https:'/);
assert.match(safeEntry, /parsed\.pathname !== '\/'/);
assert.doesNotMatch(safeEntry, /hostname\.endsWith|\*\./);

for (const token of [
  '/api/pages/',
  '?public=1',
  "redirect: 'error'",
  'APPROVED_SCRIPT_HOSTS',
  'externalAdRequestsPerformed: false',
  'customerDataIncluded: false',
  'duplicateSuppressed',
  'lead_submit',
  'reservation_submit',
]) assert(liveCheck.includes(token), `live check missing ${token}`);
assert.doesNotMatch(liveCheck, /https:\/\/(?:www\.googletagmanager\.com|connect\.facebook\.net|wcs\.naver\.net|t1\.daumcdn\.net)[^'"\s]*['"]\s*,?\s*\{/);

for (const token of [
  'workflow_dispatch',
  'environment: production',
  'PAGERO_CONVERSION_ALLOWED_ORIGINS',
  'conversion-production-evidence-${{ github.run_id }}',
  'npm run conversion:production:live',
]) assert(workflow.includes(token), `workflow missing ${token}`);
assert.doesNotMatch(workflow, /\bschedule\s*:/);
assert.doesNotMatch(workflow, /\bpush\s*:/);
assert.doesNotMatch(workflow, /\bpull_request\s*:/);
assert.match(workflow, /contents:\s*read/);
assert.match(workflow, /cancel-in-progress:\s*false/);

for (const token of [
  'Conversion Tracking Production Verification',
  'qa-conversion-',
  'lead_submit',
  'reservation_submit',
  'no advertising-platform request',
  'external platform receipt',
  'verified-live',
  'skipped-live',
]) assert(docs.includes(token), `runbook missing ${token}`);

const pkg = JSON.parse(packageJson);
assert.equal(pkg.scripts['conversion:production:live'], 'node scripts/conversion-production-safe-entry.mjs');
assert.equal(pkg.scripts['conversion:production:contract:qa'], 'node scripts/conversion-production-contract-check.mjs');
assert.match(qaAll, /conversion:production:contract:qa/);

for (const token of [
  'conversionEventPayload',
  'browser-unavailable',
  '__inletConversionEventKeys',
  "win.gtag('event', payload.event, payload)",
  "payload.event === 'reservation_submit' ? 'Schedule' : 'Lead'",
]) assert(leadIntegrations.includes(token), `conversion dispatch missing ${token}`);
assert.doesNotMatch(leadIntegrations, /lead_id:\s*lead\.id/);
assert(conversionQa.includes('conversion payload must not expose raw lead id'));
assert(conversionQa.includes('same lead conversion should be deduplicated'));

for (const token of [
  'INLET_CONVERSION_BASE_URL',
  'INLET_CONVERSION_PAGE_SLUG',
  'PAGERO_CONVERSION_ALLOWED_ORIGINS',
]) assert(envExample.includes(token), `.env.example missing ${token}`);

const allowed = normalizeAllowedOrigins('https://preview.pagero.example');
assert.deepEqual(allowed, ['https://pagero.kr', 'https://preview.pagero.example']);
assert.equal(evaluateConversionProductionGate({
  baseUrl: 'https://pagero.kr',
  allowedOrigins: allowed,
  pageSlug: 'qa-conversion-contract',
}).ok, true);
for (const baseUrl of [
  'https://attacker.example',
  'http://pagero.kr',
  'https://pagero.kr/api/pages/x',
  'https://user:pass@pagero.kr',
]) {
  assert.equal(evaluateConversionProductionGate({
    baseUrl,
    allowedOrigins: allowed,
    pageSlug: 'qa-conversion-contract',
  }).ok, false, `${baseUrl} must be blocked`);
}
assert.equal(evaluateConversionProductionGate({
  baseUrl: 'https://pagero.kr',
  allowedOrigins: allowed,
  pageSlug: 'customer-page',
}).ok, false);

const fixturePage = {
  id: 'private-page-id',
  projectId: 'private-project-id',
  slug: 'qa-conversion-contract',
  title: 'QA Conversion Contract',
  meta: {
    gtm: 'GTM-QATEST1',
    ga4: 'G-QATEST1234',
    pixel: '123456789012345',
    ads: 'AW-123456789/QA_LABEL',
  },
  integrations: {
    conversion: {
      enabled: true,
      dataLayer: true,
      metaPixel: true,
      googleAds: true,
      naver: false,
      kakao: false,
    },
  },
};

const originalFetch = globalThis.fetch;
const originalLog = console.log;
let requestedUrl = '';
let requestedInit = null;
let outputText = '';
globalThis.fetch = async (url, init = {}) => {
  requestedUrl = String(url);
  requestedInit = init;
  return {
    ok: true,
    status: 200,
    async json() {
      return { ok: true, page: fixturePage };
    },
  };
};
console.log = (value) => {
  outputText += String(value);
};
try {
  const result = await runConversionProductionCheck({
    INLET_CONVERSION_ORIGIN_VERIFIED: '1',
    INLET_CONVERSION_BASE_URL: 'https://pagero.kr',
    INLET_CONVERSION_PAGE_SLUG: 'qa-conversion-contract',
    INLET_CONVERSION_REQUIRE_LIVE: '1',
    INLET_CONVERSION_TIMEOUT_MS: '5000',
  });
  assert.equal(result.status, 'verified-live');
  assert.equal(result.writesPerformed, false);
  assert.equal(result.externalAdRequestsPerformed, false);
  assert.equal(result.identifiersIncluded, false);
  assert.equal(result.customerDataIncluded, false);
  assert.equal(result.duplicateSuppressed, true);
} finally {
  globalThis.fetch = originalFetch;
  console.log = originalLog;
}
assert.equal(requestedUrl, 'https://pagero.kr/api/pages/qa-conversion-contract?public=1');
assert.equal(requestedInit.redirect, 'error');
for (const secret of [
  'private-page-id',
  'private-project-id',
  'GTM-QATEST1',
  'G-QATEST1234',
  '123456789012345',
  'AW-123456789',
]) assert(!outputText.includes(secret), `evidence must not expose ${secret}`);

const blocked = spawnSync(process.execPath, ['scripts/conversion-production-safe-entry.mjs'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    INLET_CONVERSION_BASE_URL: 'https://attacker.example',
    INLET_CONVERSION_PAGE_SLUG: 'qa-conversion-contract',
    PAGERO_CONVERSION_ALLOWED_ORIGINS: '',
  },
});
assert.equal(blocked.status, 1);
assert.match(`${blocked.stdout}\n${blocked.stderr}`, /failed-live/);
assert.match(`${blocked.stdout}\n${blocked.stderr}`, /blocked-before-network|origin is not approved/);

console.log(JSON.stringify({
  ok: true,
  check: 'conversion-production-verification-contract',
  manualOnly: true,
  exactOriginAllowlist: true,
  publicFixtureOnly: true,
  externalAdRequestsBlocked: true,
  privacySafePayload: true,
  directGa4Events: true,
  duplicateSuppression: true,
  consultationReservationSemantics: true,
}, null, 2));
