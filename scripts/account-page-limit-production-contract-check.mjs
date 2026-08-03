import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import {
  createOriginLockedFetch,
  evaluateLaunchGate,
  normalizeAllowedOrigins,
} from './account-page-limit-production-safe-entry.mjs';
import {
  compareFixtureBaselines,
  findQaResidue,
  pageIdentityDigest,
} from './account-page-limit-production-runner.mjs';

const [script, safeEntry, runner, workflow, runbook, packageJson, qaAll] = await Promise.all([
  readFile('scripts/account-page-limit-production-check.mjs', 'utf8'),
  readFile('scripts/account-page-limit-production-safe-entry.mjs', 'utf8'),
  readFile('scripts/account-page-limit-production-runner.mjs', 'utf8'),
  readFile('.github/workflows/account-page-limit-production-verify.yml', 'utf8'),
  readFile('docs/ops-account-page-limit-production-verification.md', 'utf8'),
  readFile('package.json', 'utf8'),
  readFile('scripts/qa-all.mjs', 'utf8'),
]);

for (const token of [
  'INLET_ACCOUNT_PAGE_LIMIT_EMPTY_GENERAL_SESSION',
  'INLET_ACCOUNT_PAGE_LIMIT_OCCUPIED_GENERAL_SESSION',
  'INLET_ACCOUNT_PAGE_LIMIT_ARCHIVED_GENERAL_SESSION',
  'INLET_ACCOUNT_PAGE_LIMIT_PLATFORM_MASTER_SESSION',
  'INLET_ACCOUNT_PAGE_LIMIT_GOOGLE_SESSION',
  'INLET_ACCOUNT_PAGE_LIMIT_MANAGER_SESSION',
  'INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE',
  'INLET_ACCOUNT_PAGE_LIMIT_LIVE_REQUIRE',
  "status: 'skipped-live'",
  "status: 'verified-live'",
  "status: 'failed-live'",
  "data.code !== 'ACCOUNT_PAGE_LIMIT_REACHED'",
  'expectedPlatformMaster',
  "saveMode: 'update-existing'",
  '/revisions?',
  '/restore',
  '?public=1&fresh=',
  'expectedStatus === 409',
  '[403, 409].includes',
  'cleanupQueue.splice(0).reverse()',
  'qa-limit-',
]) assert(script.includes(token), `live account page-limit script missing contract token: ${token}`);

assert(!script.includes('console.log(session)'), 'live verification must never print a session secret');
assert(!script.includes('Authorization: `Bearer ${session}`'), 'signed sessions must not be copied into Authorization logs');
assert(script.includes("'X-Inlet-Session': session"), 'live verification must authenticate with X-Inlet-Session');
assert(script.indexOf('if (missingSessions.length || !allowWrites)') < script.indexOf("await sessionSnapshot('empty-general'"), 'write and fixture gates must run before any live request');

for (const token of [
  "const DEFAULT_ALLOWED_ORIGINS = ['https://pagero.kr']",
  'I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES',
  'PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS',
  "parsed.protocol !== 'https:'",
  'parsed.username || parsed.password',
  "parsed.pathname !== '/'",
  'target origin is not in PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS',
  'INLET_ACCOUNT_PAGE_LIMIT_LIVE_APPROVAL',
  'createOriginLockedFetch',
  'cross-origin request blocked before signed session transmission',
  "redirect: 'error'",
  'globalThis.fetch = createOriginLockedFetch',
  'await import(pathToFileURL(checker).href)',
  'secretValuesIncluded: false',
]) assert(safeEntry.includes(token), `safe live entry missing contract token: ${token}`);
assert(!safeEntry.includes('console.log(process.env)'), 'safe entry must never print its environment');
assert(!safeEntry.includes('PAGERO_PAGE_LIMIT_EMPTY_GENERAL_SESSION:'), 'safe entry must not copy session values into evidence');

for (const token of [
  'pageIdentityDigest',
  'findQaResidue',
  'compareFixtureBaselines',
  'duplicateSessionLabels',
  'assertFixtureIsolation',
  'stale qa-limit pages exist before verification',
  'captureFixtureState',
  'restoreFixtureIntegrity',
  'integrity cleanup refused a non-QA page',
  'cleanupAttempted',
  'residueBefore',
  'residueAfter',
  'baselineComparison',
  'fixtureOwnersIsolated: true',
  'secretValuesIncluded: false',
  'account-page-limit-production-check.mjs',
  'createOriginLockedFetch',
]) assert(runner.includes(token), `integrity runner missing contract token: ${token}`);
assert(!runner.includes('console.log(process.env)'), 'integrity runner must never print its environment');
assert(!runner.includes('runtimeSessions:'), 'integrity evidence must not serialize runtime sessions');
assert(runner.indexOf('assertFixtureShape(baseline.pages)') < runner.indexOf('const checker = await runChecker()'), 'preflight residue and fixture checks must run before the write checker');
assert(runner.indexOf('const checker = await runChecker()') < runner.indexOf('restoreFixtureIntegrity'), 'postflight restoration must run after the write checker');

const stableBaseline = {
  emptyGeneral: [],
  occupiedGeneral: [{ id: 'page-a', projectId: 'project-a', slug: 'fixture-a' }],
};
assert.equal(pageIdentityDigest(stableBaseline.occupiedGeneral).count, 1);
assert.equal(compareFixtureBaselines(stableBaseline, stableBaseline).ok, true);
assert.equal(compareFixtureBaselines(stableBaseline, {
  ...stableBaseline,
  occupiedGeneral: [{ id: 'page-b', projectId: 'project-a', slug: 'fixture-a' }],
}).ok, false, 'identity changes must fail restoration even when page count is unchanged');
assert.deepEqual(findQaResidue({
  emptyGeneral: [{ id: 'qa', projectId: 'qa', slug: 'qa-limit-leftover' }],
  occupiedGeneral: stableBaseline.occupiedGeneral,
}), { total: 1, labels: { emptyGeneral: 1 } });

const allowedOrigins = normalizeAllowedOrigins('https://preview.pagero.example');
assert.deepEqual(allowedOrigins, ['https://pagero.kr', 'https://preview.pagero.example']);
assert.equal(evaluateLaunchGate({
  baseUrl: 'https://pagero.kr',
  allowedOrigins,
  writeEnabled: true,
  approval: 'I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES',
}).ok, true);
for (const baseUrl of [
  'https://attacker.example',
  'http://pagero.kr',
  'https://pagero.kr/api',
  'https://pagero.kr?next=https://attacker.example',
  'https://user:password@pagero.kr',
]) {
  assert.equal(evaluateLaunchGate({
    baseUrl,
    allowedOrigins,
    writeEnabled: true,
    approval: 'I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES',
  }).ok, false, `${baseUrl} must be blocked`);
}
assert.equal(evaluateLaunchGate({
  baseUrl: 'https://pagero.kr',
  allowedOrigins,
  writeEnabled: true,
  approval: 'wrong',
}).ok, false);

let capturedInit = null;
const lockedFetch = createOriginLockedFetch('https://pagero.kr', async (_input, init) => {
  capturedInit = init;
  return { ok: true, status: 200 };
});
await lockedFetch('https://pagero.kr/api/auth/session', { redirect: 'follow' });
assert.equal(capturedInit.redirect, 'error', 'redirect following must be disabled');
await assert.rejects(
  () => lockedFetch('https://attacker.example/collect'),
  /cross-origin request blocked/,
);

for (const token of [
  'workflow_dispatch:',
  'allow_writes:',
  'approval_phrase:',
  'require_live:',
  'environment: production',
  "INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE: ${{ inputs.allow_writes && '1' || '0' }}",
  'INLET_ACCOUNT_PAGE_LIMIT_LIVE_APPROVAL: ${{ inputs.approval_phrase }}',
  'PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS',
  'PAGERO_PAGE_LIMIT_EMPTY_GENERAL_SESSION',
  'PAGERO_PAGE_LIMIT_OCCUPIED_GENERAL_SESSION',
  'PAGERO_PAGE_LIMIT_ARCHIVED_GENERAL_SESSION',
  'PAGERO_PAGE_LIMIT_PLATFORM_MASTER_SESSION',
  'PAGERO_PAGE_LIMIT_GOOGLE_SESSION',
  'PAGERO_PAGE_LIMIT_MANAGER_SESSION',
  'node scripts/account-page-limit-production-runner.mjs',
  'fixture restoration',
  'account-page-limit-production-evidence-${{ github.run_id }}',
  'retention-days: 30',
]) assert(workflow.includes(token), `account page-limit workflow missing contract token: ${token}`);
assert(!/^\s*schedule:/m.test(workflow), 'production write verification must remain manual');
assert(workflow.includes('permissions:\n  contents: read'), 'workflow must use read-only repository permissions');
assert(!workflow.includes('node scripts/account-page-limit-production-check.mjs | tee'), 'workflow must not bypass the integrity runner');

for (const token of [
  'Use dedicated QA accounts only',
  'Never use a real customer account',
  'skipped-live',
  'verified-live',
  'qa-limit-*',
  'Manager creation returning `200`',
  'cleanup confirmation',
  'PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS',
  'I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES',
  'exact HTTPS origin',
  'session exfiltration',
  'preflight residue scan',
  'baseline digest',
  'postflight restoration',
]) assert(runbook.includes(token), `runbook missing safety detail: ${token}`);

assert(packageJson.includes('"account:page-limit:live": "node scripts/account-page-limit-production-runner.mjs"'));
assert(packageJson.includes('"account:page-limit:live:contract:qa"'));
assert(qaAll.includes("['account:page-limit:live:contract:qa', ['scripts/account-page-limit-production-contract-check.mjs']]"));

function runScript(file, env) {
  return spawnSync(process.execPath, [file], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

const emptySessions = {
  INLET_ACCOUNT_PAGE_LIMIT_EMPTY_GENERAL_SESSION: '',
  INLET_ACCOUNT_PAGE_LIMIT_OCCUPIED_GENERAL_SESSION: '',
  INLET_ACCOUNT_PAGE_LIMIT_ARCHIVED_GENERAL_SESSION: '',
  INLET_ACCOUNT_PAGE_LIMIT_PLATFORM_MASTER_SESSION: '',
  INLET_ACCOUNT_PAGE_LIMIT_GOOGLE_SESSION: '',
  INLET_ACCOUNT_PAGE_LIMIT_MANAGER_SESSION: '',
};
const skipped = runScript('scripts/account-page-limit-production-check.mjs', {
  ...emptySessions,
  INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE: '0',
  INLET_ACCOUNT_PAGE_LIMIT_LIVE_REQUIRE: '0',
});
assert.equal(skipped.status, 0, skipped.stderr);
assert.match(skipped.stdout, /"status": "skipped-live"/);
assert.doesNotMatch(skipped.stdout, /verified-live/);

const required = runScript('scripts/account-page-limit-production-check.mjs', {
  ...emptySessions,
  INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE: '0',
  INLET_ACCOUNT_PAGE_LIMIT_LIVE_REQUIRE: '1',
});
assert.equal(required.status, 1);
assert.match(required.stdout, /"status": "skipped-live"/);

const fakeSession = 'SIGNED_SESSION_MUST_NOT_APPEAR';
const blockedOrigin = runScript('scripts/account-page-limit-production-runner.mjs', {
  INLET_ACCOUNT_PAGE_LIMIT_BASE_URL: 'https://attacker.example',
  INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE: '1',
  INLET_ACCOUNT_PAGE_LIMIT_LIVE_APPROVAL: 'I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES',
  INLET_ACCOUNT_PAGE_LIMIT_LIVE_REQUIRE: '1',
  PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS: '',
  INLET_ACCOUNT_PAGE_LIMIT_EMPTY_GENERAL_SESSION: fakeSession,
  INLET_ACCOUNT_PAGE_LIMIT_OCCUPIED_GENERAL_SESSION: `${fakeSession}-2`,
  INLET_ACCOUNT_PAGE_LIMIT_ARCHIVED_GENERAL_SESSION: `${fakeSession}-3`,
  INLET_ACCOUNT_PAGE_LIMIT_PLATFORM_MASTER_SESSION: `${fakeSession}-4`,
  INLET_ACCOUNT_PAGE_LIMIT_GOOGLE_SESSION: `${fakeSession}-5`,
  INLET_ACCOUNT_PAGE_LIMIT_MANAGER_SESSION: `${fakeSession}-6`,
});
const blockedOutput = `${blockedOrigin.stdout}\n${blockedOrigin.stderr}`;
assert.equal(blockedOrigin.status, 1);
assert.match(blockedOutput, /"status": "failed-live"/);
assert.match(blockedOutput, /not in PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS/);
assert.doesNotMatch(blockedOutput, new RegExp(fakeSession));

const missingApproval = runScript('scripts/account-page-limit-production-runner.mjs', {
  ...emptySessions,
  INLET_ACCOUNT_PAGE_LIMIT_BASE_URL: 'https://pagero.kr',
  INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE: '1',
  INLET_ACCOUNT_PAGE_LIMIT_LIVE_APPROVAL: '',
  INLET_ACCOUNT_PAGE_LIMIT_LIVE_REQUIRE: '0',
  PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS: '',
});
assert.equal(missingApproval.status, 0);
assert.match(missingApproval.stdout, /"status": "skipped-live"/);

const duplicateSessions = runScript('scripts/account-page-limit-production-runner.mjs', {
  INLET_ACCOUNT_PAGE_LIMIT_BASE_URL: 'https://pagero.kr',
  INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE: '1',
  INLET_ACCOUNT_PAGE_LIMIT_LIVE_APPROVAL: 'I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES',
  INLET_ACCOUNT_PAGE_LIMIT_LIVE_REQUIRE: '1',
  PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS: '',
  INLET_ACCOUNT_PAGE_LIMIT_EMPTY_GENERAL_SESSION: fakeSession,
  INLET_ACCOUNT_PAGE_LIMIT_OCCUPIED_GENERAL_SESSION: fakeSession,
  INLET_ACCOUNT_PAGE_LIMIT_ARCHIVED_GENERAL_SESSION: `${fakeSession}-3`,
  INLET_ACCOUNT_PAGE_LIMIT_PLATFORM_MASTER_SESSION: `${fakeSession}-4`,
  INLET_ACCOUNT_PAGE_LIMIT_GOOGLE_SESSION: `${fakeSession}-5`,
  INLET_ACCOUNT_PAGE_LIMIT_MANAGER_SESSION: `${fakeSession}-6`,
});
assert.equal(duplicateSessions.status, 1);
assert.match(`${duplicateSessions.stdout}\n${duplicateSessions.stderr}`, /fixture sessions must be unique/);
assert.doesNotMatch(`${duplicateSessions.stdout}\n${duplicateSessions.stderr}`, new RegExp(fakeSession));

console.log(JSON.stringify({
  ok: true,
  contract: 'account-page-limit-production-verification',
  manualOnly: true,
  liveStatuses: ['skipped-live', 'verified-live', 'failed-live'],
  fixtures: 6,
  fixtureIntegrity: [
    'unique-session-gate',
    'isolated-owner-gate',
    'preflight-residue-block',
    'baseline-identity-digest',
    'postflight-residue-cleanup',
    'postflight-baseline-restoration',
  ],
  securityGates: [
    'exact-https-origin-allowlist',
    'no-path-query-fragment',
    'no-url-credentials',
    'explicit-write-approval-phrase',
    'production-environment',
    'same-origin-request-lock',
    'redirect-following-disabled',
    'session-exfiltration-block',
  ],
}, null, 2));
