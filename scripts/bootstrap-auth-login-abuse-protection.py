from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one exact match, found {count}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


AUTH = 'functions/api/auth/_auth.js'
LOGIN = 'functions/api/auth/login.js'
AUDIT = 'functions/api/_audit.js'
CLIENT = 'src/lib/authAccounts.js'
AGGREGATE = 'scripts/auth-quality-check.mjs'

replace_once(
    AUDIT,
    """function requestIp(request) {
  return normalizeString(
    request?.headers?.get?.('CF-Connecting-IP')
      || request?.headers?.get?.('X-Forwarded-For')?.split(',')[0]
      || '',
    200,
  );
}
""",
    """function requestIp(request) {
  return normalizeString(
    request?.headers?.get?.('CF-Connecting-IP')
      || request?.headers?.get?.('X-Forwarded-For')?.split(',')[0]
      || '',
    200,
  );
}

export async function auditRequestIpHash(request, env = {}) {
  return auditHash(requestIp(request), env);
}
""",
)

old_login_account = """export async function loginAccount(input = {}, env = {}) {
  const email = normalizeEmail(input.email || '');
  const password = String(input.password || '');
  if (!isValidEmail(email) || !password) throw authError('Email and password are required.', 400, { code: 'AUTH_LOGIN_REQUIRED' });
  const user = await getD1AccountByEmail(env.DB, email);
  if (!user || user.passwordHash !== await passwordHash(password, email, env)) throw authError('Email or password is invalid.', 401, { code: 'AUTH_LOGIN_INVALID' });
  assertAccountActive(user, 'login');
  if (user.emailVerified !== true) throw authError('Email verification is required before login.', 403, { code: 'EMAIL_VERIFICATION_REQUIRED' });
  const publicUser = authUserPublic(user);
  return {
    user: publicUser,
    session: await createSessionToken({
      ownerId: publicUser.ownerId,
      projectId: String(input.projectId || ''),
      role: input.role || 'master',
      email: publicUser.email,
    }, env),
  };
}
"""
new_login_account = """function constantTimeTextEqual(leftValue = '', rightValue = '') {
  const left = String(leftValue || '');
  const right = String(rightValue || '');
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

export async function loginAccount(input = {}, env = {}) {
  const email = normalizeEmail(input.email || '');
  const password = String(input.password || '');
  if (!isValidEmail(email) || !password) throw authError('Email and password are required.', 400, { code: 'AUTH_LOGIN_REQUIRED' });
  const user = await getD1AccountByEmail(env.DB, email);
  const [candidateHash, dummyHash] = await Promise.all([
    passwordHash(password, email, env),
    passwordHash('pagero-invalid-login-sentinel', email, env),
  ]);
  const storedHash = String(user?.passwordHash || user?.password_hash || dummyHash);
  const passwordMatches = constantTimeTextEqual(storedHash, candidateHash);
  if (!user || !passwordMatches) throw authError('Email or password is invalid.', 401, { code: 'AUTH_LOGIN_INVALID' });
  assertAccountActive(user, 'login');
  if (user.emailVerified !== true) throw authError('Email verification is required before login.', 403, { code: 'EMAIL_VERIFICATION_REQUIRED' });
  const publicUser = authUserPublic(user);
  return {
    user: publicUser,
    session: await createSessionToken({
      ownerId: publicUser.ownerId,
      projectId: String(input.projectId || ''),
      role: input.role || 'master',
      email: publicUser.email,
    }, env),
  };
}
"""
replace_once(AUTH, old_login_account, new_login_account)

replace_once(
    LOGIN,
    "import { AUTH_METHODS, googleAuthRedirectUri, googleLoginAuthUrl, loginAccount, loginGoogleAccount } from './_auth.js';",
    "import { AUTH_METHODS, googleAuthRedirectUri, googleLoginAuthUrl, loginAccount, loginGoogleAccount } from './_auth.js';\nimport { assertPasswordLoginAllowed, finishPasswordLoginTiming } from './_loginRateLimit.js';",
)
replace_once(
    LOGIN,
    "  let input = {};\n  try {",
    "  let input = {};\n  let passwordLoginStartedAt = 0;\n  let rateLimitContext = { targetId: '', ipHash: '' };\n  try {",
)
replace_once(
    LOGIN,
    """    }
    const result = await loginAccount({ ...input, role: 'master' }, env);
""",
    """    }
    passwordLoginStartedAt = Date.now();
    rateLimitContext = await assertPasswordLoginAllowed(request, env, input.email || '');
    const result = await loginAccount({ ...input, role: 'master' }, env);
""",
)
replace_once(
    LOGIN,
    """      metadata: { provider: 'password' },
    });
    return jsonResponse(request, env, 200, {
""",
    """      metadata: { provider: 'password' },
    });
    await finishPasswordLoginTiming(passwordLoginStartedAt, env);
    return jsonResponse(request, env, 200, {
""",
)
old_catch = """  } catch (error) {
    await writeAuditLog({
      request,
      env,
      action: 'auth.login_failed',
      targetType: 'account',
      targetId: await auditSubjectHash(input.email || '', env).catch(() => ''),
      metadata: { provider: 'password', ...auditErrorMetadata(error) },
    });
    return handleApiError(request, env, error, AUTH_METHODS);
  }
}
"""
new_catch = """  } catch (error) {
    const errorCode = String(error?.details?.code || '');
    const rateLimited = errorCode === 'AUTH_LOGIN_RATE_LIMITED';
    await writeAuditLog({
      request,
      env,
      action: rateLimited ? 'auth.login_rate_limited' : 'auth.login_failed',
      targetType: 'account',
      targetId: rateLimitContext.targetId || await auditSubjectHash(input.email || '', env).catch(() => ''),
      metadata: { provider: 'password', ...auditErrorMetadata(error) },
    });
    await finishPasswordLoginTiming(passwordLoginStartedAt, env);
    return handleApiError(request, env, error, AUTH_METHODS);
  }
}
"""
replace_once(LOGIN, old_catch, new_catch)

replace_once(
    CLIENT,
    "    AUTH_LOGIN_INVALID: '이메일 또는 비밀번호가 올바르지 않습니다.',",
    "    AUTH_LOGIN_INVALID: '이메일 또는 비밀번호가 올바르지 않습니다.',\n    AUTH_LOGIN_RATE_LIMITED: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',",
)
replace_once(
    CLIENT,
    "  if (/email or password is invalid/i.test(message)) return byCode.AUTH_LOGIN_INVALID;",
    "  if (/too many login attempts/i.test(message)) return byCode.AUTH_LOGIN_RATE_LIMITED;\n  if (/email or password is invalid/i.test(message)) return byCode.AUTH_LOGIN_INVALID;",
)

replace_once(
    AGGREGATE,
    "await import('./auth-email-abuse-quality-check.mjs');",
    "await import('./auth-email-abuse-quality-check.mjs');\nawait import('./auth-login-abuse-quality-check.mjs');",
)
replace_once(AGGREGATE, '  checks: 96,', '  checks: 120,')

print('Applied login abuse protection patch.')
