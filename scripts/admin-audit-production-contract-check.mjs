import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const read = (path) => readFile(`${root}/${path}`, 'utf8');

const [liveScript, workflow, docs, packageJson, qaAll, envExample] = await Promise.all([
  read('scripts/admin-audit-production-check.mjs'),
  read('.github/workflows/admin-audit-production-verify.yml'),
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
assert.match(liveScript, /\/api\/pages\/\$\{encodeURIComponent\(slug\)\}\?public=1/);

for (const token of [
  'workflow_dispatch',
  'phase:',
  'request-email-token',
  'verify-live',
  'allow_writes',
  'require_live',
  'PAGERO_ADMIN_AUDIT_PLATFORM_MASTER_SESSION',
  'PAGERO_ADMIN_AUDIT_GENERAL_SESSION',
  'PAGERO_ADMIN_AUDIT_GENERAL_PASSWORD',
  'PAGERO_ADMIN_AUDIT_NEXT_EMAIL',
  'PAGERO_ADMIN_AUDIT_EMAIL_CHANGE_TOKEN',
  'PAGERO_AUDIT_RETENTION_SECRET',
  'admin-audit-production-evidence',
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
  'Admin Audit Production Verification',
  'read-only',
  'request-email-token',
  'verify-live',
  'qa-audit-',
  'PAGERO_ADMIN_AUDIT_EMAIL_CHANGE_TOKEN',
  'old session',
  'dry-run',
  'verified-live',
  'skipped-live',
  'Do not use a real customer account',
]) {
  assert(docs.includes(token), `production verification docs missing ${token}`);
}

const pkg = JSON.parse(packageJson);
assert.equal(pkg.scripts['admin:audit:live'], 'node scripts/admin-audit-production-check.mjs');
assert.equal(pkg.scripts['admin:audit:production:contract:qa'], 'node scripts/admin-audit-production-contract-check.mjs');
assert.match(qaAll, /admin:audit:production:contract:qa/);

for (const token of [
  'INLET_ADMIN_AUDIT_BASE_URL',
  'INLET_ADMIN_AUDIT_LIVE_PHASE',
  'INLET_ADMIN_AUDIT_LIVE_WRITE',
  'INLET_ADMIN_AUDIT_PLATFORM_MASTER_SESSION',
  'INLET_ADMIN_AUDIT_GENERAL_SESSION',
  'INLET_ADMIN_AUDIT_PROJECT_SLUG_PREFIX',
]) {
  assert(envExample.includes(token), `.env.example missing ${token}`);
}

const skipped = spawnSync(process.execPath, ['scripts/admin-audit-production-check.mjs'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    INLET_ADMIN_AUDIT_LIVE_PHASE: 'verify-live',
    INLET_ADMIN_AUDIT_LIVE_REQUIRE: '0',
    INLET_ADMIN_AUDIT_LIVE_WRITE: '0',
    INLET_ADMIN_AUDIT_PLATFORM_MASTER_SESSION: '',
    INLET_ADMIN_AUDIT_GENERAL_SESSION: '',
    INLET_ADMIN_AUDIT_GENERAL_PASSWORD: '',
    INLET_ADMIN_AUDIT_NEXT_EMAIL: '',
    INLET_ADMIN_AUDIT_EMAIL_CHANGE_TOKEN: '',
    INLET_ADMIN_AUDIT_RETENTION_SECRET: '',
  },
});
assert.equal(skipped.status, 0, skipped.stderr || skipped.stdout);
const skippedOutput = JSON.parse(skipped.stdout);
assert.equal(skippedOutput.status, 'skipped-live');
assert.equal(skippedOutput.writeEnabled, false);
assert.equal(skippedOutput.phase, 'verify-live');
assert(!skipped.stdout.includes('PAGERO_ADMIN_AUDIT_EMAIL_CHANGE_TOKEN'));

console.log(JSON.stringify({
  ok: true,
  check: 'admin-audit-production-verification-contract',
  phases: ['read-only', 'request-email-token', 'verify-live'],
  manualOnly: true,
  writeGate: true,
  disposableProjectPrefix: 'qa-audit-',
  secretOutputBlocked: true,
  cleanupGuards: true,
}, null, 2));
