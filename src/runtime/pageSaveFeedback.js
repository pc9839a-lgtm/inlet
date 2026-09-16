import { isRetryablePageSaveFailure, pageSaveFailureKind } from '../lib/pageSaveTransportPolicy.js';

export const PAGE_SAVE_LABEL = '페이지';

function isAuthSessionSaveFailure(error = null) {
  const status = Number(error?.status || 0);
  const code = String(error?.details?.code || error?.details?.errorCode || '').trim();
  const message = String(error?.message || error || '');
  return status === 401
    || code === 'AUTH_SESSION_INVALID'
    || code === 'AUTH_SESSION_MISSING'
    || /Session is invalid|Session account was not found|로그인 세션/i.test(message);
}

export const SAVE_BLOCKED_FEEDBACK = {
  level: 'warning',
  title: '발행할 수 없음',
  message: '이 화면은 발행할 수 없습니다.',
};

export const WRITE_BLOCKED_FEEDBACK = {
  level: 'warning',
  title: '발행 권한 없음',
  message: '이 화면을 발행할 권한이 없습니다.',
  toast: '발행 권한이 없습니다.',
};

export const STYLE_CONFIRM_FEEDBACK = {
  title: '스타일 변경을 발행할까요?',
  message: '발행하면 현재 스타일이 공개 페이지에 반영됩니다.',
  confirmLabel: '발행',
};

export const STYLE_SAVED_TOAST = '발행됨';
export const PUBLIC_VERIFY_DELAYED_TOAST = '서버 발행은 완료됐지만 공개 반영 확인이 지연되고 있습니다. 임시 복구본을 유지합니다.';

export function pageSavePublicVerificationPending(result = null) {
  return result?.mode !== 'local' && result?.publicVerification?.pending === true;
}

export function pageSavePublicVerificationDelayed(result = null) {
  return result?.mode !== 'local'
    && result?.publicVerification?.pending === false
    && result?.publicVerification?.ok === false;
}

export function pageSaveErrorFeedback(error, handled = false, recovery = { saved: true, message: '' }) {
  if (recovery?.saved === false) {
    return {
      level: 'error',
      title: handled ? '발행 충돌 · 임시 보관 실패' : '발행 실패 · 임시 보관 실패',
      message: recovery?.message || '현재 작업을 브라우저에 임시 보관하지 못했습니다. 이 화면을 닫지 말고 다시 발행해주세요.',
      toast: '임시 보관 실패 · 화면을 닫지 마세요',
    };
  }

  if (isAuthSessionSaveFailure(error)) {
    return {
      level: 'warning',
      title: '로그인이 만료되었습니다',
      message: '작업은 자동 임시보관했습니다. 다시 로그인한 뒤 발행해주세요.',
      toast: '로그인 만료 · 작업은 자동 임시보관됨',
    };
  }

  if (handled) {
    return {
      level: 'warning',
      title: '발행 내용이 겹쳤습니다',
      message: '현재 작업은 자동 임시보관했습니다.',
      toast: '',
    };
  }

  if (isRetryablePageSaveFailure(error)) {
    const failureKind = pageSaveFailureKind(error);
    const connectionIssue = failureKind === 'network' || failureKind === 'timeout';
    return {
      level: 'error',
      title: '일시적 발행 실패',
      message: connectionIssue
        ? '작업은 자동 임시보관했습니다. 인터넷 연결을 확인한 뒤 발행을 다시 눌러주세요.'
        : '작업은 자동 임시보관했습니다. 잠시 후 발행을 다시 눌러주세요.',
      toast: '발행 실패 · 다시 발행 가능',
    };
  }

  return {
    level: 'error',
    title: '발행 실패',
    message: '작업은 자동 임시보관했습니다. 다시 발행해주세요.',
    toast: '발행 실패 · 작업은 자동 임시보관됨',
  };
}

export function pageSaveSuccessFeedback(result, scope = 'page') {
  const local = result?.mode === 'local';
  const target = scope === 'style' ? '스타일과 페이지' : PAGE_SAVE_LABEL;

  if (pageSavePublicVerificationPending(result)) {
    return {
      level: 'warning',
      title: '발행됨 · 공개 반영 확인 중',
      message: `${target} 발행은 서버에 기록됐습니다. 공개 페이지 반영 확인 전까지 임시 복구본을 유지합니다.`,
      toast: '',
    };
  }

  if (pageSavePublicVerificationDelayed(result)) {
    return {
      level: 'warning',
      title: '발행됨 · 공개 반영 확인 필요',
      message: `${target} 발행은 서버에 기록됐지만 공개 페이지의 최신 반영을 확인하지 못했습니다. 임시 복구본을 유지합니다. 다시 발행해주세요.`,
      toast: PUBLIC_VERIFY_DELAYED_TOAST,
    };
  }

  return {
    level: 'ok',
    title: local ? '브라우저에 임시저장됨' : '발행됨',
    message: '',
    toast: '',
  };
}
