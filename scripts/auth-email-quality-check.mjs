import { readFile } from 'node:fs/promises';
import { issueEmailVerificationToken } from '../functions/api/auth/_auth.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectAuthEmailError(env = {}, expectedCode = '') {
  try {
    await issueEmailVerificationToken({ email: 'auth-email-qa@example.test', purpose: 'signup' }, env);
  } catch (error) {
    const message = String(error?.message || '');
    assert(error?.status === 503, `expected email send failure status 503, got ${error?.status}`);
    assert(error?.details?.code === expectedCode, `expected ${expectedCode}, got ${error?.details?.code}`);
    assert(message === '메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 'email send failure must use generic Korean copy');
    assert(!/AWS|SES|quota|sandbox|domain|secret|token|access key/i.test(message), 'email send failure must not expose provider/internal detail');
    return;
  }
  throw new Error(`expected ${expectedCode} email failure`);
}

const mockVerification = await issueEmailVerificationToken({
  email: 'auth-email-qa@example.test',
  purpose: 'password-reset',
}, {});

assert(mockVerification.delivery?.mode === 'mock', 'mock auth email mode should stay available for offline QA');
assert(mockVerification.token, 'mock auth email mode should expose token for offline QA');
assert(mockVerification.expiresAt, 'auth email verification should include expiry');

await expectAuthEmailError({
  INLET_AUTH_EMAIL_MODE: 'api',
  INLET_EMAIL_PROVIDER: 'ses',
}, 'EMAIL_SEND_NOT_CONFIGURED');

await expectAuthEmailError({
  INLET_AUTH_EMAIL_MODE: 'api',
  INLET_EMAIL_PROVIDER: 'unsupported-provider',
}, 'EMAIL_SEND_PROVIDER_UNSUPPORTED');

const authSource = await readFile('functions/api/auth/_auth.js', 'utf8');
for (const token of [
  '[페이지로] 비밀번호 변경 인증 코드',
  '[페이지로] 이메일 인증 코드',
  '아래 6자리 코드를 인증 화면에 입력해주세요.',
  'font-size:48px',
  'letter-spacing:6px',
  '30분 후 만료됩니다.',
  '본인이 요청하지 않았다면 고객센터',
  'INLET_SUPPORT_EMAIL',
  'support@pagero.kr',
  'auth_email_verifications',
  'assertEmailVerificationSendAllowed',
  'EMAIL_VERIFICATION_COOLDOWN',
  'EMAIL_VERIFICATION_DAILY_LIMIT',
  'AUTH_EMAIL_DUPLICATE',
  'Email is already registered.',
  'retryAfterSeconds: 60',
  'Number(record.attempts || 0) >= 5',
  'EMAIL_SEND_SANDBOX_REJECTED',
  'EMAIL_DOMAIN_NOT_VERIFIED',
  'EMAIL_SEND_QUOTA_EXCEEDED',
  'AWS_ACCESS_KEY_ID',
  'Secret access key',
  'ap-northeast-2',
  '페이지로 <support@pagero.kr>',
]) {
  assert(authSource.includes(token), `auth email source missing ${token}`);
}

assert(!/[�]|占|몄|蹂대궡|硫붿씪|踰덊샇|뚯썝/.test(authSource), 'auth email source must not contain known mojibake tokens');

console.log(JSON.stringify({
  ok: true,
  checks: 18,
  contracts: [
    'mock-token-exposed-only-offline',
    'ses-missing-config-generic-error',
    'unsupported-provider-generic-error',
    'korean-auth-email-copy',
  ],
}, null, 2));
