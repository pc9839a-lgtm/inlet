import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { sanitizeAuditMetadata, writeAuditLog } from '../functions/api/_audit.js';
import { isPlatformMasterIdentity } from '../functions/api/_platformMaster.js';

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

const request = new Request('https://pagero.kr/api/auth/login', {
  method: 'POST',
  headers: {
    'CF-Connecting-IP': '203.0.113.25',
    'User-Agent': 'Audit QA Browser/1.0',
  },
});
await writeAuditLog({
  request,
  env: { DB: fakeDb, INLET_AUDIT_HASH_SECRET: 'audit-qa-secret' },
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
  statusSource,
] = await Promise.all([
  read('functions/api/admin/_auth.js'),
  read('functions/api/admin/_middleware.js'),
  read('functions/api/admin/audit.js'),
  read('functions/api/_audit.js'),
  read('functions/api/auth/register.js'),
  read('functions/api/auth/login.js'),
  read('functions/api/auth/email-verification.js'),
  read('functions/api/auth/account.js'),
  read('functions/api/auth/account/status.js'),
]);

assert.match(adminAuth, /isPlatformMasterIdentity/);
assert.match(adminAuth, /PLATFORM_MASTER_REQUIRED/);
assert.doesNotMatch(adminAuth, /superadmin|serviceadmin|platform_master.*role/i);
assert.match(adminMiddleware, /requirePlatformMaster/);
assert.match(adminMiddleware, /INLET_DOMAIN_RECHECK_SECRET/);
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
  ['verification', verificationSource, ['auth.email_verification_requested', 'auth.email_verification_request_failed']],
  ['account', accountSource, ['account.profile_changed', 'changedFields']],
  ['status', statusSource, ['account.status_changed', 'previousStatus', 'nextStatus']],
]) {
  for (const action of actions) assert(source.includes(action), `${name} audit source missing ${action}`);
  assert.doesNotMatch(source, /metadata:\s*\{[^}]*password\s*:/s, `${name} audit metadata must not store passwords`);
}

console.log(JSON.stringify({
  ok: true,
  check: 'admin-audit-hardening',
  platformMasterByEmailOnly: true,
  rawIpExposed: false,
  rawUserAgentExposed: false,
  auditDeleteEndpoint: false,
  auditedFlows: 5,
}, null, 2));
