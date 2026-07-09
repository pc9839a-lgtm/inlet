export const PAGE_SAVE_LABEL = '페이지';

export const SAVE_BLOCKED_FEEDBACK = {
  level: 'warning',
  title: '저장 차단',
  message: '현재 권한에서 저장할 수 없는 화면입니다.',
};

export const WRITE_BLOCKED_FEEDBACK = {
  level: 'warning',
  title: '권한 없음',
  message: '마스터가 부여한 쓰기 권한이 필요합니다.',
  toast: '현재 계정에는 이 화면을 저장할 권한이 없습니다.',
};

export const STYLE_CONFIRM_FEEDBACK = {
  title: '스타일 설정을 저장할까요?',
  message: '현재 미리보기 중인 스타일 값이 실제 페이지에 적용됩니다.',
  confirmLabel: '저장',
};

export const STYLE_SAVED_TOAST = '스타일 설정이 저장되었습니다.';

export function pageSaveErrorFeedback(error, handled = false) {
  if (handled) {
    return {
      level: 'warning',
      title: '저장 충돌',
      message: '다른 곳에서 먼저 저장된 페이지가 있어 확인이 필요합니다.',
      toast: '',
    };
  }

  const detail = String(error?.message || error || '알 수 없는 오류');
  return {
    level: 'error',
    title: '서버 저장 실패',
    message: '로컬에는 남았지만 서버 저장에 실패했습니다. ' + detail,
    toast: '서버 저장에 실패했습니다. ' + detail,
  };
}

export function pageSaveSuccessFeedback(result, scope = 'page') {
  const local = result?.mode === 'local';
  const target = scope === 'style' ? '스타일과 페이지' : PAGE_SAVE_LABEL;
  return {
    level: 'ok',
    title: local ? '로컬 저장됨' : '서버 저장됨',
    message: local ? target + '가 브라우저에 저장되었습니다.' : target + '가 서버에 저장되었습니다.',
  };
}
