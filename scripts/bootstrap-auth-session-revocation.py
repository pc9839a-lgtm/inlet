from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one exact match, found {count}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


def insert_after(path, marker, addition):
    replace_once(path, marker, marker + addition)


auth_path = 'functions/api/auth/_auth.js'
auth_secret_block = """export function authSecret(env = {}) {
  return String(env.INLET_SESSION_SECRET || env.INLET_API_TOKEN || 'inlet-local-auth-secret');
}
"""
insert_after(
    auth_path,
    auth_secret_block,
    """

export async function accountSessionVersion(user = {}, env = {}) {
  const ownerId = String(user.ownerId || user.id || '').trim();
  const email = normalizeEmail(user.email || '');
  if (!ownerId || !email) return '';
  const material = JSON.stringify({
    ownerId,
    email,
    passwordHash: String(user.passwordHash || user.password_hash || ''),
    status: normalizeAccountStatus(user.status || 'active'),
    emailVerifiedAt: String(user.emailVerifiedAt || user.email_verified_at || ''),
  });
  return hmacHex(`account-session:v1:${material}`, authSecret(env));
}

async function sessionAccountForToken(input = {}, env = {}) {
  const email = normalizeEmail(input.email || input.user?.email || input.account?.email || '');
  if (env.DB?.prepare && email) {
    return getD1AccountByEmail(env.DB, email);
  }
  return input.user || input.account || null;
}

function revokedSessionError() {
  return authError('Session was revoked. Please sign in again.', 401, {
    code: 'AUTH_SESSION_REVOKED',
  });
}
""",
)

old_create = """export async function createSessionToken(input = {}, env = {}) {
  const secret = authSecret(env);
  if (!secret) return '';
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    ownerId: String(input.ownerId || ''),
    projectId: String(input.projectId || ''),
    role: String(input.role || 'master'),
    email: normalizeEmail(input.email || ''),
    iat: now,
    exp: now + 60 * 60 * 24 * 30,
  };
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  return `${payloadPart}.${await hmacBase64Url(payloadPart, secret)}`;
}
"""
new_create = """export async function createSessionToken(input = {}, env = {}) {
  const secret = authSecret(env);
  if (!secret) return '';
  const now = Math.floor(Date.now() / 1000);
  const email = normalizeEmail(input.email || input.user?.email || input.account?.email || '');
  const account = await sessionAccountForToken({ ...input, email }, env);
  const sessionVersion = account
    ? await accountSessionVersion(account, env)
    : String(input.sessionVersion || '').trim();
  const payload = {
    ownerId: String(input.ownerId || account?.ownerId || account?.id || ''),
    projectId: String(input.projectId || ''),
    role: String(input.role || 'master'),
    email,
    ...(sessionVersion ? { sessionVersion } : {}),
    iat: now,
    exp: now + 60 * 60 * 24 * 30,
  };
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  return `${payloadPart}.${await hmacBase64Url(payloadPart, secret)}`;
}
"""
replace_once(auth_path, old_create, new_create)

old_get = """export async function getSessionAccount(request, env = {}, input = {}) {
  const payload = await verifySessionToken(sessionTokenFromRequest(request, input), env);
  if (!payload) throw authError('Session is invalid or expired.', 401, { code: 'AUTH_SESSION_INVALID' });
  const email = normalizeEmail(payload.email || input.email || '');
  const user = email ? await getD1AccountByEmail(env.DB, email) : null;
  if (!user) throw authError('Session account was not found.', 404, { code: 'AUTH_ACCOUNT_NOT_FOUND' });
  assertAccountActive(user, 'refresh session');
  if (user.emailVerified !== true) throw authError('Email verification is required before session refresh.', 403, { code: 'EMAIL_VERIFICATION_REQUIRED' });
  return { payload, user };
}
"""
new_get = """export async function getSessionAccount(request, env = {}, input = {}) {
  const payload = await verifySessionToken(sessionTokenFromRequest(request, input), env);
  if (!payload) throw authError('Session is invalid or expired.', 401, { code: 'AUTH_SESSION_INVALID' });
  const email = normalizeEmail(payload.email || input.email || '');
  const user = email ? await getD1AccountByEmail(env.DB, email) : null;
  if (!user) throw authError('Session account was not found.', 404, { code: 'AUTH_ACCOUNT_NOT_FOUND' });
  if (payload.ownerId && String(payload.ownerId) !== String(user.ownerId || user.id || '')) {
    throw revokedSessionError();
  }
  assertAccountActive(user, 'refresh session');
  if (user.emailVerified !== true) throw authError('Email verification is required before session refresh.', 403, { code: 'EMAIL_VERIFICATION_REQUIRED' });

  const expectedSessionVersion = await accountSessionVersion(user, env);
  if (payload.sessionVersion) {
    if (!expectedSessionVersion || String(payload.sessionVersion) !== expectedSessionVersion) {
      throw revokedSessionError();
    }
  } else {
    const issuedAtMs = Number(payload.iat || 0) * 1000;
    const accountUpdatedAtMs = Date.parse(user.updatedAt || '');
    if (!issuedAtMs || (Number.isFinite(accountUpdatedAtMs) && accountUpdatedAtMs > issuedAtMs + 1000)) {
      throw revokedSessionError();
    }
  }
  return { payload, user };
}
"""
replace_once(auth_path, old_get, new_get)

client_path = 'src/lib/authAccounts.js'
replace_once(
    client_path,
    "    AUTH_SESSION_INVALID: '로그인 세션이 만료되었습니다. 다시 로그인해주세요.',\n",
    "    AUTH_SESSION_INVALID: '로그인 세션이 만료되었습니다. 다시 로그인해주세요.',\n    AUTH_SESSION_REVOKED: '보안을 위해 로그인 세션이 종료되었습니다. 다시 로그인해주세요.',\n",
)

auth_quality_path = 'scripts/auth-quality-check.mjs'
replace_once(
    auth_quality_path,
    "await import('./auth-verification-purpose-consumption-quality-check.mjs');\n",
    "await import('./auth-verification-purpose-consumption-quality-check.mjs');\nawait import('./auth-session-revocation-quality-check.mjs');\n",
)
replace_once(auth_quality_path, '  checks: 68,', '  checks: 78,')

Path('scripts/auth-session-revocation-quality-check.mjs').write_text("""import { accountSessionVersion, createSessionToken, getSessionAccount } from '../functions/api/auth/_auth.js';
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
      const normalized = String(sql).replace(/\\s+/g, ' ').trim();
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
""", encoding='utf-8')

Path('docs/ops-auth-session-revocation.md').write_text("""# 인증 세션 무효화 정책

## 적용 범위

페이지로 인증 세션은 계정의 보안 상태에 결합됩니다.

- 계정 ID
- 이메일
- 비밀번호 해시
- 계정 상태
- 이메일 인증 시각

이 값으로 서버 전용 HMAC 세션 버전을 만들고 서명된 세션 토큰에 포함합니다. 이름과 휴대폰번호 같은 일반 프로필 수정은 세션 버전에 포함하지 않습니다.

## 무효화 조건

다음 변경 이후 기존 세션은 다음 API 요청에서 거부됩니다.

- 비밀번호 변경 또는 재설정
- 계정 ID나 이메일 변경
- 계정 정지·탈퇴 상태 변경
- 이메일 인증 보안 상태 변경

서버는 `AUTH_SESSION_REVOKED`를 반환하며 사용자는 다시 로그인해야 합니다.

## 기존 세션 전환

배포 전에 발급되어 세션 버전이 없는 토큰은 계정의 `updated_at`이 토큰 발급 이후 변경되지 않았을 때만 한 번 허용됩니다. 세션 갱신 시 새 버전이 포함된 토큰으로 교체됩니다. 계정이 토큰 발급 후 변경됐다면 기존 토큰은 즉시 거부됩니다.

## 데이터베이스

새 컬럼이나 마이그레이션은 추가하지 않습니다. 기존 계정 필드와 서버 Secret으로 버전을 계산하므로 운영 D1 쓰기 작업이 필요하지 않습니다.
""", encoding='utf-8')

print('Applied auth session revocation patch.')
