export function isLeadConflictError(error) {
  const message = String(error?.message || error || '');
  return Number(error?.status || 0) === 409 || /409|conflict|stale|다른 곳|다른 위치|먼저 수정/.test(message);
}

export function isPageConflictError(error) {
  const message = String(error?.message || error || '');
  const code = String(error?.details?.code || error?.details?.errorCode || '').trim();
  if (['PAGE_PUBLIC_VERIFY_FAILED', 'PAGE_SLUG_CONFLICT'].includes(code)) return false;
  if (code === 'PAGE_REVISION_CONFLICT') return true;
  return /PAGE_REVISION_CONFLICT|stale|저장 충돌|다른 곳|다른 위치|먼저 저장/.test(message);
}

export function leadConflictMessage(action = '저장') {
  return `접수 데이터 ${action}에 충돌이 있습니다. 다른 화면에서 먼저 수정된 데이터일 수 있습니다.`;
}
