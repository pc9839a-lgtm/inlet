import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import {
  evaluateAdminAuditLaunchGate,
  normalizeAllowedOrigins,
} from './admin-audit-production-safe-entry.mjs';
import {
  evaluateRetentionGate,
  normalizeRetentionAllowedOrigins,
  normalizeRetentionEndpoint,
} from './audit-retention-safe-runner.mjs';

const root = process.cwd();
const read = (filePath) => readFile(`${root}/${filePath}`, 'utf8');

const [
  liveScript,
  safeEntry,
  retentionRunner,
  workflow,
  retentionWorkflow,
  auditWriter,
  docs,
  packageJson,
  qaAll,
  envExample,
] = await Promise.all([
  read('scripts/admin-audit-production-check.mjs'),
  read('scripts/admin-audit-production-safe-entry.mjs'),
  read('scripts/audit-retention-safe-runner.mjs'),
  read('.github/workflows/admin-audit-production-verify.yml'),
  read('.github/workflows/audit-retention.yml'),
  read('functions/api/_audit.js'),
  read('docs/ops-admin-audit-production-verification.md'),
  read('package.json'),
  read('scripts/qa-all.mjs'),
  read('.env.example'),
]);

for (const token of [
  "'read-only'",
  "'request-email-token'",
  "'verify-live'",
  'INLET_ADMIN_AUDIT_LIVE_WRITE',
  'INLET_ADMIN_AUDIT_LIVE_REQUIRE',
  'PAGERO_ADMIN_AUDIT_EMAIL_CHANGE_TOKEN',
  'AUTH_ACCOUNT_SUSPENDED',
  'PLATFORM_MASTER_REQUIRED',
  'account.email_changed',
  'account.suspended_by_admin',
  'account.restored_by_admin',
  'project.paused',
  'project.restored',
  'audit.retention_dry_run',
  'retentionDryRun',
  'cleanup',
  'projectNeedsRestore',
  'accountNeedsRestore',
  'qa-audit-',
  'awaiting-email-token',
  'verified-live',
  'skipped-live',
]) {
  assert(liveScript.includes(token), `live verification script missing ${token}`);
}
assert.doesNotMatch(liveScript, /console\.(?:log|error)\([^\n]*(?:generalPassword|emailChangeToken|retentionSecret|platformMasterSession|generalSession)/);
assert.doesNotMatch(liveScript, /evidence\.push\([^\n]*(?:email|password|token|session)/i);
assert.match(liveScript, /old email session remained usable/);
assert.match(liveScript, /production email verification response exposed a token/);
assert.match(liveScript, /retentionDryRunOnly:\s*true/);

for (const token of [
  "const DEFAULT_ALLOWED_ORIGINS = ['https://pagero.kr']",
  'I_APPROVE_ADMIN_AUDIT_LIVE_WRITES',
  'PAGERO_ADMIN_AUDIT_ALLOWED_ORIGINS',
  "parsed.protocol !== 'https:'",
  'parsed.username || parsed.password',
  "parsed.pathname !== '/'",
  'target origin is not in PAGERO_ADMIN_AUDIT_ALLOWED_ORIGINS',
  'INLET_ADMIN_AUDIT_LIVE_APPROVAL',
  'installSameOriginFetchGuard',
  'cross-origin admin audit verification request blocked',
  "redirect: 'error'",
  'secretValuesIncluded: false',
]) {
  assert(safeEntry.includes(token), `admin audit safe entry missing ${token}`);
}
assert.doesNotMatch(safeEntry, /console\.log\(process\.env\)/);
assert.doesNotMatch(safeEntry, /PAGERO_ADMIN_AUDIT_PLATFORM_MASTER_SESSION:/);

const allowedOrigins = normalizeAllowedOrigins('https://preview.pagero.example');
assert.deepEqual(allowedOrigins, ['https://pagero.kr', 'https://preview.pagero.example']);
assert.equal(evaluateAdminAuditLaunchGate({
  baseUrl: 'https://pagero.kr',
  phase: 'read-only',
  allowedOrigins,
  writeEnabled: false,
}).ok, true);
assert.equal(evaluateAdminAuditLaunchGate({
  baseUrl: 'https://pagero.kr',
  phase: 'verify-live',
  allowedOrigins,
  writeEnabled: true,
  approval: 'I_APPROVE_ADMIN_AUDIT_LIVE_WRITES',
}).ok, true);
for (const baseUrl of ['https://attacker.example', 'http://pagero.kr', 'https://pagero.kr/api', 'https://user:pass@pagero.kr']) {
  assert.equal(evaluateAdminAuditLaunchGate({
    baseUrl,
    phase: 'verify-live',
    allowedOrigins,
    writeEnabled: true,
    approval: 'I_APPROVE_ADMIN_AUDIT_LIVE_WRITES',
  }).ok, false, `unsafe admin audit target should fail: ${baseUrl}`);
}
assert.equal(evaluateAdminAuditLaunchGate({
  baseUrl: 'https://pagero.kr',
  phase: 'verify-live',
  allowedOrigins,
  writeEnabled: true,
  approval: 'wrong',
}).ok, false);

for (const token of [
  'workflow_dispatch',
  'phase:',
  'request-email-token',
  'verify-live',
  'allow_writes',
  'approval_phrase',
  'I_APPROVE_ADMIN_AUDIT_LIVE_WRITES',
  'environment: production',
  'PAGERO_ADMIN_AUDIT_ALLOWED_ORIGINS',
  'PAGERO_ADMIN_AUDIT_PLATFORM_MASTER_SESSION',
  'PAGERO_ADMIN_AUDIT_GENERAL_SESSION',
  'PAGERO_ADMIN_AUDIT_GENERAL_PASSWORD',
  'PAGERO_ADMIN_AUDIT_NEXT_EMAIL',
  'PAGERO_ADMIN_AUDIT_EMAIL_CHANGE_TOKEN',
  'PAGERO_AUDIT_RETENTION_SECRET',
  'admin-audit-production-evidence-${{ github.run_id }}',
  'npm run admin:audit:live',
]) {
  assert(workflow.includes(token), `production workflow missing ${token}`);
}
assert.doesNotMatch(workflow, /\bschedule\s*:/);
assert.doesNotMatch(workflow, /\bpush\s*:/);
assert.doesNotMatch(workflow, /\bpull_request\s*:/);
assert.doesNotMatch(workflow, /\bset\s+-x\b/);
assert.doesNotMatch(workflow, /echo[^\n]*(?:SESSION|PASSWORD|TOKEN|SECRET)/i);
assert.match(workflow, /contents:\s*read/);
assert.match(workflow, /cancel-in-progress:\s*false/);

for (const token of [
  "const DEFAULT_ENDPOINT = 'https://pagero.kr/api/admin/audit/retention'",
  "const REQUIRED_PATH = '/api/admin/audit/retention'",
  'PAGERO_AUDIT_RETENTION_ALLOWED_ORIGINS',
  'retention secret must be at least',
  "redirect: 'error'",
  "'X-Inlet-Audit-Retention-Secret': secret",
  'secretValuesIncluded: false',
]) {
  assert(retentionRunner.includes(token), `retention runner missing ${token}`);
}
assert.doesNotMatch(retentionRunner, /Authorization:\s*`Bearer/);
assert.doesNotMatch(retentionRunner, /console\.log\([^\n]*secret/i);

const retentionOrigins = normalizeRetentionAllowedOrigins('https://preview.pagero.example');
assert.deepEqual(retentionOrigins, ['https://pagero.kr', 'https://preview.pagero.example']);
assert.equal(normalizeRetentionEndpoint('https://pagero.kr/api/admin/audit/retention').pathname, '/api/admin/audit/retention');
assert.equal(evaluateRetentionGate({
  endpoint: 'https://pagero.kr/api/admin/audit/retention',
  allowedOrigins: retentionOrigins,
  secret: 'a'.repeat(32),
}).ok, true);
for (const endpoint of [
  'https://attacker.example/api/admin/audit/retention',
  'http://pagero.kr/api/admin/audit/retention',
  'https://pagero.kr/api/admin/audit/retention?next=https://attacker.example',
  'https://pagero.kr/api/admin/audit/other',
]) {
  assert.equal(evaluateRetentionGate({ endpoint, allowedOrigins: retentionOrigins, secret: 'a'.repeat(32) }).ok, false);
}
assert.equal(evaluateRetentionGate({
  endpoint: 'https://pagero.kr/api/admin/audit/retention',
  allowedOrigins: retentionOrigins,
  secret: 'short',
}).ok, false);

for (const token of [
  'schedule:',
  'workflow_dispatch:',
  'environment: production',
  'PAGERO_AUDIT_RETENTION_URL',
  'PAGERO_AUDIT_RETENTION_ALLOWED_ORIGINS',
  'PAGERO_AUDIT_RETENTION_SECRET',
  'npm run audit:retention:run',
  'audit-retention-evidence-${{ github.run_id }}',
  'if-no-files-found: error',
  'failed-live, never skipped-live',
]) {
  assert(retentionWorkflow.includes(token), `retention workflow missing ${token}`);
}
assert.doesNotMatch(retentionWorkflow, /curl\s/);
assert.doesNotMatch(retentionWorkflow, /Authorization:\s*Bearer/);
assert.doesNotMatch(retentionWorkflow, /exit\s+0[^\n]*Secret/i);

for (const token of [
  'INLET_AUDIT_HASH_SECRET',
  'if (!text || !secret) return',
  'hasAuditHashSecret',
  'sha256:',
]) assert(auditWriter.includes(token), `audit writer missing ${token}`);
assert.doesNotMatch(auditWriter, /INLET_SESSION_SECRET|INLET_API_TOKEN/);
assert.doesNotMatch(auditWriter, /crypto\.subtle\.digest\('SHA-256'/);

for (const token of [
  'Admin Audit Production Verification',
  'read-only',
  'request-email-token',
  'verify-live',
  'qa-audit-',
  'old session',
  'dry-run',
  'verified-live',
  'skipped-live',
  'Do not use a real customer account',
]) assert(docs.includes(token), `production verification docs missing ${token}`);

const pkg = JSON.parse(packageJson);
assert.equal(pkg.scripts['admin:audit:live'], 'node scripts/admin-audit-production-safe-entry.mjs');
assert.equal(pkg.scripts['audit:retention:run'], 'node scripts/audit-retention-safe-runner.mjs');
assert.equal(pkg.scripts['admin:audit:production:contract:qa'], 'node scripts/admin-audit-production-contract-check.mjs');
assert.match(qaAll, /admin:audit:production:contract:qa/);

for (const token of [
  'INLET_ADMIN_AUDIT_BASE_URL',
  'INLET_ADMIN_AUDIT_LIVE_PHASE',
  'INLET_ADMIN_AUDIT_LIVE_WRITE',
  'INLET_ADMIN_AUDIT_PLATFORM_MASTER_SESSION',
  'INLET_ADMIN_AUDIT_GENERAL_SESSION',
  'INLET_ADMIN_AUDIT_PROJECT_SLUG_PREFIX',
  'INLET_AUDIT_HASH_SECRET',
]) assert(envExample.includes(token), `.env.example missing ${token}`);

const fakeSecret = 'SIGNED_ADMIN_SECRET_MUST_NOT_APPEAR';
const blockedOrigin = spawnSync(process.execPath, ['scripts/admin-audit-production-safe-entry.mjs'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    INLET_ADMIN_AUDIT_BASE_URL: 'https://attacker.example',
    INLET_ADMIN_AUDIT_LIVE_PHASE: 'verify-live',
    INLET_ADMIN_AUDIT_LIVE_REQUIRE: '1',
    INLET_ADMIN_AUDIT_LIVE_WRITE: '1',
    INLET_ADMIN_AUDIT_LIVE_APPROVAL: 'I_APPROVE_ADMIN_AUDIT_LIVE_WRITES',
    PAGERO_ADMIN_AUDIT_ALLOWED_ORIGINS: '',
    INLET_ADMIN_AUDIT_PLATFORM_MASTER_SESSION: fakeSecret,
    INLET_ADMIN_AUDIT_GENERAL_SESSION: fakeSecret,
    INLET_ADMIN_AUDIT_GENERAL_PASSWORD: fakeSecret,
    INLET_ADMIN_AUDIT_NEXT_EMAIL: 'qa@example.com',
    INLET_ADMIN_AUDIT_EMAIL_CHANGE_TOKEN: fakeSecret,
    INLET_ADMIN_AUDIT_RETENTION_SECRET: fakeSecret,
  },
});
assert.equal(blockedOrigin.status, 1, 'unapproved admin audit origins must fail before the checker starts');
const blockedOutput = `${blockedOrigin.stdout}\n${blockedOrigin.stderr}`;
assert.match(blockedOutput, /"status": "failed-live"/);
assert.match(blockedOutput, /not in PAGERO_ADMIN_AUDIT_ALLOWED_ORIGINS/);
assert.doesNotMatch(blockedOutput, new RegExp(fakeSecret));

const missingApproval = spawnSync(process.execPath, ['scripts/admin-audit-production-safe-entry.mjs'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    INLET_ADMIN_AUDIT_BASE_URL: 'https://pagero.kr',
    INLET_ADMIN_AUDIT_LIVE_PHASE: 'verify-live',
    INLET_ADMIN_AUDIT_LIVE_REQUIRE: '0',
    INLET_ADMIN_AUDIT_LIVE_WRITE: '1',
    INLET_ADMIN_AUDIT_LIVE_APPROVAL: '',
    PAGERO_ADMIN_AUDIT_ALLOWED_ORIGINS: '',
  },
});
assert.equal(missingApproval.status, 0);
assert.match(missingApproval.stdout, /"status": "skipped-live"/);

const blockedRetention = spawnSync(process.execPath, ['scripts/audit-retention-safe-runner.mjs'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    PAGERO_AUDIT_RETENTION_URL: 'https://attacker.example/api/admin/audit/retention',
    PAGERO_AUDIT_RETENTION_ALLOWED_ORIGINS: '',
    PAGERO_AUDIT_RETENTION_SECRET: fakeSecret,
    PAGERO_AUDIT_RETENTION_DRY_RUN: 'true',
  },
});
assert.equal(blockedRetention.status, 1);
const retentionOutput = `${blockedRetention.stdout}\n${blockedRetention.stderr}`;
assert.match(retentionOutput, /"status": "failed-live"/);
assert.match(retentionOutput, /not in PAGERO_AUDIT_RETENTION_ALLOWED_ORIGINS/);
assert.doesNotMatch(retentionOutput, new RegExp(fakeSecret));

console.log(JSON.stringify({
  ok: true,
  check: 'admin-audit-production-verification-contract',
  phases: ['read-only', 'request-email-token', 'verify-live'],
  manualOnly: true,
  writeGate: true,
  disposableProjectPrefix: 'qa-audit-',
  secretOutputBlocked: true,
  cleanupGuards: true,
  securityGates: [
    'exact-https-origin-allowlist',
    'same-origin-fetch-only',
    'redirect-disabled',
    'explicit-write-approval',
    'retention-exact-path',
    'retention-secret-required',
    'dedicated-audit-hmac-secret-only',
  ],
}, null, 2));
