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

const files = await Promise.all([
  'scripts/account-page-limit-production-check.mjs',
  'scripts/account-page-limit-production-safe-entry.mjs',
  'scripts/account-page-limit-production-runner.mjs',
  '.github/workflows/account-page-limit-production-verify.yml',
  'docs/ops-account-page-limit-production-verification.md',
  'package.json',
  'scripts/qa-all.mjs',
].map((file) => readFile(file, 'utf8')));
const [checker, safeEntry, runner, workflow, runbook, packageJson, qaAll] = files;

function requireTokens(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label} missing contract token: ${token}`);
}

requireTokens(checker, [
  'INLET_ACCOUNT_PAGE_LIMIT_EMPTY_GENERAL_SESSION',
  'INLET_ACCOUNT_PAGE_LIMIT_OCCUPIED_GENERAL_SESSION',
  'INLET_ACCOUNT_PAGE_LIMIT_ARCHIVED_GENERAL_SESSION',
  'INLET_ACCOUNT_PAGE_LIMIT_PLATFORM_MASTER_SESSION',
  'INLET_ACCOUNT_PAGE_LIMIT_GOOGLE_SESSION',
  'INLET_ACCOUNT_PAGE_LIMIT_MANAGER_SESSION',
  "status: 'skipped-live'",
  "status: 'verified-live'",
  "status: 'failed-live'",
  "data.code !== 'ACCOUNT_PAGE_LIMIT_REACHED'",
  "saveMode: 'update-existing'",
  '/revisions?',
  '/restore',
  '?public=1&fresh=',
  '[403, 409].includes',
  'cleanupQueue.splice(0).reverse()',
  'qa-limit-',
], 'live checker');
assert(checker.indexOf('if (missingSessions.length || !allowWrites)') < checker.indexOf("await sessionSnapshot('empty-general'"));
assert(!checker.includes('console.log(session)'));

requireTokens(safeEntry, [
  "const DEFAULT_ALLOWED_ORIGINS = ['https://pagero.kr']",
  'I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES',
  'PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS',
  "parsed.protocol !== 'https:'",
  'parsed.username || parsed.password',
  "parsed.pathname !== '/'",
  'createOriginLockedFetch',
  'cross-origin request blocked before signed session transmission',
  "redirect: 'error'",
  'secretValuesIncluded: false',
], 'safe entry');
assert(!safeEntry.includes('console.log(process.env)'));

requireTokens(runner, [
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
], 'integrity runner');
assert(!runner.includes('console.log(process.env)'));
assert(!runner.includes('runtimeSessions:'));
assert(runner.indexOf('assertFixtureShape(baseline.pages)') < runner.indexOf('const checker = await runChecker()'));
assert(runner.indexOf('const checker = await runChecker()') < runner.indexOf('postflight = await restoreFixtureIntegrity'));

const baseline = {
  emptyGeneral: [],
  occupiedGeneral: [{ id: 'page-a', projectId: 'project-a', slug: 'fixture-a' }],
};
assert.equal(pageIdentityDigest(baseline.occupiedGeneral).count, 1);
assert.equal(compareFixtureBaselines(baseline, baseline).ok, true);
assert.equal(compareFixtureBaselines(baseline, {
  ...baseline,
  occupiedGeneral: [{ id: 'page-b', projectId: 'project-a', slug: 'fixture-a' }],
}).ok, false);
assert.deepEqual(findQaResidue({
  emptyGeneral: [{ id: 'qa', projectId: 'qa', slug: 'qa-limit-leftover' }],
  occupiedGeneral: baseline.occupiedGeneral,
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

let capturedInit;
const lockedFetch = createOriginLockedFetch('https://pagero.kr', async (_input, init) => {
  capturedInit = init;
  return { ok: true, status: 200 };
});
await lockedFetch('https://pagero.kr/api/auth/session', { redirect: 'follow' });
assert.equal(capturedInit.redirect, 'error');
await assert.rejects(() => lockedFetch('https://attacker.example/collect'), /cross-origin request blocked/);

requireTokens(workflow, [
  'workflow_dispatch:',
  'allow_writes:',
  'approval_phrase:',
  'require_live:',
  'environment: production',
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
], 'workflow');
assert(!/^\s*schedule:/m.test(workflow));
assert(workflow.includes('permissions:\n  contents: read'));
assert(!workflow.includes('node scripts/account-page-limit-production-check.mjs | tee'));

requireTokens(runbook, [
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
], 'runbook');
assert(packageJson.includes('"account:page-limit:live": "node scripts/account-page-limit-production-runner.mjs"'));
assert(qaAll.includes("['account:page-limit:live:contract:qa', ['scripts/account-page-limit-production-contract-check.mjs']]"));

function runScript(file, env) {
  return spawnSync(process.execPath, [file], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

const emptySessions = Object.fromEntries(Object.keys({
  INLET_ACCOUNT_PAGE_LIMIT_EMPTY_GENERAL_SESSION: 1,
  INLET_ACCOUNT_PAGE_LIMIT_OCCUPIED_GENERAL_SESSION: 1,
  INLET_ACCOUNT_PAGE_LIMIT_ARCHIVED_GENERAL_SESSION: 1,
  INLET_ACCOUNT_PAGE_LIMIT_PLATFORM_MASTER_SESSION: 1,
  INLET_ACCOUNT_PAGE_LIMIT_GOOGLE_SESSION: 1,
  INLET_ACCOUNT_PAGE_LIMIT_MANAGER_SESSION: 1,
}).map((key) => [key, '']));

const missingApproval = runScript('scripts/account-page-limit-production-runner.mjs', {
  ...emptySessions,
  INLET_ACCOUNT_PAGE_LIMIT_BASE_URL: 'https://pagero.kr',
  INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE: '1',
  INLET_ACCOUNT_PAGE_LIMIT_LIVE_APPROVAL: '',
  INLET_ACCOUNT_PAGE_LIMIT_LIVE_REQUIRE: '0',
});
assert.equal(missingApproval.status, 0);
assert.match(missingApproval.stdout, /"status": "skipped-live"/);

const fakeSession = 'SIGNED_SESSION_MUST_NOT_APPEAR';
const blockedOrigin = runScript('scripts/account-page-limit-production-runner.mjs', {
  INLET_ACCOUNT_PAGE_LIMIT_BASE_URL: 'https://attacker.example',
  INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE: '1',
  INLET_ACCOUNT_PAGE_LIMIT_LIVE_APPROVAL: 'I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES',
  INLET_ACCOUNT_PAGE_LIMIT_LIVE_REQUIRE: '1',
  INLET_ACCOUNT_PAGE_LIMIT_EMPTY_GENERAL_SESSION: `${fakeSession}-1`,
  INLET_ACCOUNT_PAGE_LIMIT_OCCUPIED_GENERAL_SESSION: `${fakeSession}-2`,
  INLET_ACCOUNT_PAGE_LIMIT_ARCHIVED_GENERAL_SESSION: `${fakeSession}-3`,
  INLET_ACCOUNT_PAGE_LIMIT_PLATFORM_MASTER_SESSION: `${fakeSession}-4`,
  INLET_ACCOUNT_PAGE_LIMIT_GOOGLE_SESSION: `${fakeSession}-5`,
  INLET_ACCOUNT_PAGE_LIMIT_MANAGER_SESSION: `${fakeSession}-6`,
});
const blockedOutput = `${blockedOrigin.stdout}\n${blockedOrigin.stderr}`;
assert.equal(blockedOrigin.status, 1);
assert.match(blockedOutput, /not in PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS/);
assert.doesNotMatch(blockedOutput, new RegExp(fakeSession));

const duplicateSessions = runScript('scripts/account-page-limit-production-runner.mjs', {
  INLET_ACCOUNT_PAGE_LIMIT_BASE_URL: 'https://pagero.kr',
  INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE: '1',
  INLET_ACCOUNT_PAGE_LIMIT_LIVE_APPROVAL: 'I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES',
  INLET_ACCOUNT_PAGE_LIMIT_LIVE_REQUIRE: '1',
  INLET_ACCOUNT_PAGE_LIMIT_EMPTY_GENERAL_SESSION: fakeSession,
  INLET_ACCOUNT_PAGE_LIMIT_OCCUPIED_GENERAL_SESSION: fakeSession,
  INLET_ACCOUNT_PAGE_LIMIT_ARCHIVED_GENERAL_SESSION: `${fakeSession}-3`,
  INLET_ACCOUNT_PAGE_LIMIT_PLATFORM_MASTER_SESSION: `${fakeSession}-4`,
  INLET_ACCOUNT_PAGE_LIMIT_GOOGLE_SESSION: `${fakeSession}-5`,
  INLET_ACCOUNT_PAGE_LIMIT_MANAGER_SESSION: `${fakeSession}-6`,
});
const duplicateOutput = `${duplicateSessions.stdout}\n${duplicateSessions.stderr}`;
assert.equal(duplicateSessions.status, 1);
assert.match(duplicateOutput, /fixture sessions must be unique/);
assert.doesNotMatch(duplicateOutput, new RegExp(fakeSession));

console.log(JSON.stringify({
  ok: true,
  contract: 'account-page-limit-production-verification',
  manualOnly: true,
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
    'explicit-write-approval-phrase',
    'same-origin-request-lock',
    'redirect-following-disabled',
    'session-exfiltration-block',
  ],
}, null, 2));
