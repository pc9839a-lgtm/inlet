import { readFile } from 'node:fs/promises';
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
