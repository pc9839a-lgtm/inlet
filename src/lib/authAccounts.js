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
  if (code === 'AUTH_PHONE_DUPLICATE') return '이미 가입된 핸드폰번호입니다. 다른 번호를 확인해주세요.';
  if (code === 'AUTH_PHONE_REQUIRED') return '핸드폰번호를 입력해주세요.';
  if (code === 'AUTH_EMAIL_REQUIRED') return '이메일을 확인해주세요.';
  if (code === 'AUTH_PASSWORD_POLICY') return '비밀번호는 영문과 숫자를 포함해 6자 이상으로 입력해주세요.';
  return String(error?.message || error || '계정 처리 중 오류가 발생했습니다.');
}

export async function registerAuthAccount(user = {}) {
  const data = await postJson('/api/auth/register', {
    user: {
      ...user,
      email: String(user.email || '').trim().toLowerCase(),
      phone: normalizeAccountPhone(user.phone),
      source: user.source || 'signup',
    },
  });
  return data?.user || null;
}

export async function changeAuthPassword(input = {}) {
  const data = await postJson('/api/auth/password', {
    email: String(input.email || '').trim().toLowerCase(),
    password: input.password || '',
    emailVerified: input.emailVerified === true,
  });
  return data?.user || null;
}
