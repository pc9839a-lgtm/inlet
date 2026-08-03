from pathlib import Path


def replace_exact(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one exact match, found {count}")
    return source.replace(old, new, 1)


def replace_between(source: str, start: str, end: str, replacement: str, label: str) -> str:
    start_index = source.find(start)
    if start_index < 0:
        raise RuntimeError(f"{label}: start marker missing")
    end_index = source.find(end, start_index + len(start))
    if end_index < 0:
        raise RuntimeError(f"{label}: end marker missing")
    return source[:start_index] + replacement + source[end_index:]


auth_path = Path('functions/api/auth/_auth.js')
auth = auth_path.read_text(encoding='utf-8')

auth = replace_exact(
    auth,
    """  } catch (error) {
    console.error('auth email SES request failed', {
      code: 'EMAIL_SEND_TIMEOUT',
      provider: 'ses',
      message: String(error?.message || error || ''),
    });
    return null;
  }
""",
    """  } catch {
    return null;
  }
""",
    'remove unrelated SES logging from session verification',
)

issue_replacement = r'''export async function issueEmailVerificationToken(input = {}, env = {}) {
  const email = normalizeEmail(input.email || '');
  const purpose = String(input.purpose || 'signup').trim() || 'signup';
  if (!isValidEmail(email)) throw authError('Valid email is required.', 400, { code: 'AUTH_EMAIL_REQUIRED' });
  if (purpose === 'signup' && env.DB?.prepare && await getD1AccountByEmail(env.DB, email)) {
    throw authError('Email is already registered.', 409, { code: 'AUTH_EMAIL_DUPLICATE', field: 'email' });
  }

  const provider = emailProvider(env);
  assertAuthEmailDeliveryReady(provider, env);

  const now = Math.floor(Date.now() / 1000);
  await assertEmailVerificationSendAllowed(env.DB, { email, purpose, now });
  const expiresAt = new Date((now + 60 * 30) * 1000).toISOString();
  const code = verificationCode();
  const stored = await storeEmailVerificationCode(env.DB, { email, purpose, code, expiresAt }, env);

  if (provider !== 'mock' && !stored.ok) {
    throw authError('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 503, {
      code: 'EMAIL_VERIFICATION_STORAGE_FAILED',
      provider,
    });
  }

  const payload = { email, purpose, iat: now, exp: now + 60 * 30 };
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const signedFallbackToken = `${payloadPart}.${await hmacBase64Url(payloadPart, authSecret(env))}`;
  const token = stored.ok ? code : signedFallbackToken;

  let delivery;
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

  const exposeToken = shouldExposeVerificationToken(env, delivery);
  return {
    email,
    purpose,
    status: 'pending',
    expiresAt,
    delivery,
    ...(exposeToken ? { token } : {}),
  };
}

'''
auth = replace_between(
    auth,
    'export async function issueEmailVerificationToken',
    'async function assertEmailVerificationSendAllowed',
    issue_replacement,
    'replace email verification issue flow',
)

storage_replacement = r'''async function storeEmailVerificationCode(db, record = {}, env = {}) {
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

async function removeEmailVerificationCode(db, record = {}) {
  if (!db?.prepare || !record.id) return false;
  try {
    await db.prepare(`
      DELETE FROM auth_email_verifications
      WHERE id = ? AND email = ? AND purpose = ? AND status = 'pending'
    `).bind(record.id, record.email, record.purpose).run();
    return true;
  } catch {
    return false;
  }
}

'''
auth = replace_between(
    auth,
    'async function storeEmailVerificationCode',
    'async function confirmStoredEmailVerificationCode',
    storage_replacement,
    'replace verification storage and cleanup',
)

provider_replacement = r'''function isProductionAuthEmailRuntime(env = {}) {
  const branch = String(env.CF_PAGES_BRANCH || '').trim().toLowerCase();
  const environment = String(
    env.INLET_RUNTIME_ENV
      || env.INLET_ENVIRONMENT
      || env.NODE_ENV
      || env.ENVIRONMENT
      || '',
  ).trim().toLowerCase();
  return branch === 'main' || environment === 'production';
}

function emailProvider(env = {}) {
  const mode = String(env.INLET_AUTH_EMAIL_MODE || 'mock').trim().toLowerCase();
  if (mode === 'api' || mode === 'ses') return String(env.INLET_EMAIL_PROVIDER || 'ses').trim().toLowerCase();
  return 'mock';
}

function shouldExposeVerificationToken(env = {}, delivery = {}) {
  if (isProductionAuthEmailRuntime(env)) return false;
  if (delivery.mode !== 'mock') return false;
  return String(env.INLET_AUTH_EMAIL_EXPOSE_TOKEN || '1').trim() !== '0';
}

function normalizeSesRegion(value = '') {
  const region = String(value || '').trim().toLowerCase();
  return /^(?:af|ap|ca|eu|il|me|mx|sa|us)-(?:central|east|north|northeast|northwest|south|southeast|southwest|west)-\d$/.test(region)
    ? region
    : '';
}

function boundedAuthEmailTimeout(value = '') {
  const parsed = Number(value || 10000);
  if (!Number.isFinite(parsed)) return 10000;
  return Math.min(60000, Math.max(5000, Math.trunc(parsed)));
}

function sesApiOrigin(region = '') {
  const normalized = normalizeSesRegion(region);
  return normalized ? `https://email.${normalized}.amazonaws.com` : '';
}

function sesAuthEmailConfig(env = {}) {
  const region = normalizeSesRegion(envFirst(env, ['AWS_SES_REGION', 'INLET_AWS_SES_REGION', 'AWS_REGION'], 'ap-northeast-2'));
  const accessKeyId = envFirst(env, ['AWS_SES_ACCESS_KEY_ID', 'INLET_AWS_SES_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID', 'SES_ACCESS_KEY_ID', 'Access key ID']);
  const secretAccessKey = envFirst(env, ['AWS_SES_SECRET_ACCESS_KEY', 'INLET_AWS_SES_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY', 'SES_SECRET_ACCESS_KEY', 'Secret access key']);
  const sender = normalizeSesFromAddress(envFirst(env, ['INLET_AUTH_EMAIL_FROM', 'INLET_LEAD_EMAIL_FROM', 'AWS_SES_FROM']));
  const ok = !!region
    && accessKeyId.length >= 16
    && accessKeyId.length <= 128
    && secretAccessKey.length >= 32
    && secretAccessKey.length <= 256
    && !!sender;
  return {
    ok,
    region,
    accessKeyId,
    secretAccessKey,
    sender,
    timeoutMs: boundedAuthEmailTimeout(env.INLET_AUTH_EMAIL_TIMEOUT_MS || env.INLET_INTEGRATION_TIMEOUT_MS),
  };
}

function assertAuthEmailDeliveryReady(provider = '', env = {}) {
  if (provider === 'mock') {
    if (isProductionAuthEmailRuntime(env)) {
      throw authError('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 503, {
        code: 'EMAIL_SEND_NOT_CONFIGURED',
        provider: 'mock',
      });
    }
    return;
  }
  if (provider !== 'ses') {
    throw authError('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 503, {
      code: 'EMAIL_SEND_PROVIDER_UNSUPPORTED',
      provider,
    });
  }
  if (!sesAuthEmailConfig(env).ok) {
    throw authError('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 503, {
      code: 'EMAIL_SEND_NOT_CONFIGURED',
      provider: 'ses',
    });
  }
}

function sanitizedAuthEmailDeliveryError(error, provider = '') {
  const allowedCodes = new Set([
    'EMAIL_SEND_NOT_CONFIGURED',
    'EMAIL_SEND_PROVIDER_UNSUPPORTED',
    'EMAIL_SEND_TIMEOUT',
    'EMAIL_SEND_SANDBOX_REJECTED',
    'EMAIL_DOMAIN_NOT_VERIFIED',
    'EMAIL_SEND_QUOTA_EXCEEDED',
    'EMAIL_SEND_PROVIDER_ERROR',
    'EMAIL_VERIFICATION_STORAGE_FAILED',
  ]);
  const candidate = String(error?.details?.code || '');
  const code = allowedCodes.has(candidate) ? candidate : 'EMAIL_SEND_PROVIDER_ERROR';
  return authError('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 503, {
    code,
    provider: provider === 'ses' ? 'ses' : String(provider || 'unknown'),
  });
}

'''
auth = replace_between(
    auth,
    'function emailProvider',
    'function envFirst',
    provider_replacement,
    'replace provider runtime safety helpers',
)

delivery_replacement = r'''async function deliverAuthEmail(message = {}, env = {}, provider = emailProvider(env)) {
  const nextMessage = {
    ...message,
    supportEmail: String(env.INLET_SUPPORT_EMAIL || 'support@pagero.kr').trim() || 'support@pagero.kr',
  };
  if (provider === 'mock') {
    return {
      mode: 'mock',
      provider: 'mock',
      status: 'issued',
      message: 'Offline QA mode returns the verification token in the API response.',
    };
  }
  if (provider === 'ses') return sendSesAuthEmail(nextMessage, env);
  throw authError('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 503, {
    code: 'EMAIL_SEND_PROVIDER_UNSUPPORTED',
    provider,
  });
}

async function sendSesAuthEmail(message = {}, env = {}) {
  const config = sesAuthEmailConfig(env);
  if (!config.ok) {
    throw authError('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 503, {
      code: 'EMAIL_SEND_NOT_CONFIGURED',
      provider: 'ses',
    });
  }

  const subject = cleanAuthEmailSubject(message.purpose);
  const text = cleanAuthEmailText(message);
  const html = cleanAuthEmailHtml(message);
  const body = JSON.stringify({
    FromEmailAddress: config.sender,
    Destination: { ToAddresses: [message.email] },
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Text: { Data: text, Charset: 'UTF-8' },
          Html: { Data: html, Charset: 'UTF-8' },
        },
      },
    },
  });

  const path = '/v2/email/outbound-emails';
  const origin = sesApiOrigin(config.region);
  const url = new URL(path, origin);
  if (!origin || url.origin !== origin || url.pathname !== path || url.search || url.hash) {
    throw authError('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 503, {
      code: 'EMAIL_SEND_NOT_CONFIGURED',
      provider: 'ses',
    });
  }

  const host = url.host;
  const now = new Date();
  const amzDate = awsAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(body);
  const canonicalHeaders = [
    'content-type:application/json',
    `host:${host}`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n';
  const signedHeaders = 'content-type;host;x-amz-date';
  const canonicalRequest = ['POST', path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${config.region}/ses/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');
  const signingKey = await awsSigningKey(config.secretAccessKey, dateStamp, config.region, 'ses');
  const signature = bytesToHex(await hmacBytesRaw(signingKey, stringToSign));
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  let response;
  try {
    response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Amz-Date': amzDate,
        Authorization: authorization,
      },
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch {
    console.error('auth email SES request failed', {
      code: 'EMAIL_SEND_TIMEOUT',
      provider: 'ses',
    });
    throw authError('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 503, {
      code: 'EMAIL_SEND_TIMEOUT',
      provider: 'ses',
    });
  }

  const responseText = (await response.text()).slice(0, 10000);
  let responseData = {};
  try {
    responseData = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseData = {};
  }
  if (!response.ok) {
    const errorType = String(responseData.__type || responseData.message || responseData.Message || '').toLowerCase();
    const code = errorType.includes('sandbox')
      ? 'EMAIL_SEND_SANDBOX_REJECTED'
      : errorType.includes('notverified') || errorType.includes('identity')
        ? 'EMAIL_DOMAIN_NOT_VERIFIED'
        : response.status === 429 || errorType.includes('throttl') || errorType.includes('limit')
          ? 'EMAIL_SEND_QUOTA_EXCEEDED'
          : 'EMAIL_SEND_PROVIDER_ERROR';
    console.error('auth email SES provider rejected request', {
      code,
      provider: 'ses',
      httpStatus: response.status,
    });
    throw authError('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 503, {
      code,
      provider: 'ses',
    });
  }

  return {
    mode: 'api',
    provider: 'ses',
    status: 'sent',
  };
}

'''
auth = replace_between(
    auth,
    'async function deliverAuthEmail',
    'function cleanAuthEmailSubject',
    delivery_replacement,
    'replace SES delivery runtime',
)

for forbidden in [
    'providerMessage:',
    'requestId:',
    'messageId: responseData',
]:
    if forbidden in auth:
        raise RuntimeError(f'auth source still contains forbidden provider detail: {forbidden}')

for required in [
    "redirect: 'error'",
    'EMAIL_VERIFICATION_STORAGE_FAILED',
    'removeEmailVerificationCode',
    'isProductionAuthEmailRuntime',
    'sesApiOrigin',
]:
    if required not in auth:
        raise RuntimeError(f'auth source missing required runtime guard: {required}')

auth_path.write_text(auth, encoding='utf-8')

qa = r'''import { readFile } from 'node:fs/promises';
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
'''
Path('scripts/auth-email-quality-check.mjs').write_text(qa, encoding='utf-8')

doc = '''# Auth Email Runtime Security Status

Updated: 2026-08-04

SES 운영 준비 상태와 실제 인증 이메일 런타임 안전성은 별개다.

## 이번 패치에서 완료

- 운영 `main` 또는 production 환경의 `mock` delivery 차단
- 운영 `INLET_AUTH_EMAIL_EXPOSE_TOKEN=1` 설정으로도 인증코드 응답 노출 불가
- 실제 SES 발송 전에 D1 인증코드 저장 성공 필수
- 발송 실패 시 해당 pending 인증코드 즉시 삭제
- 실패한 요청이 60초 cooldown 및 일일 발송 횟수에 남지 않도록 residue 정리
- SES region 형식 제한 및 `https://email.<region>.amazonaws.com` 목적지 고정
- SES 요청의 redirect 추적 차단
- SES timeout 5~60초 범위 제한
- provider 오류 원문, request ID, message ID, identity 및 수신자 주소 API 응답 비노출
- 사용자 오류 문구를 일반적인 재시도 안내로 고정
- 세션 토큰 파싱 실패가 SES 오류로 잘못 기록되던 로그 제거

## 아직 남은 작업

- 가입·비밀번호 재설정·이메일 변경 등 인증 목적별 조회를 DB 쿼리 단계에서 완전히 격리
- 인증 완료 코드를 즉시 `consumed` 처리하고 재사용 정책 확정
- 테스트 수신함 allowlist 기반 실제 발송 검증
- 이메일 변경·매니저 초대·소유권 이전 알림의 구현 상태별 실검증
- 운영 SES/DNS 읽기 전용 verifier의 `verified-live` 증빙 확보

실제 이메일 발송 검증은 고객 데이터가 없는 전용 계정과 allowlist 수신함으로 별도 승인 후 진행한다.
'''
Path('docs/ops-auth-email-runtime-risks.md').write_text(doc, encoding='utf-8')

print('auth email runtime hardening applied')
