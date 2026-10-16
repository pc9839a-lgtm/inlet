// Read-only presentation helpers. Never render raw provider errors containing URLs or secrets.
export function deliveryStatusText(status = '') {
  const key = String(status || '').toLowerCase();
  return ({ sent: '전송 완료', success: '전송 완료', failed: '전송 실패', timeout: '응답 지연', pending: '처리 대기', 'dead-letter': '재시도 종료', partial: '일부 실패' })[key] || '상태 확인 필요';
}
export function deliveryQueueText(item = {}) {
  if (item.deadLetter) return '재시도 종료';
  if (item.canRetry) return item.nextRetryAt ? '재시도 대기' : '재시도 대상';
  return '상태 확인 필요';
}
export function deliveryFailureHint(item = {}) {
  const reason = String(item.error || item.summary || item.message || '').toLowerCase();
  if (!reason) return '실패 상세는 서버 로그에서 확인';
  if (/timeout|timed out|abort|시간 초과/i.test(reason)) return '응답 시간 초과';
  if (/429|rate limit|too many/i.test(reason)) return '요청 제한';
  if (/401|403|unauthoriz|forbidden|permission/i.test(reason)) return '인증 또는 권한 오류';
  if (/404|not found/i.test(reason)) return '연결 주소 확인 필요';
  if (/5\d\d|server error|upstream/i.test(reason)) return '외부 서비스 응답 오류';
  return '외부 전송 오류';
}
export function deliveryLeadRef(value = '') {
  const safe = String(value || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return safe ? '…' + safe.slice(-6) : '미확인';
}
export function deliveryTime(value = '') {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('ko-KR');
}
