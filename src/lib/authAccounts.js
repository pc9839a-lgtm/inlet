import { postJson } from './apiClient.js';

export function normalizeAccountPhone(value = '') {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('82') && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}

export function isValidAccountPassword(value = '') {
  const password = String(value || '');
  return password.length >= 6 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export function authAccountErrorMessage(error) {
  const code = error?.details?.code || error?.details?.errorCode || '';
  const message = String(error?.message || error || '');
  const byCode = {
    AUTH_EMAIL_DUPLICATE: '이미 가입된 이메일입니다. 로그인해주세요.',
    AUTH_EMAIL_UNCHANGED: '현재 이메일과 다른 이메일을 입력해주세요.',
    AUTH_PHONE_DUPLICATE: '이미 가입된 휴대폰번호입니다. 다른 번호를 확인해주세요.',
    AUTH_PHONE_REQUIRED: '휴대폰번호를 입력해주세요.',
    AUTH_EMAIL_REQUIRED: '이메일을 확인해주세요.',
    AUTH_PASSWORD_POLICY: '비밀번호는 영문과 숫자를 포함해 6자리 이상으로 입력해주세요.',
    AUTH_CURRENT_PASSWORD_REQUIRED: '현재 비밀번호를 입력해주세요.',
    AUTH_CURRENT_PASSWORD_INVALID: '현재 비밀번호가 올바르지 않습니다.',
    EMAIL_VERIFICATION_REQUIRED: '이메일 인증을 먼저 완료해주세요.',
    EMAIL_VERIFICATION_TOKEN_REQUIRED: '이메일 인증 코드를 입력해주세요.',
    EMAIL_VERIFICATION_PURPOSE_INVALID: '이메일 인증 요청 종류를 다시 확인해주세요.',
    EMAIL_VERIFICATION_INVALID: '이메일 인증 코드가 올바르지 않습니다.',
    EMAIL_VERIFICATION_ALREADY_USED: '이미 사용한 인증 코드입니다. 새 인증 코드를 받아주세요.',
    EMAIL_VERIFICATION_EXPIRED: '이메일 인증 시간이 만료되었습니다. 다시 인증해주세요.',
    EMAIL_VERIFICATION_COOLDOWN: '인증 메일을 이미 보냈습니다. 잠시 후 다시 시도해주세요.',
    EMAIL_VERIFICATION_DAILY_LIMIT: '오늘 인증 메일 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    AUTH_LOGIN_INVALID: '이메일 또는 비밀번호가 올바르지 않습니다.',
    AUTH_LOGIN_REQUIRED: '이메일과 비밀번호를 입력해주세요.',
    AUTH_SESSION_INVALID: '로그인 세션이 만료되었습니다. 다시 로그인해주세요.',
    AUTH_SESSION_REVOKED: '보안을 위해 로그인 세션이 종료되었습니다. 다시 로그인해주세요.',
    AUTH_ACCOUNT_NOT_FOUND: '계정을 찾을 수 없습니다. 이메일을 확인해주세요.',
    AUTH_ACCOUNT_SUSPENDED: '정지된 계정입니다. 관리자에게 문의해주세요.',
    AUTH_ACCOUNT_DELETED: '탈퇴 처리 보류 중인 계정입니다.',
    AUTH_ACCOUNT_STATUS_INVALID: '변경할 수 없는 계정 상태입니다.',
  };
  if (byCode[code]) return byCode[code];
  if (/email is already registered/i.test(message)) return byCode.AUTH_EMAIL_DUPLICATE;
  if (/phone number is already registered/i.test(message)) return byCode.AUTH_PHONE_DUPLICATE;
  if (/phone number is required/i.test(message)) return byCode.AUTH_PHONE_REQUIRED;
  if (/valid email is required/i.test(message)) return byCode.AUTH_EMAIL_REQUIRED;
  if (/current password is required/i.test(message)) return byCode.AUTH_CURRENT_PASSWORD_REQUIRED;
  if (/current password is invalid/i.test(message)) return byCode.AUTH_CURRENT_PASSWORD_INVALID;
  if (/password must include/i.test(message)) return byCode.AUTH_PASSWORD_POLICY;
  if (/requested too recently/i.test(message)) return byCode.EMAIL_VERIFICATION_COOLDOWN;
  if (/too many verification emails/i.test(message)) return byCode.EMAIL_VERIFICATION_DAILY_LIMIT;
  if (/email or password is invalid/i.test(message)) return byCode.AUTH_LOGIN_INVALID;
  if (/email and password are required/i.test(message)) return byCode.AUTH_LOGIN_REQUIRED;
  if (/email verification/i.test(message)) return '이메일 인증 정보를 확인해주세요.';
  return message || '계정 처리 중 오류가 발생했습니다.';
}

export async function requestEmailVerification(email = '', purpose = 'signup') {
  const data = await postJson('/api/auth/email-verification', {
    email: String(email || '').trim().toLowerCase(),
    purpose,
  });
  return data?.verification || null;
}

export async function confirmEmailVerification(input = {}) {
  const data = await postJson('/api/auth/email-verification/confirm', {
    email: String(input.email || '').trim().toLowerCase(),
    token: input.token || '',
    purpose: input.purpose || '',
  });
  return data?.verification || null;
}

export async function loginAuthAccount(input = {}) {
  const data = await postJson('/api/auth/login', {
    email: String(input.email || '').trim().toLowerCase(),
    password: input.password || '',
    projectId: input.projectId || '',
  });
  return data?.user ? { ...data.user, session: data.session || '' } : null;
}

export async function startGoogleAuthLogin(input = {}) {
  const data = await postJson('/api/auth/login', {
    provider: 'google',
    action: 'google-oauth-url',
    projectId: input.projectId || '',
    next: input.next || '/',
  });
  const url = String(data?.url || '').trim();
  if (!url) throw new Error('Google 로그인 주소를 만들지 못했습니다.');
  window.location.assign(url);
}

export async function refreshAuthSession(input = {}) {
  const data = await postJson('/api/auth/session', {
    session: input.session || '',
    projectId: input.projectId || '',
  }, {
    headers: input.session ? { 'X-Inlet-Session': input.session } : {},
  });
  return data?.user ? { ...data.user, session: data.session || input.session || '' } : null;
}

export async function logoutAuthAccount(input = {}) {
  return postJson('/api/auth/logout', {}, {
    headers: input.session ? { 'X-Inlet-Session': input.session } : {},
  });
}

export async function updateAuthAccount(input = {}) {
  const data = await postJson('/api/auth/account', {
    name: String(input.name || '').trim(),
    phone: normalizeAccountPhone(input.phone),
    projectId: input.projectId || '',
    session: input.session || '',
  }, {
    method: 'PATCH',
    headers: input.session ? { 'X-Inlet-Session': input.session } : {},
  });
  return data?.user ? { ...data.user, session: data.session || input.session || '' } : null;
}

export async function changeAuthEmail(input = {}) {
  const data = await postJson('/api/auth/account/email', {
    email: String(input.email || '').trim().toLowerCase(),
    currentPassword: input.currentPassword || '',
    token: input.token || input.verificationToken || '',
    projectId: input.projectId || '',
    session: input.session || '',
  }, {
    method: 'PATCH',
    headers: input.session ? { 'X-Inlet-Session': input.session } : {},
  });
  return data?.user ? { ...data.user, session: data.session || '' } : null;
}

export async function updateAuthAccountStatus(input = {}) {
  const data = await postJson('/api/auth/account/status', {
    status: input.status || '',
    session: input.session || '',
  }, {
    method: 'PATCH',
    headers: input.session ? { 'X-Inlet-Session': input.session } : {},
  });
  return data?.user ? { ...data.user, session: data.session || '' } : null;
}

export async function registerAuthAccount(user = {}) {
  const data = await postJson('/api/auth/register', {
    projectId: user.projectId || '',
    user: {
      ...user,
      email: String(user.email || '').trim().toLowerCase(),
      phone: normalizeAccountPhone(user.phone),
      token: user.token || user.verificationToken || '',
      source: user.source || 'signup',
    },
  });
  return data?.user ? { ...data.user, session: data.session || '' } : null;
}

export async function changeAuthPassword(input = {}) {
  const data = await postJson('/api/auth/password', {
    email: String(input.email || '').trim().toLowerCase(),
    password: input.password || '',
    token: input.token || input.verificationToken || '',
  });
  return data?.user || null;
}
