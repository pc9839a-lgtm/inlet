import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const [script, workflow, runbook, packageJson, qaAll] = await Promise.all([
  readFile('scripts/account-page-limit-production-check.mjs', 'utf8'),
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
  "expectedPlatformMaster",
  "saveMode: 'update-existing'",
  '/revisions?',
  '/restore',
  '?public=1&fresh=',
  "expectedStatus = 200",
  "expectedStatus === 409",
  "[403, 409].includes",
  'cleanupQueue.splice(0).reverse()',
  'qa-limit-',
]) assert(script.includes(token), `live account page-limit script missing contract token: ${token}`);

assert(!script.includes('console.log(session)'), 'live verification must never print a session secret');
assert(!script.includes('Authorization: `Bearer ${session}`'), 'live verification must use the signed session header without copying it into logs');
assert(script.includes("'X-Inlet-Session': session"), 'live verification must authenticate with X-Inlet-Session');
assert(script.indexOf('if (missingSessions.length || !allowWrites)') < script.indexOf("await sessionSnapshot('empty-general'"), 'write and fixture gates must run before any live request');

for (const token of [
  'workflow_dispatch:',
  'allow_writes:',
  'require_live:',
  "INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE: ${{ inputs.allow_writes && '1' || '0' }}",
  'PAGERO_PAGE_LIMIT_EMPTY_GENERAL_SESSION',
  'PAGERO_PAGE_LIMIT_OCCUPIED_GENERAL_SESSION',
  'PAGERO_PAGE_LIMIT_ARCHIVED_GENERAL_SESSION',
  'PAGERO_PAGE_LIMIT_PLATFORM_MASTER_SESSION',
  'PAGERO_PAGE_LIMIT_GOOGLE_SESSION',
  'PAGERO_PAGE_LIMIT_MANAGER_SESSION',
  'account-page-limit-production-evidence',
  'retention-days: 30',
]) assert(workflow.includes(token), `account page-limit workflow missing contract token: ${token}`);
assert(!/^\s*schedule:/m.test(workflow), 'production write verification must remain manual and must not be scheduled');
assert(workflow.includes('permissions:\n  contents: read'), 'production verification workflow must use read-only repository permissions');

for (const token of [
  'Use dedicated QA accounts only',
  'Never use a real customer account',
  'skipped-live',
  'verified-live',
  'qa-limit-*',
  'Manager creation returning `200`',
  'cleanup confirmation',
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

console.log(JSON.stringify({
  ok: true,
  contract: 'account-page-limit-production-verification',
  manualOnly: true,
  liveStatuses: ['skipped-live', 'verified-live', 'failed-live'],
  fixtures: 6,
}, null, 2));
