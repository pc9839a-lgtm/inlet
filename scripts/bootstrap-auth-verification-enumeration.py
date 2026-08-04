from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one exact match, found {count}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


AUTH = 'functions/api/auth/_auth.js'
ROUTE = 'functions/api/auth/email-verification.js'
AGGREGATE = 'scripts/auth-quality-check.mjs'

replace_once(
    AUTH,
    """  if (purpose === 'signup' && env.DB?.prepare && await getD1AccountByEmail(env.DB, email)) {
    throw authError('Email is already registered.', 409, { code: 'AUTH_EMAIL_DUPLICATE', field: 'email' });
  }

""",
    '',
)

replace_once(
    AUTH,
    """  const email = normalizeEmail(input.email || '');
  const purpose = requireEmailVerificationPurpose(input.purpose || 'signup');
""",
    """  const email = normalizeEmail(input.email || '');
  const purpose = requireEmailVerificationPurpose(input.purpose || 'signup');
  const suppressDelivery = input.suppressDelivery === true;
  const concealDeliveryFailure = input.concealDeliveryFailure === true;
""",
)

replace_once(
    AUTH,
    """  let delivery;
  try {
    delivery = await deliverAuthEmail({ email, purpose, token: code, expiresAt }, env, provider);
  } catch (error) {
    const cleanupOk = stored.id
      ? await removeEmailVerificationCode(env.DB, { id: stored.id, email, purpose })
      : true;
    if (!cleanupOk) {
      console.error('auth email verification cleanup failed', {
        code: 'EMAIL_VERIFICATION_CLEANUP_FAILED',
        provider,
      });
    }
    throw sanitizedAuthEmailDeliveryError(error, provider);
  }
""",
    """  let delivery;
  if (suppressDelivery) {
    delivery = { mode: 'api', status: 'accepted' };
  } else {
    try {
      delivery = await deliverAuthEmail({ email, purpose, token: code, expiresAt }, env, provider);
    } catch (error) {
      const cleanupOk = stored.id
        ? await removeEmailVerificationCode(env.DB, { id: stored.id, email, purpose })
        : true;
      if (!cleanupOk) {
        console.error('auth email verification cleanup failed', {
          code: 'EMAIL_VERIFICATION_CLEANUP_FAILED',
          provider,
        });
      }
      if (concealDeliveryFailure) {
        delivery = { mode: 'api', status: 'accepted' };
      } else {
        throw sanitizedAuthEmailDeliveryError(error, provider);
      }
    }
  }
""",
)

replace_once(
    ROUTE,
    """    const email = normalizeEmail(input.email || '');
    if (purpose === 'email-change' && email && await getD1AccountByEmail(env.DB, email)) {
      throw authError('Email is already registered.', 409, { code: 'AUTH_EMAIL_DUPLICATE', field: 'email' });
    }
    const requesterKey = await emailVerificationRequesterKey(request, env);
    const verification = await issueEmailVerificationToken({ ...input, requesterKey }, env);
""",
    """    const responseStartedAt = Date.now();
    const email = normalizeEmail(input.email || '');
    const suppressPasswordResetDelivery = purpose === 'password-reset'
      && !!email
      && !(await getD1AccountByEmail(env.DB, email));
    const requesterKey = await emailVerificationRequesterKey(request, env);
    const verification = await issueEmailVerificationToken({
      ...input,
      requesterKey,
      suppressDelivery: suppressPasswordResetDelivery,
      concealDeliveryFailure: purpose === 'password-reset',
    }, env);
    const publicVerification = publicEmailVerificationResult(verification, purpose);
    if (purpose === 'password-reset') await ensureMinimumResponseTime(responseStartedAt, 650);
""",
)

replace_once(
    ROUTE,
    """        deliveryMode: verification.delivery?.mode || '',
        deliveryStatus: verification.delivery?.status || '',
""",
    """        deliveryMode: publicVerification.delivery?.mode || '',
        deliveryStatus: publicVerification.delivery?.status || '',
""",
)
replace_once(
    ROUTE,
    "    return jsonResponse(request, env, 200, { ok: true, verification }, AUTH_METHODS);",
    "    return jsonResponse(request, env, 200, { ok: true, verification: publicVerification }, AUTH_METHODS);",
)

route_path = Path(ROUTE)
route_text = route_path.read_text(encoding='utf-8')
route_text += """

function publicEmailVerificationResult(verification = {}, purpose = '') {
  if (purpose !== 'password-reset') return verification;
  return {
    email: verification.email || '',
    purpose: 'password-reset',
    status: 'pending',
    expiresAt: verification.expiresAt || '',
    delivery: { mode: 'api', status: 'accepted' },
    ...(verification.token ? { token: verification.token } : {}),
  };
}

async function ensureMinimumResponseTime(startedAt = 0, minimumMs = 650) {
  const elapsed = Date.now() - Number(startedAt || 0);
  const remaining = Math.max(0, Number(minimumMs || 0) - elapsed);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}
"""
route_path.write_text(route_text, encoding='utf-8')

Path('scripts/auth-verification-enumeration-quality-check.mjs').write_text(r'''import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { issueEmailVerificationToken } from '../functions/api/auth/_auth.js';

const authSource = await fs.readFile(new URL('../functions/api/auth/_auth.js', import.meta.url), 'utf8');
const routeSource = await fs.readFile(new URL('../functions/api/auth/email-verification.js', import.meta.url), 'utf8');

assert.doesNotMatch(authSource, /purpose === 'signup'[\s\S]{0,160}AUTH_EMAIL_DUPLICATE/);
assert.doesNotMatch(routeSource, /purpose === 'email-change'[\s\S]{0,180}AUTH_EMAIL_DUPLICATE/);
assert.match(routeSource, /suppressPasswordResetDelivery/);
assert.match(routeSource, /concealDeliveryFailure: purpose === 'password-reset'/);
assert.match(routeSource, /ensureMinimumResponseTime\(responseStartedAt, 650\)/);
assert.match(routeSource, /delivery: \{ mode: 'api', status: 'accepted' \}/);
assert.match(authSource, /const suppressDelivery = input\.suppressDelivery === true/);
assert.match(authSource, /const concealDeliveryFailure = input\.concealDeliveryFailure === true/);
assert.match(authSource, /if \(suppressDelivery\)/);
assert.match(authSource, /if \(concealDeliveryFailure\)/);
assert.match(authSource, /if \(await getD1AccountByEmail\(env\.DB, email\)\) throw authError\('Email is already registered\.'/);

const env = {
  INLET_SESSION_SECRET: 'test-session-secret-at-least-32-characters',
  INLET_AUTH_EMAIL_MODE: 'mock',
  INLET_AUTH_EMAIL_EXPOSE_TOKEN: '1',
};

const suppressed = await issueEmailVerificationToken({
  email: 'missing-account@example.com',
  purpose: 'password-reset',
  suppressDelivery: true,
  concealDeliveryFailure: true,
}, env);
assert.equal(suppressed.status, 'pending');
assert.equal(suppressed.purpose, 'password-reset');
assert.deepEqual(suppressed.delivery, { mode: 'api', status: 'accepted' });
assert.equal(Object.hasOwn(suppressed, 'token'), false);

const signup = await issueEmailVerificationToken({
  email: 'existing-signup@example.com',
  purpose: 'signup',
}, env);
assert.equal(signup.status, 'pending');
assert.equal(signup.purpose, 'signup');
assert.equal(typeof signup.token, 'string');

console.log(JSON.stringify({ ok: true, checks: 16 }, null, 2));
''', encoding='utf-8')

replace_once(
    AGGREGATE,
    "await import('./auth-login-abuse-quality-check.mjs');",
    "await import('./auth-login-abuse-quality-check.mjs');\nawait import('./auth-verification-enumeration-quality-check.mjs');",
)
replace_once(AGGREGATE, '  checks: 120,', '  checks: 136,')

Path('docs/ops-auth-verification-enumeration.md').write_text('''# 인증 계정 존재 여부 보호\n\n## 회원가입·이메일 변경\n\n인증메일 요청 단계에서는 해당 이메일이 이미 등록됐는지 반환하지 않는다. 인증코드를 실제 이메일 소유자가 확인한 뒤 최종 회원가입 또는 이메일 변경 단계에서만 중복 여부를 판정한다.\n\n## 비밀번호 재설정\n\n- 등록된 계정이면 인증메일을 발송한다.\n- 등록되지 않은 이메일이면 인증 레코드와 요청 제한은 동일하게 적용하지만 외부 메일은 발송하지 않는다.\n- 두 경우 모두 동일한 200 응답, `pending` 상태, `api/accepted` 전달 상태를 반환한다.\n- 성공 응답은 최소 650ms 이후 반환해 단순 응답 시간 비교를 어렵게 한다.\n- 실제 메일 공급자 오류도 비밀번호 재설정 요청에서는 동일한 접수 응답으로 처리한다.\n- 분당·일일·요청자별 제한 오류는 기존 429 응답을 유지한다.\n\n## 비변경\n\n공개 메인, 템플릿 3종, 가격, 일반계정 1페이지 정책, CallTag, D1 schema는 변경하지 않는다.\n''', encoding='utf-8')

print('Applied auth verification enumeration protection.')
