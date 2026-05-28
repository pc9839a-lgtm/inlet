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
  if (code === 'AUTH_EMAIL_DUPLICATE') return '이미 가입된 이메일입니다. 로그인해주세요.';
  if (code === 'AUTH_PHONE_DUPLICATE') return '이미 가입된 휴대폰 번호입니다. 다른 번호를 확인해주세요.';
  if (code === 'AUTH_PHONE_REQUIRED') return '휴대폰 번호를 입력해주세요.';
  if (code === 'AUTH_EMAIL_REQUIRED') return '이메일을 확인해주세요.';
  if (code === 'AUTH_PASSWORD_POLICY') return '비밀번호는 영문과 숫자를 포함해 6자 이상으로 입력해주세요.';
  if (code === 'EMAIL_VERIFICATION_REQUIRED') return '이메일 인증을 먼저 완료해주세요.';
  if (code === 'EMAIL_VERIFICATION_TOKEN_REQUIRED') return '이메일 인증 코드를 입력해주세요.';
  if (code === 'EMAIL_VERIFICATION_INVALID') return '이메일 인증 정보가 올바르지 않습니다.';
  if (code === 'EMAIL_VERIFICATION_EXPIRED') return '이메일 인증 시간이 만료되었습니다. 다시 인증해주세요.';
  if (code === 'AUTH_LOGIN_INVALID') return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (code === 'AUTH_LOGIN_REQUIRED') return '이메일과 비밀번호를 입력해주세요.';
  if (code === 'AUTH_SESSION_INVALID') return '로그인 세션이 만료되었습니다. 다시 로그인해주세요.';
  if (code === 'AUTH_ACCOUNT_NOT_FOUND') return '계정을 찾을 수 없습니다. 이메일을 확인해주세요.';
  if (code === 'AUTH_ACCOUNT_SUSPENDED') return '정지된 계정입니다. 관리자에게 문의해주세요.';
  if (code === 'AUTH_ACCOUNT_DELETED') return '탈퇴 처리 보류 중인 계정입니다.';
  if (code === 'AUTH_ACCOUNT_STATUS_INVALID') return '변경할 수 없는 계정 상태입니다.';
  return String(error?.message || error || '계정 처리 중 오류가 발생했습니다.');
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
    user: {
      ...user,
      email: String(user.email || '').trim().toLowerCase(),
      phone: normalizeAccountPhone(user.phone),
      token: user.token || user.verificationToken || '',
      source: user.source || 'signup',
    },
  });
  return data?.user || null;
}

export async function changeAuthPassword(input = {}) {
  const data = await postJson('/api/auth/password', {
    email: String(input.email || '').trim().toLowerCase(),
    password: input.password || '',
    token: input.token || input.verificationToken || '',
  });
  return data?.user || null;
}
