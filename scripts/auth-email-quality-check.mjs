import { readFile } from 'node:fs/promises';
import { issueEmailVerificationToken } from '../functions/api/auth/_auth.js';
import { authAccountErrorMessage } from '../src/lib/authAccounts.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createVerificationDb() {
  const rows = [];
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
                  .filter((row) => row.email === email && row.purpose === purpose && row.createdAt >= since)
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
              }
              if (normalized.startsWith('SELECT COUNT(*) AS count')) {
                const [email, purpose, since] = args;
                return {
                  count: rows.filter((row) => row.email === email && row.purpose === purpose && row.createdAt >= since).length,
                };
              }
              return null;
            },
            async run() {
              if (normalized.startsWith("UPDATE auth_email_verifications SET status = 'superseded'")) {
                const [email, purpose] = args;
                for (const row of rows) {
                  if (row.email === email && row.purpose === purpose && ['pending', 'confirmed'].includes(row.status)) {
                    row.status = 'superseded';
                  }
                }
                return { success: true };
              }
              if (normalized.startsWith('INSERT INTO auth_email_verifications')) {
                const [id, email, purpose, codeHash, expiresAt] = args;
                rows.push({
                  id,
                  email,
                  purpose,
                  codeHash,
                  expiresAt,
                  status: 'pending',
                  createdAt: new Date().toISOString(),
                });
                return { success: true };
              }
              if (normalized.startsWith('DELETE FROM auth_email_verifications')) {
                const [id, email, purpose] = args;
                const index = rows.findIndex((row) => row.id === id
                  && row.email === email
                  && row.purpose === purpose
                  && row.status === 'pending');
                if (index >= 0) rows.splice(index, 1);
                return { success: true };
              }
              throw new Error(`unexpected verification DB run: ${normalized}`);
            },
            async all() {
              return { results: [] };
            },
          };
        },
      };
    },
  };
}

async function captureError(run, expectedCode) {
  try {
    await run();
  } catch (error) {
    const message = String(error?.message || '');
    assert(error?.status === 503, `expected status 503 for ${expectedCode}, got ${error?.status}`);
    assert(error?.details?.code === expectedCode, `expected ${expectedCode}, got ${error?.details?.code}`);
    assert(message === '메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 'email send failure must use generic Korean copy');
    assert(!/AWS|SES|quota|sandbox|domain|secret|token|access key|request id/i.test(message), 'user copy must not expose provider detail');
    return error;
  }
  throw new Error(`expected ${expectedCode}`);
}

function sesEnv(overrides = {}) {
  return {
    INLET_AUTH_EMAIL_MODE: 'api',
    INLET_EMAIL_PROVIDER: 'ses',
    AWS_SES_REGION: 'ap-northeast-2',
    AWS_SES_ACCESS_KEY_ID: 'AKIA1234567890TEST',
    AWS_SES_SECRET_ACCESS_KEY: 'x'.repeat(40),
    INLET_AUTH_EMAIL_FROM: '페이지로 <support@pagero.kr>',
    INLET_SESSION_SECRET: 'qa-session-secret-32-characters-long',
    ...overrides,
  };
}

assert(authAccountErrorMessage({ message: 'Email is already registered.' }) === '이미 가입된 이메일입니다. 로그인해주세요.', 'duplicate email errors should render in Korean');
assert(authAccountErrorMessage({ message: 'Phone number is already registered.' }) === '이미 가입된 휴대폰번호입니다. 다른 번호를 확인해주세요.', 'duplicate phone errors should render in Korean');
assert(authAccountErrorMessage({ message: 'Verification email was requested too recently.' }) === '인증 메일을 이미 보냈습니다. 잠시 후 다시 시도해주세요.', 'cooldown errors should render in Korean');
assert(authAccountErrorMessage({ message: 'Password must include letters and numbers and be at least 6 characters.' }) === '비밀번호는 영문과 숫자를 포함해 6자리 이상으로 입력해주세요.', 'password errors should render in Korean');

const localMock = await issueEmailVerificationToken({
  email: 'auth-email-local@example.test',
  purpose: 'password-reset',
}, {});
assert(localMock.delivery?.mode === 'mock', 'local mock mode should remain available for offline QA');
assert(localMock.token, 'local mock mode should expose a fallback token');

await captureError(() => issueEmailVerificationToken({
  email: 'auth-email-production@example.test',
  purpose: 'password-reset',
}, {
  CF_PAGES_BRANCH: 'main',
  INLET_AUTH_EMAIL_MODE: 'mock',
  INLET_AUTH_EMAIL_EXPOSE_TOKEN: '1',
}), 'EMAIL_SEND_NOT_CONFIGURED');

await captureError(() => issueEmailVerificationToken({
  email: 'auth-email-missing@example.test',
  purpose: 'password-reset',
}, {
  INLET_AUTH_EMAIL_MODE: 'api',
  INLET_EMAIL_PROVIDER: 'ses',
}), 'EMAIL_SEND_NOT_CONFIGURED');

await captureError(() => issueEmailVerificationToken({
  email: 'auth-email-provider@example.test',
  purpose: 'password-reset',
}, {
  INLET_AUTH_EMAIL_MODE: 'api',
  INLET_EMAIL_PROVIDER: 'unsupported-provider',
}), 'EMAIL_SEND_PROVIDER_UNSUPPORTED');

let fetchCount = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  fetchCount += 1;
  throw new Error('fetch must not run before verification persistence succeeds');
};
try {
  await captureError(() => issueEmailVerificationToken({
    email: 'auth-email-storage@example.test',
    purpose: 'password-reset',
  }, sesEnv()), 'EMAIL_VERIFICATION_STORAGE_FAILED');
  assert(fetchCount === 0, 'SES must not be called when verification persistence is unavailable');
} finally {
  globalThis.fetch = originalFetch;
}

fetchCount = 0;
globalThis.fetch = async () => {
  fetchCount += 1;
  throw new Error('invalid region must fail before network');
};
try {
  await captureError(() => issueEmailVerificationToken({
    email: 'auth-email-region@example.test',
    purpose: 'password-reset',
  }, sesEnv({ AWS_SES_REGION: 'ap-northeast-2.attacker.example' })), 'EMAIL_SEND_NOT_CONFIGURED');
  assert(fetchCount === 0, 'invalid SES region must be blocked before network');
} finally {
  globalThis.fetch = originalFetch;
}

const rejectionDb = createVerificationDb();
let rejectedRequests = 0;
globalThis.fetch = async (url, options = {}) => {
  rejectedRequests += 1;
  assert(String(url) === 'https://email.ap-northeast-2.amazonaws.com/v2/email/outbound-emails', 'SES destination must be fixed');
  assert(options.method === 'POST', 'SES send must use POST');
  assert(options.redirect === 'error', 'SES redirects must be blocked');
  return new Response(JSON.stringify({
    __type: 'ThrottlingException',
    message: 'SENSITIVE_PROVIDER_MESSAGE',
    RequestId: 'SENSITIVE_REQUEST_ID',
  }), {
    status: 429,
    headers: { 'Content-Type': 'application/json' },
  });
};
try {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const error = await captureError(() => issueEmailVerificationToken({
      email: 'auth-email-cleanup@example.test',
      purpose: 'password-reset',
    }, sesEnv({ DB: rejectionDb })), 'EMAIL_SEND_QUOTA_EXCEEDED');
    assert(Object.keys(error.details || {}).sort().join(',') === 'code,provider', 'provider error details must stay minimal');
    assert(rejectionDb.rows.length === 0, 'failed delivery must remove pending verification and cooldown residue');
  }
  assert(rejectedRequests === 2, 'retry after failed delivery must not be blocked by cooldown residue');
} finally {
  globalThis.fetch = originalFetch;
}

const successDb = createVerificationDb();
globalThis.fetch = async (url, options = {}) => {
  assert(String(url) === 'https://email.ap-northeast-2.amazonaws.com/v2/email/outbound-emails', 'successful SES destination must stay fixed');
  assert(options.redirect === 'error', 'successful SES request must block redirects');
  return new Response(JSON.stringify({ MessageId: 'SENSITIVE_MESSAGE_ID' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
try {
  const sent = await issueEmailVerificationToken({
    email: 'auth-email-success@example.test',
    purpose: 'password-reset',
  }, sesEnv({ DB: successDb }));
  assert(sent.delivery?.status === 'sent', 'successful SES delivery should report sent');
  assert(!('token' in sent), 'real SES response must not expose verification token');
  assert(!('messageId' in (sent.delivery || {})), 'real SES response must not expose provider message ID');
  assert(successDb.rows.length === 1, 'successful delivery should keep one pending verification record');
} finally {
  globalThis.fetch = originalFetch;
}

const authSource = await readFile('functions/api/auth/_auth.js', 'utf8');
const localServerSource = await readFile('server/index.mjs', 'utf8');
for (const token of [
  '[페이지로] 비밀번호 변경 인증 코드',
  '[페이지로] 이메일 인증 코드',
  '아래 6자리 코드를 인증 화면에 입력해주세요.',
  'auth_email_verifications',
  'assertEmailVerificationSendAllowed',
  'EMAIL_VERIFICATION_COOLDOWN',
  'EMAIL_VERIFICATION_DAILY_LIMIT',
  'EMAIL_VERIFICATION_STORAGE_FAILED',
  'removeEmailVerificationCode',
  'isProductionAuthEmailRuntime',
  "redirect: 'error'",
  'sesApiOrigin',
  'EMAIL_SEND_SANDBOX_REJECTED',
  'EMAIL_DOMAIN_NOT_VERIFIED',
  'EMAIL_SEND_QUOTA_EXCEEDED',
]) {
  assert(authSource.includes(token), `auth email source missing ${token}`);
}

for (const forbidden of [
  'providerMessage:',
  'requestId:',
  'messageId: responseData',
  "message: String(error?.message || error || '')",
]) {
  assert(!authSource.includes(forbidden), `auth email source must not expose ${forbidden}`);
}
assert(!/[�]|占|몄|蹂대궡|硫붿씪|踰덊샇|뚯썝|\?꾩|\?섏|\?붿|\?대\?|\?\?\?\?/.test(authSource), 'auth email source must not contain known mojibake tokens');
assert(localServerSource.includes('normalizeAuthEmailMode') && localServerSource.includes("if (mode === 'api' || mode === 'ses') return 'api'"), 'local auth email mode must support api/ses');
assert(localServerSource.includes('sendSesEmail({') && localServerSource.includes("provider: 'ses'") && localServerSource.includes('authEmailVerificationHtml'), 'local auth email delivery must support SES HTML mail');
assert(localServerSource.includes('emailDeliveryReady: isLocalAuthEmailReady()'), 'local health endpoint must report SES readiness');

console.log(JSON.stringify({
  ok: true,
  checks: 42,
  contracts: [
    'production-mock-blocked',
    'production-token-exposure-blocked',
    'verification-persisted-before-send',
    'failed-delivery-residue-cleaned',
    'ses-region-and-endpoint-fixed',
    'ses-redirects-blocked',
    'provider-details-redacted',
    'provider-message-id-hidden',
  ],
}, null, 2));
