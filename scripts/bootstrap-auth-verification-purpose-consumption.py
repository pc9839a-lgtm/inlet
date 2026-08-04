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


# 1) Core verification contract: allowlisted purposes, exact purpose matching,
# latest-code invalidation, and one-time atomic consumption.
auth_path = 'functions/api/auth/_auth.js'
insert_after(
    auth_path,
    "export const AUTH_METHODS = 'GET, POST, PATCH, OPTIONS';\n",
    """

export const AUTH_EMAIL_VERIFICATION_PURPOSES = Object.freeze([
  'signup',
  'password-reset',
  'email-change',
]);

export function normalizeEmailVerificationPurpose(value = '') {
  const purpose = String(value || '').trim().toLowerCase();
  return AUTH_EMAIL_VERIFICATION_PURPOSES.includes(purpose) ? purpose : '';
}

function requireEmailVerificationPurpose(value = '') {
  const purpose = normalizeEmailVerificationPurpose(value);
  if (!purpose) {
    throw authError('Email verification purpose is invalid.', 400, {
      code: 'EMAIL_VERIFICATION_PURPOSE_INVALID',
    });
  }
  return purpose;
}

const consumedFallbackVerificationTokens = new Set();

function rememberConsumedFallbackVerificationToken(fingerprint = '') {
  if (!fingerprint) return true;
  if (consumedFallbackVerificationTokens.has(fingerprint)) return false;
  consumedFallbackVerificationTokens.add(fingerprint);
  while (consumedFallbackVerificationTokens.size > 2000) {
    consumedFallbackVerificationTokens.delete(consumedFallbackVerificationTokens.values().next().value);
  }
  return true;
}
""",
)
replace_once(
    auth_path,
    "  const purpose = String(input.purpose || 'signup').trim() || 'signup';",
    "  const purpose = requireEmailVerificationPurpose(input.purpose || 'signup');",
)

confirm_old = """export async function confirmEmailVerificationToken(input = {}, env = {}) {
  const email = normalizeEmail(input.email || '');
  const token = String(input.token || '').trim();
  if (!isValidEmail(email)) throw authError('Valid email is required.', 400, { code: 'AUTH_EMAIL_REQUIRED' });
  if (!token) throw authError('Email verification token is required.', 400, { code: 'EMAIL_VERIFICATION_TOKEN_REQUIRED' });
  const stored = await confirmStoredEmailVerificationCode(env.DB, { email, code: token }, env);
  if (stored) return stored;
  const [payloadPart, signaturePart] = token.split('.');
  if (!payloadPart || !signaturePart) throw authError('Email verification token is invalid.', 403, { code: 'EMAIL_VERIFICATION_INVALID' });
  const expected = await hmacBase64Url(payloadPart, authSecret(env));
  if (expected !== signaturePart) throw authError('Email verification token is invalid.', 403, { code: 'EMAIL_VERIFICATION_INVALID' });
  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadPart));
  } catch {
    throw authError('Email verification token is invalid.', 403, { code: 'EMAIL_VERIFICATION_INVALID' });
  }
  if (normalizeEmail(payload.email || '') !== email) throw authError('Email verification token is invalid.', 403, { code: 'EMAIL_VERIFICATION_INVALID' });
  if (payload.exp && Number(payload.exp) < Math.floor(Date.now() / 1000)) throw authError('Email verification token has expired.', 410, { code: 'EMAIL_VERIFICATION_EXPIRED' });
  return {
    email,
    purpose: String(payload.purpose || 'signup'),
    status: 'confirmed',
    confirmedAt: new Date().toISOString(),
    delivery: { mode: 'mock', status: 'confirmed' },
  };
}
"""
confirm_new = """export async function confirmEmailVerificationToken(input = {}, env = {}) {
  const email = normalizeEmail(input.email || '');
  const token = String(input.token || '').trim();
  const purpose = requireEmailVerificationPurpose(input.purpose);
  const consume = input.consume === true;
  if (!isValidEmail(email)) throw authError('Valid email is required.', 400, { code: 'AUTH_EMAIL_REQUIRED' });
  if (!token) throw authError('Email verification token is required.', 400, { code: 'EMAIL_VERIFICATION_TOKEN_REQUIRED' });
  const stored = await confirmStoredEmailVerificationCode(env.DB, {
    email,
    purpose,
    code: token,
    consume,
  }, env);
  if (stored) return stored;
  const [payloadPart, signaturePart] = token.split('.');
  if (!payloadPart || !signaturePart) throw authError('Email verification token is invalid.', 403, { code: 'EMAIL_VERIFICATION_INVALID' });
  const expected = await hmacBase64Url(payloadPart, authSecret(env));
  if (expected !== signaturePart) throw authError('Email verification token is invalid.', 403, { code: 'EMAIL_VERIFICATION_INVALID' });
  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadPart));
  } catch {
    throw authError('Email verification token is invalid.', 403, { code: 'EMAIL_VERIFICATION_INVALID' });
  }
  if (normalizeEmail(payload.email || '') !== email || requireEmailVerificationPurpose(payload.purpose) !== purpose) {
    throw authError('Email verification token is invalid.', 403, { code: 'EMAIL_VERIFICATION_INVALID' });
  }
  if (payload.exp && Number(payload.exp) < Math.floor(Date.now() / 1000)) throw authError('Email verification token has expired.', 410, { code: 'EMAIL_VERIFICATION_EXPIRED' });
  const confirmedAt = new Date().toISOString();
  if (consume) {
    const fingerprint = await hmacHex(`fallback:${token}`, authSecret(env));
    if (!rememberConsumedFallbackVerificationToken(fingerprint)) {
      throw authError('Email verification token was already used.', 409, {
        code: 'EMAIL_VERIFICATION_ALREADY_USED',
      });
    }
  }
  return {
    email,
    purpose,
    status: consume ? 'consumed' : 'confirmed',
    confirmedAt,
    ...(consume ? { consumedAt: confirmedAt } : {}),
    delivery: { mode: 'mock', status: consume ? 'consumed' : 'confirmed' },
  };
}
"""
replace_once(auth_path, confirm_old, confirm_new)

store_old = """async function storeEmailVerificationCode(db, record = {}, env = {}) {
  if (!db?.prepare) return { ok: false, id: '' };
  const id = verificationId();
  const codeHash = await hmacHex(`${record.email}:${record.purpose}:${record.code}`, authSecret(env));
  try {
    await db.prepare(`
      INSERT INTO auth_email_verifications (id, email, purpose, code_hash, status, attempts, expires_at)
      VALUES (?, ?, ?, ?, 'pending', 0, ?)
    `).bind(id, record.email, record.purpose, codeHash, record.expiresAt).run();
    return { ok: true, id };
  } catch {
    console.error('auth email verification persistence failed', {
      code: 'EMAIL_VERIFICATION_STORAGE_FAILED',
    });
    return { ok: false, id: '' };
  }
}
"""
store_new = """async function storeEmailVerificationCode(db, record = {}, env = {}) {
  if (!db?.prepare) return { ok: false, id: '' };
  const id = verificationId();
  const codeHash = await hmacHex(`${record.email}:${record.purpose}:${record.code}`, authSecret(env));
  try {
    await db.prepare(`
      UPDATE auth_email_verifications
      SET status = 'superseded'
      WHERE email = ? AND purpose = ? AND status IN ('pending', 'confirmed')
    `).bind(record.email, record.purpose).run();
    await db.prepare(`
      INSERT INTO auth_email_verifications (id, email, purpose, code_hash, status, attempts, expires_at)
      VALUES (?, ?, ?, ?, 'pending', 0, ?)
    `).bind(id, record.email, record.purpose, codeHash, record.expiresAt).run();
    return { ok: true, id };
  } catch {
    console.error('auth email verification persistence failed', {
      code: 'EMAIL_VERIFICATION_STORAGE_FAILED',
    });
    return { ok: false, id: '' };
  }
}
"""
replace_once(auth_path, store_old, store_new)

stored_old = """async function confirmStoredEmailVerificationCode(db, input = {}, env = {}) {
  if (!db?.prepare || !/^\\d{6}$/.test(String(input.code || ''))) return null;
  const rows = await db.prepare(`
    SELECT id, email, purpose, code_hash, status, attempts, expires_at, confirmed_at
    FROM auth_email_verifications
    WHERE email = ? AND status IN ('pending', 'confirmed')
    ORDER BY created_at DESC
    LIMIT 5
  `).bind(input.email).all();
  const records = rows?.results || [];
  const now = Date.now();
  for (const record of records) {
    if (Date.parse(record.expires_at || '') <= now) {
      await db.prepare("UPDATE auth_email_verifications SET status = 'expired' WHERE id = ?").bind(record.id).run();
      continue;
    }
    if (Number(record.attempts || 0) >= 5) {
      await db.prepare("UPDATE auth_email_verifications SET status = 'blocked' WHERE id = ?").bind(record.id).run();
      continue;
    }
    const expected = await hmacHex(`${input.email}:${record.purpose}:${input.code}`, authSecret(env));
    if (expected === record.code_hash) {
      if (String(record.status || '') === 'confirmed') {
        return {
          email: input.email,
          purpose: String(record.purpose || 'signup'),
          status: 'confirmed',
          confirmedAt: record.confirmed_at || new Date().toISOString(),
          delivery: { mode: 'api', status: 'confirmed' },
        };
      }
      const confirmedAt = new Date().toISOString();
      await db.prepare("UPDATE auth_email_verifications SET status = 'confirmed', confirmed_at = ? WHERE id = ?").bind(confirmedAt, record.id).run();
      return {
        email: input.email,
        purpose: String(record.purpose || 'signup'),
        status: 'confirmed',
        confirmedAt,
        delivery: { mode: 'api', status: 'confirmed' },
      };
    }
    await db.prepare('UPDATE auth_email_verifications SET attempts = attempts + 1 WHERE id = ?').bind(record.id).run();
  }
  throw authError('Email verification token is invalid.', 403, { code: 'EMAIL_VERIFICATION_INVALID' });
}
"""
stored_new = """async function confirmStoredEmailVerificationCode(db, input = {}, env = {}) {
  if (!db?.prepare || !/^\\d{6}$/.test(String(input.code || ''))) return null;
  const rows = await db.prepare(`
    SELECT id, email, purpose, code_hash, status, attempts, expires_at, confirmed_at
    FROM auth_email_verifications
    WHERE email = ? AND purpose = ? AND status IN ('pending', 'confirmed', 'consumed')
    ORDER BY created_at DESC
    LIMIT 5
  `).bind(input.email, input.purpose).all();
  const records = rows?.results || [];
  const now = Date.now();
  for (const record of records) {
    if (Date.parse(record.expires_at || '') <= now) {
      if (String(record.status || '') !== 'consumed') {
        await db.prepare("UPDATE auth_email_verifications SET status = 'expired' WHERE id = ? AND status IN ('pending', 'confirmed')").bind(record.id).run();
      }
      continue;
    }
    if (Number(record.attempts || 0) >= 5 && String(record.status || '') !== 'consumed') {
      await db.prepare("UPDATE auth_email_verifications SET status = 'blocked' WHERE id = ? AND status IN ('pending', 'confirmed')").bind(record.id).run();
      continue;
    }
    const expected = await hmacHex(`${input.email}:${input.purpose}:${input.code}`, authSecret(env));
    if (expected === record.code_hash) {
      if (String(record.status || '') === 'consumed') {
        throw authError('Email verification token was already used.', 409, {
          code: 'EMAIL_VERIFICATION_ALREADY_USED',
        });
      }
      const confirmedAt = record.confirmed_at || new Date().toISOString();
      if (input.consume === true) {
        const result = await db.prepare(`
          UPDATE auth_email_verifications
          SET status = 'consumed', confirmed_at = COALESCE(confirmed_at, ?)
          WHERE id = ? AND email = ? AND purpose = ? AND status IN ('pending', 'confirmed')
        `).bind(confirmedAt, record.id, input.email, input.purpose).run();
        const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
        if (changes !== 1) {
          throw authError('Email verification token was already used.', 409, {
            code: 'EMAIL_VERIFICATION_ALREADY_USED',
          });
        }
        return {
          email: input.email,
          purpose: input.purpose,
          status: 'consumed',
          confirmedAt,
          consumedAt: new Date().toISOString(),
          delivery: { mode: 'api', status: 'consumed' },
        };
      }
      if (String(record.status || '') === 'pending') {
        await db.prepare(`
          UPDATE auth_email_verifications
          SET status = 'confirmed', confirmed_at = ?
          WHERE id = ? AND email = ? AND purpose = ? AND status = 'pending'
        `).bind(confirmedAt, record.id, input.email, input.purpose).run();
      }
      return {
        email: input.email,
        purpose: input.purpose,
        status: 'confirmed',
        confirmedAt,
        delivery: { mode: 'api', status: 'confirmed' },
      };
    }
    if (String(record.status || '') !== 'consumed') {
      await db.prepare(`
        UPDATE auth_email_verifications
        SET attempts = attempts + 1
        WHERE id = ? AND email = ? AND purpose = ? AND status IN ('pending', 'confirmed')
      `).bind(record.id, input.email, input.purpose).run();
    }
  }
  throw authError('Email verification token is invalid.', 403, { code: 'EMAIL_VERIFICATION_INVALID' });
}
"""
replace_once(auth_path, stored_old, stored_new)

register_old = """  const verification = await confirmEmailVerificationToken({ email, token }, env);
  if (verification.purpose !== 'signup') throw authError('Email verification token is invalid.', 403, { code: 'EMAIL_VERIFICATION_INVALID' });
  if (await getD1AccountByEmail(env.DB, email)) throw authError('Email is already registered.', 409, { code: 'AUTH_EMAIL_DUPLICATE', field: 'email' });
  if (await getD1AccountByPhone(env.DB, phone)) throw authError('Phone number is already registered.', 409, { code: 'AUTH_PHONE_DUPLICATE', field: 'phone' });
  const now = new Date().toISOString();
"""
register_new = """  if (await getD1AccountByEmail(env.DB, email)) throw authError('Email is already registered.', 409, { code: 'AUTH_EMAIL_DUPLICATE', field: 'email' });
  if (await getD1AccountByPhone(env.DB, phone)) throw authError('Phone number is already registered.', 409, { code: 'AUTH_PHONE_DUPLICATE', field: 'phone' });
  const verification = await confirmEmailVerificationToken({
    email,
    token,
    purpose: 'signup',
    consume: true,
  }, env);
  const now = new Date().toISOString();
"""
replace_once(auth_path, register_old, register_new)
replace_once(
    auth_path,
    "    emailVerified: true,\n    passwordHash: await passwordHash(password, email, env),",
    "    emailVerified: true,\n    emailVerifiedAt: verification.confirmedAt || now,\n    passwordHash: await passwordHash(password, email, env),",
)

# 2) Route callers consume only at the final protected operation.
password_path = 'functions/api/auth/password.js'
password_old = """    if (!token) throw authError('Email verification is required before changing password.', 403, { code: 'EMAIL_VERIFICATION_REQUIRED' });
    const verification = await confirmEmailVerificationToken({ email, token }, env);
    if (verification.purpose !== 'password-reset') throw authError('Email verification token is invalid.', 403, { code: 'EMAIL_VERIFICATION_INVALID' });
    if (!isValidPassword(password)) throw authError('Password must include letters and numbers and be at least 6 characters.', 400, { code: 'AUTH_PASSWORD_POLICY' });
    const user = await getD1AccountByEmail(env.DB, email);
    if (!user) throw authError('Account was not found.', 404, { code: 'AUTH_ACCOUNT_NOT_FOUND' });
    assertAccountActive(user, 'change password');
"""
password_new = """    if (!token) throw authError('Email verification is required before changing password.', 403, { code: 'EMAIL_VERIFICATION_REQUIRED' });
    if (!isValidPassword(password)) throw authError('Password must include letters and numbers and be at least 6 characters.', 400, { code: 'AUTH_PASSWORD_POLICY' });
    const user = await getD1AccountByEmail(env.DB, email);
    if (!user) throw authError('Account was not found.', 404, { code: 'AUTH_ACCOUNT_NOT_FOUND' });
    assertAccountActive(user, 'change password');
    const verification = await confirmEmailVerificationToken({
      email,
      token,
      purpose: 'password-reset',
      consume: true,
    }, env);
"""
replace_once(password_path, password_old, password_new)

email_change_path = 'functions/api/auth/account/email.js'
email_change_old = """    const verification = await confirmEmailVerificationToken({ email: nextEmail, token }, env);
    if (verification.purpose !== 'email-change') {
      throw authError('Email verification token is invalid.', 403, { code: 'EMAIL_VERIFICATION_INVALID' });
    }
"""
email_change_new = """    const verification = await confirmEmailVerificationToken({
      email: nextEmail,
      token,
      purpose: 'email-change',
      consume: true,
    }, env);
"""
replace_once(email_change_path, email_change_old, email_change_new)

# 3) Request and confirmation endpoints normalize/require an explicit purpose.
request_path = 'functions/api/auth/email-verification.js'
replace_once(
    request_path,
    "import { AUTH_METHODS, authError, issueEmailVerificationToken, normalizeEmail } from './_auth.js';",
    "import { AUTH_METHODS, authError, issueEmailVerificationToken, normalizeEmail, normalizeEmailVerificationPurpose } from './_auth.js';",
)
replace_once(
    request_path,
    "    const purpose = String(input.purpose || 'signup').trim() || 'signup';",
    "    const purpose = normalizeEmailVerificationPurpose(input.purpose || 'signup');\n    if (!purpose) throw authError('Email verification purpose is invalid.', 400, { code: 'EMAIL_VERIFICATION_PURPOSE_INVALID' });\n    input = { ...input, purpose };",
)

# 4) Browser/client callers keep the purpose through confirm and final action.
client_path = 'src/lib/authAccounts.js'
replace_once(
    client_path,
    "    token: input.token || '',\n  });",
    "    token: input.token || '',\n    purpose: input.purpose || '',\n  });",
)
replace_once(
    client_path,
    "    EMAIL_VERIFICATION_TOKEN_REQUIRED: '이메일 인증 코드를 입력해주세요.',\n    EMAIL_VERIFICATION_INVALID: '이메일 인증 코드가 올바르지 않습니다.',",
    "    EMAIL_VERIFICATION_TOKEN_REQUIRED: '이메일 인증 코드를 입력해주세요.',\n    EMAIL_VERIFICATION_PURPOSE_INVALID: '이메일 인증 요청 종류를 다시 확인해주세요.',\n    EMAIL_VERIFICATION_INVALID: '이메일 인증 코드가 올바르지 않습니다.',\n    EMAIL_VERIFICATION_ALREADY_USED: '이미 사용한 인증 코드입니다. 새 인증 코드를 받아주세요.',",
)

auth_screen_path = 'src/screens/AuthScreen.jsx'
replace_once(
    auth_screen_path,
    "    const email = form.email.trim().toLowerCase();\n    setError('');",
    "    const email = form.email.trim().toLowerCase();\n    const purpose = mode === 'reset' ? 'password-reset' : 'signup';\n    setError('');",
)
replace_once(
    auth_screen_path,
    "        await confirmEmailVerification({ email, token: form.verificationCode.trim() });",
    "        await confirmEmailVerification({ email, token: form.verificationCode.trim(), purpose });",
)
replace_once(
    auth_screen_path,
    "      const verification = await requestEmailVerification(email, mode === 'reset' ? 'password-reset' : 'signup');",
    "      const verification = await requestEmailVerification(email, purpose);",
)
replace_once(
    auth_screen_path,
    "      await confirmEmailVerification({ email, token });",
    "      await confirmEmailVerification({ email, token, purpose });",
)

settings_actions_path = 'src/panels/settings/accountSettingsActions.js'
replace_once(
    settings_actions_path,
    "      await confirmEmailVerification({ email, token: passwordDraft.code.trim() });",
    "      await confirmEmailVerification({ email, token: passwordDraft.code.trim(), purpose: 'password-reset' });",
)

# 5) Add a focused runtime/contract QA suite and wire it into auth:qa.
qa_source = r"""import { readFile } from 'node:fs/promises';
import {
  confirmEmailVerificationToken,
  issueEmailVerificationToken,
} from '../functions/api/auth/_auth.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createVerificationDb() {
  const rows = [];
  const changes = (count) => ({ success: true, meta: { changes: count }, changes: count });
  return {
    rows,
    prepare(sql = '') {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      return {
        bind(...args) {
          return {
            async first() {
              if (normalized.startsWith('SELECT id, created_at')) {
                const [email, purpose, since] = args;
                return rows
                  .filter((row) => row.email === email && row.purpose === purpose && row.created_at >= since)
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null;
              }
              if (normalized.startsWith('SELECT COUNT(*) AS count')) {
                const [email, purpose, since] = args;
                return { count: rows.filter((row) => row.email === email && row.purpose === purpose && row.created_at >= since).length };
              }
              return null;
            },
            async all() {
              if (normalized.includes("WHERE email = ? AND purpose = ? AND status IN ('pending', 'confirmed', 'consumed')")) {
                const [email, purpose] = args;
                return {
                  results: rows
                    .filter((row) => row.email === email && row.purpose === purpose && ['pending', 'confirmed', 'consumed'].includes(row.status))
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .slice(0, 5),
                };
              }
              return { results: [] };
            },
            async run() {
              if (normalized.startsWith("UPDATE auth_email_verifications SET status = 'superseded'")) {
                const [email, purpose] = args;
                let count = 0;
                for (const row of rows) {
                  if (row.email === email && row.purpose === purpose && ['pending', 'confirmed'].includes(row.status)) {
                    row.status = 'superseded';
                    count += 1;
                  }
                }
                return changes(count);
              }
              if (normalized.startsWith('INSERT INTO auth_email_verifications')) {
                const [id, email, purpose, code_hash, expires_at] = args;
                rows.push({
                  id,
                  email,
                  purpose,
                  code_hash,
                  status: 'pending',
                  attempts: 0,
                  expires_at,
                  confirmed_at: '',
                  created_at: new Date().toISOString(),
                });
                return changes(1);
              }
              if (normalized.startsWith('DELETE FROM auth_email_verifications')) {
                const [id, email, purpose] = args;
                const index = rows.findIndex((row) => row.id === id && row.email === email && row.purpose === purpose && row.status === 'pending');
                if (index >= 0) rows.splice(index, 1);
                return changes(index >= 0 ? 1 : 0);
              }
              if (normalized.includes("SET status = 'expired'")) {
                const [id] = args;
                const row = rows.find((item) => item.id === id && ['pending', 'confirmed'].includes(item.status));
                if (row) row.status = 'expired';
                return changes(row ? 1 : 0);
              }
              if (normalized.includes("SET status = 'blocked'")) {
                const [id] = args;
                const row = rows.find((item) => item.id === id && ['pending', 'confirmed'].includes(item.status));
                if (row) row.status = 'blocked';
                return changes(row ? 1 : 0);
              }
              if (normalized.includes("SET status = 'consumed'")) {
                const [confirmedAt, id, email, purpose] = args;
                const row = rows.find((item) => item.id === id && item.email === email && item.purpose === purpose && ['pending', 'confirmed'].includes(item.status));
                if (!row) return changes(0);
                row.status = 'consumed';
                row.confirmed_at = row.confirmed_at || confirmedAt;
                return changes(1);
              }
              if (normalized.includes("SET status = 'confirmed'")) {
                const [confirmedAt, id, email, purpose] = args;
                const row = rows.find((item) => item.id === id && item.email === email && item.purpose === purpose && item.status === 'pending');
                if (!row) return changes(0);
                row.status = 'confirmed';
                row.confirmed_at = confirmedAt;
                return changes(1);
              }
              if (normalized.includes('SET attempts = attempts + 1')) {
                const [id, email, purpose] = args;
                const row = rows.find((item) => item.id === id && item.email === email && item.purpose === purpose && ['pending', 'confirmed'].includes(item.status));
                if (!row) return changes(0);
                row.attempts += 1;
                return changes(1);
              }
              throw new Error(`unexpected verification DB run: ${normalized}`);
            },
          };
        },
      };
    },
  };
}

async function expectCode(run, code, status) {
  try {
    await run();
  } catch (error) {
    assert(error?.details?.code === code, `expected ${code}, got ${error?.details?.code}`);
    if (status) assert(error?.status === status, `expected status ${status}, got ${error?.status}`);
    return error;
  }
  throw new Error(`expected ${code}`);
}

const db = createVerificationDb();
const env = {
  DB: db,
  INLET_SESSION_SECRET: 'verification-purpose-consumption-secret-32',
  INLET_AUTH_EMAIL_MODE: 'mock',
  INLET_AUTH_EMAIL_EXPOSE_TOKEN: '1',
};
const email = 'purpose-isolation@example.test';

await expectCode(() => issueEmailVerificationToken({ email, purpose: 'anything-goes' }, env), 'EMAIL_VERIFICATION_PURPOSE_INVALID', 400);
const signup = await issueEmailVerificationToken({ email, purpose: 'signup' }, env);
assert(/^\d{6}$/.test(signup.token || ''), 'stored local verification should expose a six-digit code');
await expectCode(() => confirmEmailVerificationToken({ email, token: signup.token }, env), 'EMAIL_VERIFICATION_PURPOSE_INVALID', 400);
await expectCode(() => confirmEmailVerificationToken({ email, token: signup.token, purpose: 'password-reset' }, env), 'EMAIL_VERIFICATION_INVALID', 403);
const signupRow = db.rows.find((row) => row.purpose === 'signup');
assert(signupRow?.attempts === 0, 'wrong-purpose confirmation must not increment the signup record attempts');

const confirmed = await confirmEmailVerificationToken({ email, token: signup.token, purpose: 'signup' }, env);
assert(confirmed.status === 'confirmed' && signupRow.status === 'confirmed', 'confirmation should preserve the code for one final protected action');
const consumed = await confirmEmailVerificationToken({ email, token: signup.token, purpose: 'signup', consume: true }, env);
assert(consumed.status === 'consumed' && signupRow.status === 'consumed', 'final protected action must consume the code');
await expectCode(() => confirmEmailVerificationToken({ email, token: signup.token, purpose: 'signup', consume: true }, env), 'EMAIL_VERIFICATION_ALREADY_USED', 409);

const resetOne = await issueEmailVerificationToken({ email, purpose: 'password-reset' }, env);
const firstResetRow = db.rows.find((row) => row.purpose === 'password-reset');
await confirmEmailVerificationToken({ email, token: resetOne.token, purpose: 'password-reset' }, env);
firstResetRow.created_at = new Date(Date.now() - 120000).toISOString();
const resetTwo = await issueEmailVerificationToken({ email, purpose: 'password-reset' }, env);
assert(firstResetRow.status === 'superseded', 'new code issuance must supersede previous pending or confirmed code for the same purpose');
const latestResetRow = db.rows.filter((row) => row.purpose === 'password-reset').at(-1);
assert(latestResetRow.status === 'pending', 'latest code must remain pending');
await confirmEmailVerificationToken({ email, token: resetTwo.token, purpose: 'password-reset', consume: true }, env);
assert(latestResetRow.status === 'consumed', 'latest password reset code should be consumable once');

const authSource = await readFile('functions/api/auth/_auth.js', 'utf8');
const passwordRoute = await readFile('functions/api/auth/password.js', 'utf8');
const emailRoute = await readFile('functions/api/auth/account/email.js', 'utf8');
const clientSource = await readFile('src/lib/authAccounts.js', 'utf8');
const authScreen = await readFile('src/screens/AuthScreen.jsx', 'utf8');
const settingsActions = await readFile('src/panels/settings/accountSettingsActions.js', 'utf8');

for (const token of [
  'AUTH_EMAIL_VERIFICATION_PURPOSES',
  'EMAIL_VERIFICATION_PURPOSE_INVALID',
  "status = 'superseded'",
  "status = 'consumed'",
  "purpose = ? AND status IN ('pending', 'confirmed', 'consumed')",
  'EMAIL_VERIFICATION_ALREADY_USED',
  'changes !== 1',
]) {
  assert(authSource.includes(token), `auth verification contract missing ${token}`);
}
assert(passwordRoute.includes("purpose: 'password-reset'") && passwordRoute.includes('consume: true'), 'password change must consume a password-reset verification');
assert(emailRoute.includes("purpose: 'email-change'") && emailRoute.includes('consume: true'), 'email change must consume an email-change verification');
assert(clientSource.includes("purpose: input.purpose || ''"), 'confirmation client must send purpose');
assert(authScreen.includes("purpose = mode === 'reset' ? 'password-reset' : 'signup'") && authScreen.includes('token, purpose'), 'auth screen must keep purpose through confirmation');
assert(settingsActions.includes("purpose: 'password-reset'"), 'settings password confirmation must send password-reset purpose');

console.log(JSON.stringify({
  ok: true,
  contracts: [
    'purpose-allowlist',
    'wrong-purpose-isolation',
    'same-purpose-supersession',
    'confirm-then-consume',
    'atomic-single-consumption',
    'replay-rejected',
    'frontend-purpose-propagation',
  ],
}, null, 2));
"""
Path('scripts/auth-verification-purpose-consumption-quality-check.mjs').write_text(qa_source, encoding='utf-8')

replace_once(
    'scripts/auth-quality-check.mjs',
    "await import('./auth-email-quality-check.mjs');\n",
    "await import('./auth-email-quality-check.mjs');\nawait import('./auth-verification-purpose-consumption-quality-check.mjs');\n",
)
replace_once(
    'scripts/auth-quality-check.mjs',
    "  checks: 61,",
    "  checks: 68,",
)

Path('docs/ops-auth-verification-purpose-consumption.md').write_text("""# 인증 코드 목적 격리 및 1회 소비

## 적용 목적

인증 코드는 `signup`, `password-reset`, `email-change` 세 목적만 허용합니다. 발급·확인·최종 작업 전 과정에서 이메일과 목적이 모두 일치해야 합니다.

## 상태 전환

- `pending`: 발급 완료, 확인 전
- `confirmed`: 화면에서 코드 확인 완료, 최종 작업 전
- `consumed`: 회원가입·비밀번호 변경·이메일 변경에 1회 사용 완료
- `superseded`: 같은 이메일·같은 목적으로 새 코드가 발급되어 폐기
- `expired` / `blocked`: 만료 또는 시도 제한

새 코드를 발급하면 동일 이메일·동일 목적의 기존 `pending`·`confirmed` 코드는 `superseded`로 전환합니다. 다른 목적의 코드는 변경하지 않습니다.

## 재사용 차단

회원가입, 비밀번호 변경, 이메일 변경은 실제 계정 쓰기 직전에 목적을 명시하고 `consume: true`로 검증합니다. D1 업데이트는 `pending` 또는 `confirmed` 상태에서만 `consumed`로 바뀌며 변경 행이 정확히 1개가 아니면 `EMAIL_VERIFICATION_ALREADY_USED`로 차단합니다.

화면의 코드 확인은 `confirmed`까지만 진행하므로 사용자는 확인 후 최종 제출을 할 수 있습니다. 최종 제출이 성공 경로에 들어가면 같은 코드는 다시 사용할 수 없습니다.

## 운영 영향

기존 `auth_email_verifications.status` 컬럼을 사용하므로 별도 D1 migration은 필요하지 않습니다. 운영 이메일 발송, DNS, SES 설정, 실제 계정 데이터 쓰기는 이 패치 QA에서 수행하지 않습니다.
""", encoding='utf-8')

print('Applied auth verification purpose isolation and one-time consumption patch.')
