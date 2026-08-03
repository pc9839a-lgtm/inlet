import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const read = (path) => readFile(`${root}/${path}`, 'utf8');

const [safeEntry, liveCheck, workflow, docs, packageJson, qaAll, envExample] = await Promise.all([
  read('scripts/google-sheets-production-safe-entry.mjs'),
  read('scripts/google-sheets-production-check.mjs'),
  read('.github/workflows/google-sheets-production-verify.yml'),
  read('docs/ops-google-sheets-production-verification.md'),
  read('package.json'),
  read('scripts/qa-all.mjs'),
  read('.env.example'),
]);

for (const token of [
  'https://pagero.kr',
  'PAGERO_GOOGLE_SHEETS_ALLOWED_ORIGINS',
  'I_APPROVE_GOOGLE_SHEETS_LIVE_WRITES',
  'blocked-before-secrets-or-network',
  'verify-live requires allow_writes=true',
  'fixture page slug must start with qa-sheets-',
  'fixture sheet name must start with QA',
  'INLET_GOOGLE_SHEETS_ORIGIN_VERIFIED',
]) {
  assert(safeEntry.includes(token), `safe entrypoint missing ${token}`);
}
assert.match(safeEntry, /parsed\.protocol !== 'https:'/);
assert.match(safeEntry, /parsed\.pathname !== '\/'/);
assert.doesNotMatch(safeEntry, /hostname\.endsWith|includes\(parsed\.hostname\)|\*\./);

for (const token of [
  'https://oauth2.googleapis.com/token',
  'https://sheets.googleapis.com',
  "redirect: 'error'",
  "grant_type: 'refresh_token'",
  "provider: 'google_sheets'",
  "mode: 'oauth'",
  '/api/leads/delivery-logs',
  '/deliver',
  'idempotencyKey',
  'deleteDimension',
  ':batchUpdate',
  "method: 'DELETE'",
  'sheetRowsDeleted: true',
  'secretValuesIncluded: false',
]) {
  assert(liveCheck.includes(token), `live check missing ${token}`);
}
assert.match(liveCheck, /target\.origin !== baseOrigin/);
assert.match(liveCheck, /target\.pathname\.startsWith\('\/api\/'\)/);
assert.doesNotMatch(liveCheck, /console\.(?:log|error)\([^\n]*(?:clientSecret|refreshToken|accessToken|session)/);
assert.doesNotMatch(liveCheck, /evidence\.push\([^\n]*(?:email|phone|spreadsheetId|session|token)/i);
assert.doesNotMatch(liveCheck, /follow|redirect:\s*['"]follow['"]/);

for (const token of [
  'workflow_dispatch',
  'environment: production',
  'approval_phrase',
  'I_APPROVE_GOOGLE_SHEETS_LIVE_WRITES',
  'PAGERO_GOOGLE_SHEETS_ALLOWED_ORIGINS',
  'PAGERO_GOOGLE_SHEETS_SESSION',
  'PAGERO_GOOGLE_SHEETS_SPREADSHEET_ID',
  'PAGERO_GOOGLE_SHEETS_VERIFY_CLIENT_ID',
  'PAGERO_GOOGLE_SHEETS_VERIFY_CLIENT_SECRET',
  'PAGERO_GOOGLE_SHEETS_VERIFY_REFRESH_TOKEN',
  'google-sheets-production-evidence-${{ github.run_id }}',
  'npm run google:sheets:live',
]) {
  assert(workflow.includes(token), `workflow missing ${token}`);
}
assert.doesNotMatch(workflow, /\bschedule\s*:/);
assert.doesNotMatch(workflow, /\bpush\s*:/);
assert.doesNotMatch(workflow, /\bpull_request\s*:/);
assert.doesNotMatch(workflow, /\bset\s+-x\b/);
assert.doesNotMatch(workflow, /echo[^\n]*(?:SESSION|TOKEN|SECRET|CLIENT)/i);
assert.match(workflow, /contents:\s*read/);
assert.match(workflow, /cancel-in-progress:\s*false/);

for (const token of [
  'Google Sheets Production Verification',
  'qa-sheets-',
  'read-only',
  'verify-live',
  'refresh token',
  'exactly one row',
  'idempotency',
  'cleanup',
  'Do not use a customer spreadsheet',
  'verified-live',
  'skipped-live',
]) {
  assert(docs.includes(token), `runbook missing ${token}`);
}

const pkg = JSON.parse(packageJson);
assert.equal(pkg.scripts['google:sheets:live'], 'node scripts/google-sheets-production-safe-entry.mjs');
assert.equal(pkg.scripts['google:sheets:production:contract:qa'], 'node scripts/google-sheets-production-contract-check.mjs');
assert.match(qaAll, /google:sheets:production:contract:qa/);

for (const token of [
  'INLET_GOOGLE_SHEETS_BASE_URL',
  'INLET_GOOGLE_SHEETS_LIVE_PHASE',
  'INLET_GOOGLE_SHEETS_LIVE_APPROVAL',
  'PAGERO_GOOGLE_SHEETS_ALLOWED_ORIGINS',
  'INLET_GOOGLE_SHEETS_PAGE_SLUG',
  'INLET_GOOGLE_SHEETS_SPREADSHEET_ID',
  'INLET_GOOGLE_SHEETS_VERIFY_REFRESH_TOKEN',
]) {
  assert(envExample.includes(token), `.env.example missing ${token}`);
}

function runSafeEntry(extraEnv = {}) {
  return spawnSync(process.execPath, ['scripts/google-sheets-production-safe-entry.mjs'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      INLET_GOOGLE_SHEETS_LIVE_REQUIRE: '0',
      INLET_GOOGLE_SHEETS_SESSION: '',
      INLET_GOOGLE_SHEETS_PROJECT_ID: '',
      INLET_GOOGLE_SHEETS_SPREADSHEET_ID: '',
      INLET_GOOGLE_SHEETS_VERIFY_CLIENT_ID: '',
      INLET_GOOGLE_SHEETS_VERIFY_CLIENT_SECRET: '',
      INLET_GOOGLE_SHEETS_VERIFY_REFRESH_TOKEN: '',
      ...extraEnv,
    },
  });
}

const externalOrigin = runSafeEntry({
  INLET_GOOGLE_SHEETS_BASE_URL: 'https://attacker.example',
  INLET_GOOGLE_SHEETS_LIVE_PHASE: 'read-only',
  INLET_GOOGLE_SHEETS_PAGE_SLUG: 'qa-sheets-contract',
  INLET_GOOGLE_SHEETS_SHEET_NAME: 'QA Leads',
});
assert.notEqual(externalOrigin.status, 0, externalOrigin.stdout || externalOrigin.stderr);
assert.match(externalOrigin.stderr, /blocked-before-secrets-or-network|not in PAGERO_GOOGLE_SHEETS_ALLOWED_ORIGINS/);

const httpOrigin = runSafeEntry({
  INLET_GOOGLE_SHEETS_BASE_URL: 'http://pagero.kr',
  INLET_GOOGLE_SHEETS_LIVE_PHASE: 'read-only',
  INLET_GOOGLE_SHEETS_PAGE_SLUG: 'qa-sheets-contract',
  INLET_GOOGLE_SHEETS_SHEET_NAME: 'QA Leads',
});
assert.notEqual(httpOrigin.status, 0);
assert.match(httpOrigin.stderr, /must use HTTPS/);

const pathOrigin = runSafeEntry({
  INLET_GOOGLE_SHEETS_BASE_URL: 'https://pagero.kr/api/leads',
  INLET_GOOGLE_SHEETS_LIVE_PHASE: 'read-only',
  INLET_GOOGLE_SHEETS_PAGE_SLUG: 'qa-sheets-contract',
  INLET_GOOGLE_SHEETS_SHEET_NAME: 'QA Leads',
});
assert.notEqual(pathOrigin.status, 0);
assert.match(pathOrigin.stderr, /without path/);

const missingApproval = runSafeEntry({
  INLET_GOOGLE_SHEETS_BASE_URL: 'https://pagero.kr',
  INLET_GOOGLE_SHEETS_LIVE_PHASE: 'verify-live',
  INLET_GOOGLE_SHEETS_LIVE_WRITE: '1',
  INLET_GOOGLE_SHEETS_LIVE_APPROVAL: '',
  INLET_GOOGLE_SHEETS_PAGE_SLUG: 'qa-sheets-contract',
  INLET_GOOGLE_SHEETS_SHEET_NAME: 'QA Leads',
});
assert.notEqual(missingApproval.status, 0);
assert.match(missingApproval.stderr, /I_APPROVE_GOOGLE_SHEETS_LIVE_WRITES/);

const skipped = runSafeEntry({
  INLET_GOOGLE_SHEETS_BASE_URL: 'https://pagero.kr',
  INLET_GOOGLE_SHEETS_LIVE_PHASE: 'read-only',
  INLET_GOOGLE_SHEETS_PAGE_SLUG: 'qa-sheets-contract',
  INLET_GOOGLE_SHEETS_SHEET_NAME: 'QA Leads',
});
assert.equal(skipped.status, 0, skipped.stderr || skipped.stdout);
const skippedOutput = JSON.parse(skipped.stdout);
assert.equal(skippedOutput.status, 'skipped-live');
assert.equal(skippedOutput.secretValuesIncluded, false);

console.log(JSON.stringify({
  ok: true,
  check: 'google-sheets-production-verification-contract',
  manualOnly: true,
  exactOriginAllowlist: true,
  redirectBlocked: true,
  writeApprovalRequired: true,
  googleRefreshTokenCovered: true,
  rowIdempotencyCovered: true,
  cleanupRequired: true,
  secretOutputBlocked: true,
}, null, 2));
