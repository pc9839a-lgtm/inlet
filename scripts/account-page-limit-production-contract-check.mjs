import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import {
  evaluateLaunchGate,
  normalizeAllowedOrigins,
} from './account-page-limit-production-safe-entry.mjs';

const [script, safeEntry, workflow, runbook, packageJson, qaAll] = await Promise.all([
  readFile('scripts/account-page-limit-production-check.mjs', 'utf8'),
  readFile('scripts/account-page-limit-production-safe-entry.mjs', 'utf8'),
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
  'expectedStatus = 200',
  'expectedStatus === 409',
  '[403, 409].includes',
  'cleanupQueue.splice(0).reverse()',
  'qa-limit-',
]) assert(script.includes(token), `live account page-limit script missing contract token: ${token}`);

assert(!script.includes('console.log(session)'), 'live verification must never print a session secret');
assert(!script.includes('Authorization: `Bearer ${session}`'), 'live verification must use the signed session header without copying it into logs');
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
  'account-page-limit-production-check.mjs',
  "stdio: 'inherit'",
  'secretValuesIncluded: false',
]) assert(safeEntry.includes(token), `safe live entry missing contract token: ${token}`);
assert(!safeEntry.includes('console.log(process.env)'), 'safe entry must never print its environment');
assert(!safeEntry.includes('PAGERO_PAGE_LIMIT_EMPTY_GENERAL_SESSION:'), 'safe entry must not copy session values into evidence');

const allowedOrigins = normalizeAllowedOrigins('https://preview.pagero.example');
assert.deepEqual(allowedOrigins, ['https://pagero.kr', 'https://preview.pagero.example']);
assert.equal(evaluateLaunchGate({
  baseUrl: 'https://pagero.kr',
  allowedOrigins,
  writeEnabled: true,
  approval: 'I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES',
}).ok, true);
assert.equal(evaluateLaunchGate({
  baseUrl: 'https://attacker.example',
  allowedOrigins,
  writeEnabled: true,
  approval: 'I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES',
}).ok, false);
assert.equal(evaluateLaunchGate({
  baseUrl: 'http://pagero.kr',
  allowedOrigins,
  writeEnabled: true,
  approval: 'I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES',
}).ok, false);
assert.equal(evaluateLaunchGate({
  baseUrl: 'https://pagero.kr/api',
  allowedOrigins,
  writeEnabled: true,
  approval: 'I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES',
}).ok, false);
assert.equal(evaluateLaunchGate({
  baseUrl: 'https://pagero.kr',
  allowedOrigins,
  writeEnabled: true,
  approval: 'wrong',
}).ok, false);

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
  'node scripts/account-page-limit-production-safe-entry.mjs',
  'account-page-limit-production-evidence-${{ github.run_id }}',
  'retention-days: 30',
]) assert(workflow.includes(token), `account page-limit workflow missing contract token: ${token}`);
assert(!/^\s*schedule:/m.test(workflow), 'production write verification must remain manual and must not be scheduled');
assert(workflow.includes('permissions:\n  contents: read'), 'production verification workflow must use read-only repository permissions');
assert(!workflow.includes('npm run account:page-limit:live | tee'), 'workflow must pass through the safe origin gate before the live checker');

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
]) assert(runbook.includes(token), `account page-limit runbook missing safety detail: ${token}`);

assert(packageJson.includes('"account:page-limit:live"'), 'package scripts must expose the live account page-limit command');
assert(packageJson.includes('"account:page-limit:live:contract:qa"'), 'package scripts must expose the live contract command');
assert(qaAll.includes("['account:page-limit:live:contract:qa', ['scripts/account-page-limit-production-contract-check.mjs']]"), 'qa:all must execute the account page-limit live contract');

const skipped = spawnSync(process.execPath, ['scripts/account-page-limit-production-check.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    INLET_ACCOUNT_PAGE_LIMIT_EMPTY_GENERAL_SESSION: '',
    INLET_ACCOUNT_PAGE_LIMIT_OCCUPIED_GENERAL_SESSION: '',
    INLET_ACCOUNT_PAGE_LIMIT_ARCHIVED_GENERAL_SESSION: '',
    INLET_ACCOUNT_PAGE_LIMIT_PLATFORM_MASTER_SESSION: '',
    INLET_ACCOUNT_PAGE_LIMIT_GOOGLE_SESSION: '',
    INLET_ACCOUNT_PAGE_LIMIT_MANAGER_SESSION: '',
    INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE: '0',
    INLET_ACCOUNT_PAGE_LIMIT_LIVE_REQUIRE: '0',
  },
  encoding: 'utf8',
});
assert.equal(skipped.status, 0, `optional missing live fixtures should skip cleanly: ${skipped.stderr}`);
assert.match(skipped.stdout, /"status": "skipped-live"/);
assert.doesNotMatch(skipped.stdout, /verified-live/);

const required = spawnSync(process.execPath, ['scripts/account-page-limit-production-check.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    INLET_ACCOUNT_PAGE_LIMIT_EMPTY_GENERAL_SESSION: '',
    INLET_ACCOUNT_PAGE_LIMIT_OCCUPIED_GENERAL_SESSION: '',
    INLET_ACCOUNT_PAGE_LIMIT_ARCHIVED_GENERAL_SESSION: '',
    INLET_ACCOUNT_PAGE_LIMIT_PLATFORM_MASTER_SESSION: '',
    INLET_ACCOUNT_PAGE_LIMIT_GOOGLE_SESSION: '',
    INLET_ACCOUNT_PAGE_LIMIT_MANAGER_SESSION: '',
    INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE: '0',
    INLET_ACCOUNT_PAGE_LIMIT_LIVE_REQUIRE: '1',
  },
  encoding: 'utf8',
});
assert.equal(required.status, 1, 'required live verification must fail when fixtures or write approval are missing');
assert.match(required.stdout, /"status": "skipped-live"/);

const fakeSession = 'SIGNED_SESSION_MUST_NOT_APPEAR';
const blockedOrigin = spawnSync(process.execPath, ['scripts/account-page-limit-production-safe-entry.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    INLET_ACCOUNT_PAGE_LIMIT_BASE_URL: 'https://attacker.example',
    INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE: '1',
    INLET_ACCOUNT_PAGE_LIMIT_LIVE_APPROVAL: 'I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES',
    INLET_ACCOUNT_PAGE_LIMIT_LIVE_REQUIRE: '1',
    PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS: '',
    INLET_ACCOUNT_PAGE_LIMIT_EMPTY_GENERAL_SESSION: fakeSession,
    INLET_ACCOUNT_PAGE_LIMIT_OCCUPIED_GENERAL_SESSION: fakeSession,
    INLET_ACCOUNT_PAGE_LIMIT_ARCHIVED_GENERAL_SESSION: fakeSession,
    INLET_ACCOUNT_PAGE_LIMIT_PLATFORM_MASTER_SESSION: fakeSession,
    INLET_ACCOUNT_PAGE_LIMIT_GOOGLE_SESSION: fakeSession,
    INLET_ACCOUNT_PAGE_LIMIT_MANAGER_SESSION: fakeSession,
  },
  encoding: 'utf8',
});
assert.equal(blockedOrigin.status, 1, 'unapproved origins must fail before the live checker starts');
assert.match(`${blockedOrigin.stdout}\n${blockedOrigin.stderr}`, /"status": "failed-live"/);
assert.match(`${blockedOrigin.stdout}\n${blockedOrigin.stderr}`, /not in PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS/);
assert.doesNotMatch(`${blockedOrigin.stdout}\n${blockedOrigin.stderr}`, new RegExp(fakeSession));

const missingApproval = spawnSync(process.execPath, ['scripts/account-page-limit-production-safe-entry.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    INLET_ACCOUNT_PAGE_LIMIT_BASE_URL: 'https://pagero.kr',
    INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE: '1',
    INLET_ACCOUNT_PAGE_LIMIT_LIVE_APPROVAL: '',
    INLET_ACCOUNT_PAGE_LIMIT_LIVE_REQUIRE: '0',
    PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS: '',
  },
  encoding: 'utf8',
});
assert.equal(missingApproval.status, 0, 'optional verification may skip when explicit approval is missing');
assert.match(missingApproval.stdout, /"status": "skipped-live"/);

console.log(JSON.stringify({
  ok: true,
  contract: 'account-page-limit-production-verification',
  manualOnly: true,
  liveStatuses: ['skipped-live', 'verified-live', 'failed-live'],
  fixtures: 6,
  securityGates: [
    'exact-https-origin-allowlist',
    'no-path-query-fragment',
    'no-url-credentials',
    'explicit-write-approval-phrase',
    'production-environment',
    'session-exfiltration-block',
  ],
}, null, 2));
