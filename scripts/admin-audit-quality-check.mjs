import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { sanitizeAuditMetadata, writeAuditLog } from '../functions/api/_audit.js';
import { isPlatformMasterIdentity } from '../functions/api/_platformMaster.js';
import { onRequest as renderAdminAuditPage } from '../functions/admin/audit.js';
import { writePageManagerAuditChanges } from '../functions/api/pages/_pageAudit.js';
import {
  normalizedProjectStatusAction,
  projectActionState,
} from '../functions/api/admin/projects/[id]/status.js';
import {
  auditRetentionBatchLimit,
  auditRetentionDays,
  hasAuditRetentionSecret,
} from '../functions/api/admin/audit/retention.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const root = process.cwd();
const read = (path) => readFile(`${root}/${path}`, 'utf8');

const safeMetadata = sanitizeAuditMetadata({
  password: 'secret-password',
  token: 'secret-token',
  nested: {
    authorization: 'Bearer secret',
    session: 'session-secret',
    visible: 'allowed',
  },
  changedFields: ['name', 'phone'],
});
assert.equal(safeMetadata.password, '[redacted]');
assert.equal(safeMetadata.token, '[redacted]');
assert.equal(safeMetadata.nested.authorization, '[redacted]');
assert.equal(safeMetadata.nested.session, '[redacted]');
assert.equal(safeMetadata.nested.visible, 'allowed');

const writes = [];
const fakeDb = {
  prepare(sql) {
    assert.match(sql, /INSERT INTO audit_logs/);
    return {
      bind(...values) {
        return {
          async run() {
            writes.push(values);
            return { success: true };
          },
        };
      },
    };
  },
};

const auditEnv = { DB: fakeDb, INLET_AUDIT_HASH_SECRET: 'audit-qa-secret' };
const request = new Request('https://pagero.kr/api/auth/login', {
  method: 'POST',
  headers: {
    'CF-Connecting-IP': '203.0.113.25',
    'User-Agent': 'Audit QA Browser/1.0',
  },
});
await writeAuditLog({
  request,
  env: auditEnv,
  actorAccountId: 'user-audit',
  action: 'account.profile_changed',
  targetType: 'account',
  targetId: 'user-audit',
  metadata: { password: 'never-store', changedFields: ['name'] },
});
assert.equal(writes.length, 1);
assert.equal(writes[0][2], 'user-audit');
assert.equal(writes[0][3], 'account.profile_changed');
assert.match(writes[0][6], /^sha256:[a-f0-9]{64}$/);
assert.match(writes[0][7], /^sha256:[a-f0-9]{64}$/);
assert.notEqual(writes[0][6], '203.0.113.25');
assert.notEqual(writes[0][7], 'Audit QA Browser/1.0');
assert.equal(JSON.parse(writes[0][8]).password, '[redacted]');

await writePageManagerAuditChanges({
  request,
  env: auditEnv,
  identity: { ownerId: 'owner-audit' },
  projectId: 'project-audit',
  previousPage: {
    ownership: {
      managers: [
        { id: 'manager-a', email: 'manager-a@example.com', status: 'active', access: { edit: { read: true, write: false } } },
        { id: 'manager-b', email: 'manager-b@example.com', status: 'active', access: { stats: { read: true, write: false } } },
      ],
    },
  },
  nextPage: {
    ownership: {
      managers: [
        { id: 'manager-a', email: 'manager-a@example.com', status: 'disabled', access: { edit: { read: true, write: true } } },
        { id: 'manager-c', email: 'manager-c@example.com', status: 'active', access: { inbox: { read: true, write: false } } },
      ],
    },
  },
});
const managerActions = writes.slice(1).map((values) => values[3]);
assert.deepEqual(managerActions.sort(), [
  'manager.member_added',
  'manager.permissions_changed',
  'manager.removed',
  'manager.status_changed',
].sort());
assert.doesNotMatch(JSON.stringify(writes), /manager-[abc]@example\.com/);

assert.equal(normalizedProjectStatusAction({ action: 'pause' }), 'pause');
assert.equal(normalizedProjectStatusAction({ status: 'active' }), 'restore');
assert.equal(normalizedProjectStatusAction({ status: 'archived' }), 'archive');
assert.equal(normalizedProjectStatusAction({ action: 'unknown' }), '');
assert.deepEqual(projectActionState('pause'), {
  dbStatus: 'archived',
  auditAction: 'project.paused',
  operatorState: 'paused',
});
assert.deepEqual(projectActionState('restore'), {
  dbStatus: 'active',
  auditAction: 'project.restored',
  operatorState: 'active',
});

assert.equal(auditRetentionDays({}), 730);
assert.equal(auditRetentionDays({ INLET_AUDIT_RETENTION_DAYS: '30' }), 365);
assert.equal(auditRetentionDays({ INLET_AUDIT_RETENTION_DAYS: '9000' }), 3650);
assert.equal(auditRetentionBatchLimit({}), 1000);
assert.equal(auditRetentionBatchLimit({ INLET_AUDIT_RETENTION_BATCH_LIMIT: '9000' }), 5000);
assert.equal(hasAuditRetentionSecret(new Request('https://pagero.kr/api/admin/audit/retention', {
  headers: { Authorization: 'Bearer qa-retention-secret' },
}), { INLET_AUDIT_RETENTION_SECRET: 'qa-retention-secret' }), true);
assert.equal(hasAuditRetentionSecret(new Request('https://pagero.kr/api/admin/audit/retention', {
  headers: { Authorization: 'Bearer wrong-secret' },
}), { INLET_AUDIT_RETENTION_SECRET: 'qa-retention-secret' }), false);

const adminPageResponse = await renderAdminAuditPage({
  request: new Request('https://pagero.kr/admin/audit'),
});
assert.equal(adminPageResponse.status, 200);
assert.equal(adminPageResponse.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive');
assert.match(adminPageResponse.headers.get('Content-Security-Policy') || '', /frame-ancestors 'none'/);
const adminPageHtml = await adminPageResponse.text();
for (const token of [
  'inlet-auth-v1',
  '/api/admin/audit',
  '/api/admin/summary',
  '/api/admin/projects/',
  '/api/admin/accounts/',
  'noindex,nofollow,noarchive',
  '일시중지',
  '계정 상태',
  '정지',
  '복원',
]) {
  assert(adminPageHtml.includes(token), `route-only audit UI missing ${token}`);
}
assert.doesNotMatch(adminPageHtml, /pc9839a@naver\.com|roadfor@kakao\.com|admin@pagero\.kr/);
assert.doesNotMatch(adminPageHtml, /INLET_SESSION_SECRET|INLET_API_TOKEN|INLET_AUDIT_HASH_SECRET|INLET_AUDIT_RETENTION_SECRET/);

assert.equal(isPlatformMasterIdentity({ email: 'user@example.com', role: 'superadmin' }), false);
assert.equal(isPlatformMasterIdentity({ email: 'pc9839a@naver.com', role: 'manager' }), true);

const [
  adminAuth,
  adminMiddleware,
  adminAudit,
  auditWriter,
  registerSource,
  loginSource,
  verificationSource,
  accountSource,
  accountEmailSource,
  statusSource,
  passwordSource,
  inviteRouteSource,
  inviteHelperSource,
  ownershipRequestSource,
  ownershipAdminSource,
  projectStatusSource,
  accountAdminStatusSource,
  retentionSource,
  retentionWorkflow,
  pageAuditSource,
  pageRouteSource,
  routeOnlyAuditSource,
  accountEmailFormSource,
  accountActionsSource,
  authAccountsSource,
  envExample,
] = await Promise.all([
  read('functions/api/admin/_auth.js'),
  read('functions/api/admin/_middleware.js'),
  read('functions/api/admin/audit.js'),
  read('functions/api/_audit.js'),
  read('functions/api/auth/register.js'),
  read('functions/api/auth/login.js'),
  read('functions/api/auth/email-verification.js'),
  read('functions/api/auth/account.js'),
  read('functions/api/auth/account/email.js'),
  read('functions/api/auth/account/status.js'),
  read('functions/api/auth/password.js'),
  read('functions/api/projects/invites.js'),
  read('functions/api/projects/_invites.js'),
  read('functions/api/projects/ownership-transfer.js'),
  read('functions/api/admin/ownership-transfer/[id].js'),
  read('functions/api/admin/projects/[id]/status.js'),
  read('functions/api/admin/accounts/[id]/status.js'),
  read('functions/api/admin/audit/retention.js'),
  read('.github/workflows/audit-retention.yml'),
  read('functions/api/pages/_pageAudit.js'),
  read('functions/api/pages/[slug].js'),
  read('functions/admin/audit.js'),
  read('src/panels/settings/AccountEmailForm.jsx'),
  read('src/panels/settings/accountSettingsActions.js'),
  read('src/lib/authAccounts.js'),
  read('.env.example'),
]);

assert.match(adminAuth, /isPlatformMasterIdentity/);
assert.match(adminAuth, /PLATFORM_MASTER_REQUIRED/);
assert.doesNotMatch(adminAuth, /superadmin|serviceadmin|platform_master.*role/i);
assert.match(adminMiddleware, /requirePlatformMaster/);
assert.match(adminMiddleware, /INLET_DOMAIN_RECHECK_SECRET/);
assert.match(adminMiddleware, /INLET_AUDIT_RETENTION_SECRET/);
assert.doesNotMatch(adminMiddleware, /superadmin|serviceadmin/);

for (const token of [
  'audit_logs.action = ?',
  'audit_logs.actor_account_id = ?',
  'audit_logs.project_id = ?',
  'audit_logs.target_type = ?',
  'audit_logs.created_at >= ?',
  'audit_logs.created_at <= ?',
  'nextCursor',
  'hasMore',
]) {
  assert(adminAudit.includes(token), `admin audit endpoint missing ${token}`);
}
assert.doesNotMatch(adminAudit, /audit_logs\.ip[\s,]/);
assert.doesNotMatch(adminAudit, /audit_logs\.user_agent[\s,]/);
assert.doesNotMatch(adminAudit, /DELETE FROM audit_logs|UPDATE audit_logs/);

for (const token of ['REDACTED_KEY', 'INLET_AUDIT_HASH_SECRET', 'sha256:', 'audit log write failed']) {
  assert(auditWriter.includes(token), `audit writer missing ${token}`);
}
for (const [name, source, actions] of [
  ['register', registerSource, ['account.signup_completed', 'account.signup_failed']],
  ['login', loginSource, ['auth.login_succeeded', 'auth.login_failed']],
  ['verification', verificationSource, ['auth.email_verification_requested', 'auth.email_verification_request_failed', 'email-change', 'AUTH_EMAIL_DUPLICATE']],
  ['account', accountSource, ['account.profile_changed', 'changedFields']],
  ['email change', accountEmailSource, ['account.email_changed', 'account.email_change_failed', 'previousEmailHash', 'nextEmailHash', 'previousSessionsInvalidated', 'AUTH_CURRENT_PASSWORD_REQUIRED']],
  ['status', statusSource, ['account.status_changed', 'previousStatus', 'nextStatus']],
  ['password', passwordSource, ['account.password_changed', 'account.password_change_failed', 'sessionRotationRequired']],
  ['invite route', inviteRouteSource, ['manager.invite_created']],
  ['invite acceptance', inviteHelperSource, ['manager.invite_accepted']],
  ['ownership request', ownershipRequestSource, ['ownership_transfer.requested']],
  ['ownership admin', ownershipAdminSource, ['ownership_transfer.approved', 'ownership_transfer.rejected', 'ownership_transfer.completed', 'ownership_transfer.canceled']],
  ['project operations', projectStatusSource, ['project.paused', 'project.restored', 'requirePlatformMaster', "source: 'platform_master'"]],
  ['account operations', accountAdminStatusSource, ['account.suspended_by_admin', 'account.restored_by_admin', 'ACCOUNT_SELF_STATUS_CHANGE_BLOCKED', 'PLATFORM_MASTER_STATUS_CHANGE_BLOCKED', "source: 'platform_master'"]],
  ['retention', retentionSource, ['audit.retention_completed', 'audit.retention_dry_run', 'INLET_AUDIT_RETENTION_SECRET', 'DELETE FROM audit_logs', 'LIMIT ?']],
  ['manager page diff', pageAuditSource, ['manager.member_added', 'manager.permissions_changed', 'manager.status_changed', 'manager.removed']],
  ['project archive', pageRouteSource, ['project.archived', 'writePageManagerAuditChanges']],
  ['route-only audit UI', routeOnlyAuditSource, ['/api/admin/audit', '/api/admin/projects/', '/api/admin/accounts/', 'noindex,nofollow,noarchive']],
  ['account email form', accountEmailFormSource, ['새 이메일', '인증 코드', 'current-password', 'one-time-code', 'onSendCode']],
  ['account settings actions', accountActionsSource, ['changeAuthEmail', "requestEmailVerification(nextEmail, 'email-change')", 'currentPassword: emailDraft.currentPassword', 'token: String(emailDraft.code', 'localStorage.setItem(AUTH_KEY']],
  ['auth accounts client', authAccountsSource, ['/api/auth/account/email', 'AUTH_CURRENT_PASSWORD_INVALID']],
  ['retention workflow', retentionWorkflow, ['PAGERO_AUDIT_RETENTION_SECRET', 'skipped-live', 'dryRun']],
  ['environment', envExample, ['INLET_AUDIT_HASH_SECRET', 'INLET_AUDIT_RETENTION_DAYS', 'INLET_AUDIT_RETENTION_SECRET']],
]) {
  for (const action of actions) assert(source.includes(action), `${name} source missing ${action}`);
  assert.doesNotMatch(source, /metadata:\s*\{[^}]*password\s*:/s, `${name} audit metadata must not store passwords`);
}
assert.doesNotMatch(pageAuditSource, /metadata:\s*\{[^}]*email\s*:/s);
assert.doesNotMatch(passwordSource, /metadata:\s*\{[^}]*password\s*:/s);
assert.doesNotMatch(accountEmailSource, /metadata:\s*\{[^}]*currentPassword\s*:/s);
assert.doesNotMatch(accountEmailSource, /metadata:\s*\{[^}]*token\s*:/s);
assert.doesNotMatch(routeOnlyAuditSource, /PLATFORM_MASTER_EMAILS|DEFAULT_MASTER_EMAILS/);
assert.match(retentionSource, /action NOT LIKE 'audit\.retention_%'/);
assert.doesNotMatch(retentionWorkflow, /echo[^\n]*\$\{?RETENTION_SECRET|\bset\s+-x\b/);

console.log(JSON.stringify({
  ok: true,
  check: 'admin-audit-hardening',
  platformMasterByEmailOnly: true,
  rawIpExposed: false,
  rawUserAgentExposed: false,
  ordinaryAuditDeleteEndpoint: false,
  auditedFlows: 19,
  managerDiffRuntimeActions: managerActions.length,
  routeOnlyAuditUi: true,
  projectPauseRestorePolicy: true,
  accountSuspendRestorePolicy: true,
  verifiedEmailChange: true,
  scheduledAuditRetention: true,
}, null, 2));