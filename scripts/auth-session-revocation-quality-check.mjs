import { accountSessionVersion, createSessionToken, getSessionAccount } from '../functions/api/auth/_auth.js';
import { authAccountErrorMessage } from '../src/lib/authAccounts.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function accountRow(overrides = {}) {
  return {
    id: 'user_session_qa',
    email: 'session-qa@example.test',
    phone: '01012345678',
    name: '세션 QA',
    password_hash: 'password-hash-v1',
    email_verified_at: '2026-08-01T00:00:00.000Z',
    status: 'active',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function createAccountDb(state) {
  return {
    prepare(sql = '') {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      return {
        bind(...args) {
          return {
            async first() {
              if (normalized === 'SELECT * FROM accounts WHERE email = ? LIMIT 1') {
                return String(state.row.email || '').toLowerCase() === String(args[0] || '').toLowerCase()
                  ? { ...state.row }
                  : null;
              }
              throw new Error(`unexpected session QA first query: ${normalized}`);
            },
          };
        },
      };
    },
  };
}

function requestFor(session) {
  return new Request('https://pagero.kr/api/auth/session', {
    headers: { 'X-Inlet-Session': session },
  });
}

function decodePayload(session) {
  const part = String(session || '').split('.')[0] || '';
  const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

async function captureCode(run, expectedCode, expectedStatus = 401) {
  try {
    await run();
  } catch (error) {
    assert(error?.status === expectedStatus, `expected status ${expectedStatus}, got ${error?.status}`);
    assert(error?.details?.code === expectedCode, `expected ${expectedCode}, got ${error?.details?.code}`);
    return error;
  }
  throw new Error(`expected ${expectedCode}`);
}

const state = { row: accountRow() };
const env = {
  DB: createAccountDb(state),
  INLET_SESSION_SECRET: 'auth-session-revocation-secret-32-characters',
};

const initialSession = await createSessionToken({
  ownerId: state.row.id,
  email: state.row.email,
  role: 'master',
}, env);
const initialPayload = decodePayload(initialSession);
assert(initialPayload.sessionVersion, 'new sessions must contain an account security version');
await getSessionAccount(requestFor(initialSession), env);

const versionBeforeProfileEdit = await accountSessionVersion({
  id: state.row.id,
  ownerId: state.row.id,
  email: state.row.email,
  passwordHash: state.row.password_hash,
  status: state.row.status,
  emailVerifiedAt: state.row.email_verified_at,
  name: state.row.name,
  phone: state.row.phone,
}, env);
state.row = accountRow({
  name: '프로필 변경',
  phone: '01099998888',
  updated_at: new Date().toISOString(),
});
const versionAfterProfileEdit = await accountSessionVersion({
  id: state.row.id,
  ownerId: state.row.id,
  email: state.row.email,
  passwordHash: state.row.password_hash,
  status: state.row.status,
  emailVerifiedAt: state.row.email_verified_at,
  name: state.row.name,
  phone: state.row.phone,
}, env);
assert(versionBeforeProfileEdit === versionAfterProfileEdit, 'name and phone edits must not revoke sessions');
await getSessionAccount(requestFor(initialSession), env);

state.row = accountRow({
  password_hash: 'password-hash-v2',
  updated_at: new Date().toISOString(),
});
await captureCode(() => getSessionAccount(requestFor(initialSession), env), 'AUTH_SESSION_REVOKED');

const rotatedSession = await createSessionToken({
  ownerId: state.row.id,
  email: state.row.email,
  role: 'master',
}, env);
assert(decodePayload(rotatedSession).sessionVersion !== initialPayload.sessionVersion, 'password change must rotate the account session version');
await getSessionAccount(requestFor(rotatedSession), env);

state.row = accountRow({
  password_hash: 'password-hash-v2',
  status: 'suspended',
  updated_at: new Date().toISOString(),
});
await captureCode(() => getSessionAccount(requestFor(rotatedSession), env), 'AUTH_ACCOUNT_SUSPENDED', 403);

state.row = accountRow({
  password_hash: 'password-hash-v3',
  updated_at: new Date(Date.now() - 60_000).toISOString(),
});
const legacySession = await createSessionToken({
  ownerId: state.row.id,
  email: state.row.email,
  role: 'master',
}, {
  INLET_SESSION_SECRET: env.INLET_SESSION_SECRET,
});
assert(!decodePayload(legacySession).sessionVersion, 'legacy compatibility token fixture must omit session version');
await getSessionAccount(requestFor(legacySession), env);
state.row.updated_at = new Date(Date.now() + 10_000).toISOString();
await captureCode(() => getSessionAccount(requestFor(legacySession), env), 'AUTH_SESSION_REVOKED');

state.row = accountRow({ password_hash: 'password-hash-v4' });
const ownerBoundSession = await createSessionToken({
  ownerId: state.row.id,
  email: state.row.email,
}, env);
state.row.id = 'different-owner-id';
await captureCode(() => getSessionAccount(requestFor(ownerBoundSession), env), 'AUTH_SESSION_REVOKED');

assert(
  authAccountErrorMessage({ details: { code: 'AUTH_SESSION_REVOKED' } }) === '보안을 위해 로그인 세션이 종료되었습니다. 다시 로그인해주세요.',
  'revoked sessions need a clear Korean login message',
);

console.log(JSON.stringify({
  ok: true,
  checks: 10,
  contracts: [
    'new-session-security-version',
    'profile-edit-session-stability',
    'password-change-revocation',
    'rotated-session-valid',
    'suspension-denied',
    'legacy-session-transition',
    'owner-binding',
  ],
}, null, 2));
