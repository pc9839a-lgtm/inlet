import { isRetryablePageSaveFailure, pageSaveFailureKind } from '../lib/pageSaveTransportPolicy.js';

export const PAGE_SAVE_LABEL = '페이지';

export const SAVE_BLOCKED_FEEDBACK = {
  level: 'warning',
  title: '저장할 수 없음',
  message: '이 화면은 저장할 수 없습니다.',
};

export const WRITE_BLOCKED_FEEDBACK = {
  level: 'warning',
  title: '저장 권한 없음',
  message: '이 화면을 저장할 권한이 없습니다.',
  toast: '저장 권한이 없습니다.',
};

export const STYLE_CONFIRM_FEEDBACK = {
  title: '스타일을 저장할까요?',
  message: '',
  confirmLabel: '저장',
};

export const STYLE_SAVED_TOAST = '저장됨';

export function pageSaveErrorFeedback(error, handled = false, recovery = { saved: true, message: '' }) {
  if (recovery?.saved === false) {
    return {
      level: 'error',
      title: handled ? '저장 충돌 · 임시 보관 실패' : '저장 실패 · 임시 보관 실패',
      message: recovery?.message || '현재 작업을 브라우저에 임시 보관하지 못했습니다. 이 화면을 닫지 말고 다시 저장해주세요.',
      toast: '임시 보관 실패 · 화면을 닫지 마세요',
    };
  }

  if (handled) {
    return {
      level: 'warning',
      title: '저장 내용이 겹쳤습니다',
      message: '현재 작업은 자동 보관했습니다.',
      toast: '',
    };
  }

  if (isRetryablePageSaveFailure(error)) {
    const failureKind = pageSaveFailureKind(error);
    const connectionIssue = failureKind === 'network' || failureKind === 'timeout';
    return {
      level: 'error',
      title: '일시적 저장 실패',
      message: connectionIssue
        ? '작업은 자동 보관했습니다. 인터넷 연결을 확인한 뒤 저장을 다시 눌러주세요.'
        : '작업은 자동 보관했습니다. 잠시 후 저장을 다시 눌러주세요.',
      toast: '저장 실패 · 다시 저장 가능',
    };
  }

  return {
    level: 'error',
    title: '저장 실패',
    message: '작업은 자동 보관했습니다. 다시 저장해주세요.',
    toast: '저장 실패 · 작업은 자동 보관됨',
  };
}

export function pageSaveSuccessFeedback(result) {
  const local = result?.mode === 'local';
  return {
    level: 'ok',
    title: local ? '브라우저에 저장됨' : '저장됨',
    message: '',
  };
}
