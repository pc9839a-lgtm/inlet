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


AUTH = 'functions/api/auth/_auth.js'
ROUTE = 'functions/api/auth/email-verification.js'
CLIENT = 'src/lib/authAccounts.js'
AGGREGATE = 'scripts/auth-quality-check.mjs'

insert_after(
    AUTH,
    "export function authSecret(env = {}) {\n  return String(env.INLET_SESSION_SECRET || env.INLET_API_TOKEN || 'inlet-local-auth-secret');\n}\n",
    """

function verificationRequestIp(request) {
  return String(
    request?.headers?.get?.('CF-Connecting-IP')
      || request?.headers?.get?.('X-Forwarded-For')?.split(',')[0]
      || '',
  ).trim().slice(0, 200);
}

export async function emailVerificationRequesterKey(request, env = {}) {
  const ip = verificationRequestIp(request);
  if (!ip) return '';
  const digest = await hmacHex(`auth-email-requester:v1:${ip}`, authSecret(env));
  return digest.slice(0, 24);
}
""",
)

replace_once(
    AUTH,
    "  await assertEmailVerificationSendAllowed(env.DB, { email, purpose, now });",
    "  await assertEmailVerificationSendAllowed(env.DB, { email, purpose, requesterKey: input.requesterKey, now });",
)
replace_once(
    AUTH,
    "  const stored = await storeEmailVerificationCode(env.DB, { email, purpose, code, expiresAt }, env);",
    "  const stored = await storeEmailVerificationCode(env.DB, { email, purpose, requesterKey: input.requesterKey, code, expiresAt }, env);",
)

old_limit = """async function assertEmailVerificationSendAllowed(db, input = {}) {
  if (!db?.prepare) return;
  const nowMs = Number(input.now || Math.floor(Date.now() / 1000)) * 1000;
  const cooldownAt = new Date(nowMs - 60 * 1000).toISOString();
  const dailyAt = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();

  const recent = await db.prepare(`
    SELECT id, created_at
    FROM auth_email_verifications
    WHERE email = ? AND purpose = ? AND created_at >= ?
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(input.email, input.purpose, cooldownAt).first();
  if (recent) {
    throw authError('Verification email was requested too recently.', 429, {
      code: 'EMAIL_VERIFICATION_COOLDOWN',
      retryAfterSeconds: 60,
    });
  }

  const daily = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM auth_email_verifications
    WHERE email = ? AND purpose = ? AND created_at >= ?
  `).bind(input.email, input.purpose, dailyAt).first();
  if (Number(daily?.count || 0) >= 20) {
    throw authError('Too many verification emails were requested today.', 429, {
      code: 'EMAIL_VERIFICATION_DAILY_LIMIT',
      retryAfterSeconds: 60 * 60,
    });
  }
}
"""
new_limit = """async function assertEmailVerificationSendAllowed(db, input = {}) {
  if (!db?.prepare) return;
  const nowMs = Number(input.now || Math.floor(Date.now() / 1000)) * 1000;
  const cooldownAt = new Date(nowMs - 60 * 1000).toISOString();
  const tenMinutesAt = new Date(nowMs - 10 * 60 * 1000).toISOString();
  const dailyAt = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();

  const recent = await db.prepare(`
    SELECT id, created_at
    FROM auth_email_verifications
    WHERE email = ? AND purpose = ? AND created_at >= ?
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(input.email, input.purpose, cooldownAt).first();
  if (recent) {
    throw authError('Verification email was requested too recently.', 429, {
      code: 'EMAIL_VERIFICATION_COOLDOWN',
      retryAfterSeconds: 60,
    });
  }

  const daily = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM auth_email_verifications
    WHERE email = ? AND purpose = ? AND created_at >= ?
  `).bind(input.email, input.purpose, dailyAt).first();
  if (Number(daily?.count || 0) >= 20) {
    throw authError('Too many verification emails were requested today.', 429, {
      code: 'EMAIL_VERIFICATION_DAILY_LIMIT',
      retryAfterSeconds: 60 * 60,
    });
  }

  const requesterKey = String(input.requesterKey || '').trim().toLowerCase();
  if (!/^[a-f0-9]{24}$/.test(requesterKey)) return;
  const idFrom = `email-verification-${requesterKey}-`;
  const idTo = `${idFrom}\\uffff`;

  const requesterPurposeBurst = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM auth_email_verifications
    WHERE id >= ? AND id < ? AND purpose = ? AND created_at >= ?
  `).bind(idFrom, idTo, input.purpose, tenMinutesAt).first();
  if (Number(requesterPurposeBurst?.count || 0) >= 8) {
    throw authError('Too many verification requests were made.', 429, {
      code: 'EMAIL_VERIFICATION_RATE_LIMITED',
      retryAfterSeconds: 10 * 60,
    });
  }

  const requesterPurposeDaily = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM auth_email_verifications
    WHERE id >= ? AND id < ? AND purpose = ? AND created_at >= ?
  `).bind(idFrom, idTo, input.purpose, dailyAt).first();
  if (Number(requesterPurposeDaily?.count || 0) >= 30) {
    throw authError('Too many verification requests were made.', 429, {
      code: 'EMAIL_VERIFICATION_RATE_LIMITED',
      retryAfterSeconds: 60 * 60,
    });
  }

  const requesterGlobalBurst = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM auth_email_verifications
    WHERE id >= ? AND id < ? AND created_at >= ?
  `).bind(idFrom, idTo, tenMinutesAt).first();
  if (Number(requesterGlobalBurst?.count || 0) >= 20) {
    throw authError('Too many verification requests were made.', 429, {
      code: 'EMAIL_VERIFICATION_RATE_LIMITED',
      retryAfterSeconds: 10 * 60,
    });
  }

  const requesterGlobalDaily = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM auth_email_verifications
    WHERE id >= ? AND id < ? AND created_at >= ?
  `).bind(idFrom, idTo, dailyAt).first();
  if (Number(requesterGlobalDaily?.count || 0) >= 80) {
    throw authError('Too many verification requests were made.', 429, {
      code: 'EMAIL_VERIFICATION_RATE_LIMITED',
      retryAfterSeconds: 60 * 60,
    });
  }
}
"""
replace_once(AUTH, old_limit, new_limit)

replace_once(
    AUTH,
    """function verificationId() {
  return crypto.randomUUID?.() || `email-verification-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
""",
    """function verificationId(requesterKey = '') {
  const safeRequesterKey = /^[a-f0-9]{24}$/.test(String(requesterKey || '').trim().toLowerCase())
    ? String(requesterKey).trim().toLowerCase()
    : 'anonymous';
  const suffix = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `email-verification-${safeRequesterKey}-${suffix}`;
}
""",
)
replace_once(
    AUTH,
    "  const id = verificationId();",
    "  const id = verificationId(record.requesterKey);",
)

replace_once(
    ROUTE,
    "import { AUTH_METHODS, authError, issueEmailVerificationToken, normalizeEmail, normalizeEmailVerificationPurpose } from './_auth.js';",
    "import { AUTH_METHODS, authError, emailVerificationRequesterKey, issueEmailVerificationToken, normalizeEmail, normalizeEmailVerificationPurpose } from './_auth.js';",
)
replace_once(
    ROUTE,
    "    const verification = await issueEmailVerificationToken(input, env);",
    "    const requesterKey = await emailVerificationRequesterKey(request, env);\n    const verification = await issueEmailVerificationToken({ ...input, requesterKey }, env);",
)

replace_once(
    CLIENT,
    "    EMAIL_VERIFICATION_DAILY_LIMIT: '오늘 인증 메일 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',",
    "    EMAIL_VERIFICATION_DAILY_LIMIT: '오늘 인증 메일 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',\n    EMAIL_VERIFICATION_RATE_LIMITED: '인증 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',",
)
replace_once(
    CLIENT,
    "  if (/too many verification emails/i.test(message)) return byCode.EMAIL_VERIFICATION_DAILY_LIMIT;",
    "  if (/too many verification emails/i.test(message)) return byCode.EMAIL_VERIFICATION_DAILY_LIMIT;\n  if (/too many verification requests/i.test(message)) return byCode.EMAIL_VERIFICATION_RATE_LIMITED;",
)

Path('scripts/auth-email-abuse-quality-check.mjs').write_text(r'''import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { emailVerificationRequesterKey, issueEmailVerificationToken } from '../functions/api/auth/_auth.js';

const authSource = await fs.readFile(new URL('../functions/api/auth/_auth.js', import.meta.url), 'utf8');
const routeSource = await fs.readFile(new URL('../functions/api/auth/email-verification.js', import.meta.url), 'utf8');
const clientSource = await fs.readFile(new URL('../src/lib/authAccounts.js', import.meta.url), 'utf8');

assert.match(authSource, /CF-Connecting-IP/);
assert.match(authSource, /auth-email-requester:v1:/);
assert.match(authSource, /EMAIL_VERIFICATION_RATE_LIMITED/);
assert.match(authSource, /id >= \? AND id < \?/);
assert.match(authSource, /requesterPurposeBurst/);
assert.match(authSource, /requesterGlobalDaily/);
assert.match(routeSource, /emailVerificationRequesterKey\(request, env\)/);
assert.match(clientSource, /EMAIL_VERIFICATION_RATE_LIMITED/);

function requestWithIp(ip) {
  return new Request('https://pagero.kr/api/auth/email-verification', {
    headers: { 'CF-Connecting-IP': ip },
  });
}

const env = {
  INLET_SESSION_SECRET: 'test-session-secret-at-least-32-characters',
  INLET_AUTH_EMAIL_PROVIDER: 'mock',
  INLET_AUTH_EMAIL_EXPOSE_TOKEN: '1',
};
const firstKey = await emailVerificationRequesterKey(requestWithIp('203.0.113.10'), env);
const sameKey = await emailVerificationRequesterKey(requestWithIp('203.0.113.10'), env);
const otherKey = await emailVerificationRequesterKey(requestWithIp('203.0.113.11'), env);
assert.match(firstKey, /^[a-f0-9]{24}$/);
assert.equal(firstKey, sameKey);
assert.notEqual(firstKey, otherKey);
assert.equal(firstKey.includes('203.0.113.10'), false);

function fakeDb({ purposeBurst = 0, purposeDaily = 0, globalBurst = 0, globalDaily = 0 } = {}) {
  const insertedIds = [];
  return {
    insertedIds,
    prepare(sql) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      return {
        bind(...args) {
          return {
            async first() {
              if (normalized.includes('WHERE email = ? AND purpose = ? AND created_at >= ?') && normalized.includes('LIMIT 1')) return null;
              if (normalized.includes('WHERE email = ? AND purpose = ? AND created_at >= ?')) return { count: 0 };
              if (normalized.includes('id >= ? AND id < ? AND purpose = ?') && String(args[3]).includes('T')) {
                return { count: normalized.includes('purpose = ?') && args[3] < new Date(Date.now() - 60 * 60 * 1000).toISOString() ? purposeDaily : purposeBurst };
              }
              if (normalized.includes('id >= ? AND id < ? AND created_at >= ?')) {
                return { count: args[2] < new Date(Date.now() - 60 * 60 * 1000).toISOString() ? globalDaily : globalBurst };
              }
              return null;
            },
            async run() {
              if (normalized.startsWith('INSERT INTO auth_email_verifications')) insertedIds.push(args[0]);
              return { meta: { changes: 1 } };
            },
            async all() { return { results: [] }; },
          };
        },
      };
    },
  };
}

const allowedDb = fakeDb();
const verification = await issueEmailVerificationToken({
  email: 'rate-limit-test@example.com',
  purpose: 'password-reset',
  requesterKey: firstKey,
}, { ...env, DB: allowedDb });
assert.equal(verification.status, 'pending');
assert.equal(allowedDb.insertedIds.length, 1);
assert.match(allowedDb.insertedIds[0], new RegExp(`^email-verification-${firstKey}-`));
assert.equal(allowedDb.insertedIds[0].includes('203.0.113.10'), false);

async function captureCode(options) {
  try {
    await issueEmailVerificationToken({
      email: `blocked-${Math.random()}@example.com`,
      purpose: 'password-reset',
      requesterKey: firstKey,
    }, { ...env, DB: fakeDb(options) });
  } catch (error) {
    return { code: error?.details?.code, status: error?.status, retryAfterSeconds: error?.details?.retryAfterSeconds };
  }
  throw new Error('expected rate limit failure');
}

const purposeBurstError = await captureCode({ purposeBurst: 8 });
assert.equal(purposeBurstError.code, 'EMAIL_VERIFICATION_RATE_LIMITED');
assert.equal(purposeBurstError.status, 429);
assert.equal(purposeBurstError.retryAfterSeconds, 600);

const globalDailyError = await captureCode({ globalDaily: 80 });
assert.equal(globalDailyError.code, 'EMAIL_VERIFICATION_RATE_LIMITED');
assert.equal(globalDailyError.status, 429);
assert.equal(globalDailyError.retryAfterSeconds, 3600);

console.log(JSON.stringify({ ok: true, checks: 18 }, null, 2));
''', encoding='utf-8')

replace_once(
    AGGREGATE,
    "await import('./auth-verification-purpose-consumption-quality-check.mjs');",
    "await import('./auth-verification-purpose-consumption-quality-check.mjs');\nawait import('./auth-email-abuse-quality-check.mjs');",
)
replace_once(AGGREGATE, '  checks: 68,', '  checks: 86,')

Path('docs/ops-auth-email-abuse-protection.md').write_text('''# 인증 메일 악용 방지\n\n## 적용 범위\n\n- 기존 이메일·목적 기준 60초 재요청 제한과 일 20회 제한을 유지한다.\n- Cloudflare `CF-Connecting-IP`를 서버 Secret으로 HMAC 처리한 24자리 키를 사용한다.\n- 원본 IP는 인증 테이블, 응답, 로그에 저장하지 않는다.\n- 동일 요청자·동일 목적은 10분 8회, 24시간 30회로 제한한다.\n- 동일 요청자 전체 목적 합계는 10분 20회, 24시간 80회로 제한한다.\n- 제한 응답은 공통 `EMAIL_VERIFICATION_RATE_LIMITED` 코드와 재시도 시간만 반환한다.\n\n## 저장 방식\n\n별도 D1 migration 없이 인증 레코드의 기존 기본키 앞부분에 HMAC 요청자 키를 포함한다. SQLite 기본키 범위 조회로 요청자별 횟수를 계산하며 이메일과 원본 IP는 기본키에 포함하지 않는다.\n\n## 안전 기준\n\n- 이메일 주소를 바꿔가며 요청해도 요청자 제한을 우회할 수 없어야 한다.\n- 회원가입·비밀번호 재설정·이메일 변경 목적을 바꿔가며 요청해도 전체 제한이 적용되어야 한다.\n- 메일 발송 실패 시 기존 정리 로직이 인증 레코드를 삭제한다.\n- 공개 메인, 템플릿, 가격, 1페이지 정책, CallTag는 변경하지 않는다.\n''', encoding='utf-8')

print('Applied auth email abuse rate-limit patch.')
