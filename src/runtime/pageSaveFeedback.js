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

export function pageSaveErrorFeedback(_error, handled = false) {
  if (handled) {
    return {
      level: 'warning',
      title: '저장 내용이 겹쳤습니다',
      message: '현재 작업은 자동 보관했습니다.',
      toast: '',
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
