import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import {
  QA_SHEET_HEADERS,
  assertDedicatedQaSheetRows,
  exactMarkerRowIndices,
  qaResidueRowIndices,
  rowsDigest,
  sanitizeGoogleSheetsEvidence,
} from './google-sheets-production-safety.mjs';

const root = process.cwd();
const read = (path) => readFile(`${root}/${path}`, 'utf8');

const [safeEntry, liveCheck, safetyHelpers, workflow, docs, packageJson, qaAll, envExample] = await Promise.all([
  read('scripts/google-sheets-production-safe-entry.mjs'),
  read('scripts/google-sheets-production-check.mjs'),
  read('scripts/google-sheets-production-safety.mjs'),
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
  '/api/leads/delivery-logs',
  '/deliver',
  'idempotencyKey',
  'deleteDimension',
  ':batchUpdate',
  "method: 'DELETE'",
  'sheetRowsDeleted: true',
  'baselineRestored: true',
  'secretValuesIncluded: false',
  'persisted qa-sheets page integration does not match the approved fixture',
  'previous qa-sheets row residue exists in the fixture sheet',
  'previous qa-sheets lead residue exists in Pagero',
  'fixture sheet baseline was not restored after cleanup',
  'assertDedicatedQaSheetRows',
  'exactMarkerRowIndices',
  'listQaLeads(marker)',
]) {
  assert(liveCheck.includes(token), `live check missing ${token}`);
}
assert.match(liveCheck, /target\.origin !== baseOrigin/);
assert.match(liveCheck, /target\.pathname\.startsWith\('\/api\/'\)/);
assert.match(liveCheck, /String\(sheets\.spreadsheetId \|\| ''\)\.trim\(\) !== fixture\.spreadsheetId/);
assert.match(liveCheck, /String\(sheets\.sheetName \|\| ''\)\.trim\(\) !== fixture\.sheetName/);
assert.doesNotMatch(liveCheck, /console\.(?:log|error)\([^\n]*(?:clientSecret|refreshToken|accessToken|session)/);
assert.doesNotMatch(liveCheck, /evidence\.push\([^\n]*(?:email|phone|spreadsheetId|session|token)/i);
assert.doesNotMatch(liveCheck, /follow|redirect:\s*['"]follow['"]/);

for (const token of [
  'QA_SHEET_HEADERS',
  'exactMarkerRowIndices',
  'qaResidueRowIndices',
  'assertDedicatedQaSheetRows',
  'rowsDigest',
  'sanitizeGoogleSheetsEvidence',
  '[REDACTED]',
]) {
  assert(safetyHelpers.includes(token), `safety helper missing ${token}`);
}

const marker = 'qa-sheets-contract-1';
const rows = [
  [...QA_SHEET_HEADERS],
  ['2026-08-03', marker, `prefix-${marker}`, '', ''],
  ['2026-08-03', `prefix-${marker}`, '', '', ''],
];
assert.deepEqual(exactMarkerRowIndices(rows, marker), [1], 'cleanup must use exact marker cells, not substring matches');
assert.deepEqual(qaResidueRowIndices(rows), [1], 'residue detection must find qa-sheets markers');
assert.equal(assertDedicatedQaSheetRows([[...QA_SHEET_HEADERS]]), true);
assert.throws(() => assertDedicatedQaSheetRows([]), /exactly one header row/);
assert.throws(() => assertDedicatedQaSheetRows([[...QA_SHEET_HEADERS], ['data']]), /exactly one header row/);
assert.throws(() => assertDedicatedQaSheetRows([['wrong']]), /header must exactly match/);
assert.equal(rowsDigest([[...QA_SHEET_HEADERS]]), rowsDigest([[...QA_SHEET_HEADERS]]));
assert.notEqual(rowsDigest([[...QA_SHEET_HEADERS]]), rowsDigest([[...QA_SHEET_HEADERS], ['data']]));
const redacted = sanitizeGoogleSheetsEvidence({
  clientSecret: 'top-secret',
  details: { message: 'failed with top-secret', spreadsheetId: 'sheet-123' },
}, ['top-secret', 'sheet-123']);
assert.equal(redacted.clientSecret, '[REDACTED]');
assert.equal(redacted.details.spreadsheetId, '[REDACTED]');
assert.doesNotMatch(JSON.stringify(redacted), /top-secret|sheet-123/);

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
  'Persisted Page Integration Check',
  'Clean Baseline Contract',
  '접수일시, 이름, 연락처, qaMarker, source',
  'baseline digest',
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

const fakeSecret = 'GOOGLE_SHEETS_SECRET_MUST_NOT_APPEAR';
const blockedSecret = runSafeEntry({
  INLET_GOOGLE_SHEETS_BASE_URL: 'https://attacker.example',
  INLET_GOOGLE_SHEETS_LIVE_PHASE: 'read-only',
  INLET_GOOGLE_SHEETS_PAGE_SLUG: 'qa-sheets-contract',
  INLET_GOOGLE_SHEETS_SHEET_NAME: 'QA Leads',
  INLET_GOOGLE_SHEETS_VERIFY_CLIENT_SECRET: fakeSecret,
});
assert.notEqual(blockedSecret.status, 0);
assert.doesNotMatch(`${blockedSecret.stdout}\n${blockedSecret.stderr}`, new RegExp(fakeSecret));

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
  persistedPageIntegrationMatched: true,
  dedicatedSpreadsheetRequired: true,
  cleanHeaderOnlyBaselineRequired: true,
  priorResidueBlocked: true,
  exactMarkerCleanup: true,
  baselineRestorationRequired: true,
  rowIdempotencyCovered: true,
  cleanupRequired: true,
  secretOutputBlocked: true,
}, null, 2));
