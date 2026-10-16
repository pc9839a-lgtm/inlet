import { useCallback, useEffect, useState } from 'react';
import { isServerLeadMode } from '../../config/runtimeConfig.js';
import { apiFetch, projectAuthHeaders } from '../../lib/apiClient.js';
import { projectContext } from '../../lib/projectContext.js';
import { deliveryFailureHint, deliveryLeadRef, deliveryQueueText, deliveryStatusText, deliveryTime } from '../../lib/deliveryActivityView.js';

const EMPTY = { logs: [], entries: [], totalLogs: 0, retryable: 0, deadLetter: 0, loaded: false, error: '', loading: false };

function providerName(value) {
  const provider = String(value || '').toLowerCase();
  if (provider.includes('sheet')) return 'Google Sheets';
  if (provider.includes('email') || provider === 'ses') return '이메일';
  if (provider.includes('webhook')) return 'Webhook';
  if (provider.includes('automation') || provider.includes('make') || provider.includes('zapier')) return '외부 자동화';
  return '외부 전송';
}

export default function DeliveryActivityPanel({ page, authUser = null }) {
  const [activity, setActivity] = useState(EMPTY);
  const [failureOnly, setFailureOnly] = useState(false);
  const serverMode = isServerLeadMode();
  const session = authUser?.session || '';

  const refresh = useCallback(async (signal) => {
    if (!serverMode || !session) return;
    const context = projectContext(page, authUser);
    if (!context.projectId) return;
    setActivity((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const params = new URLSearchParams({ projectId: context.projectId, ownerId: context.ownerId, slug: context.slug, limit: '25' });
      const headers = projectAuthHeaders(context);
      const [logsResponse, queueResponse] = await Promise.all([
        apiFetch(`/api/leads/delivery-logs?${params.toString()}`, { headers, signal }),
        apiFetch(`/api/leads/retry-queue?${params.toString()}`, { headers, signal }),
      ]);
      if (!logsResponse.ok || !queueResponse.ok) throw new Error(`조회 실패 (HTTP ${!logsResponse.ok ? logsResponse.status : queueResponse.status})`);
      const [logData, queueData] = await Promise.all([logsResponse.json(), queueResponse.json()]);
      if (!logData?.ok || !queueData?.ok || !Array.isArray(logData.logs) || !Array.isArray(queueData.entries)) throw new Error('서버 전송 데이터 형식 오류');
      if (signal?.aborted) return;
      setActivity({
        logs: logData.logs,
        entries: queueData.entries,
        totalLogs: Number(logData.total || 0),
        retryable: Number(queueData.retryable || 0),
        deadLetter: Number(queueData.deadLetter || 0),
        loaded: true,
        error: '',
        loading: false,
      });
    } catch (error) {
      if (signal?.aborted) return;
      setActivity((prev) => ({ ...prev, error: String(error?.message || '조회 실패'), loading: false }));
    }
  }, [serverMode, session, page?.id, page?.projectId, page?.ownerId, page?.slug, authUser?.ownerId]);

  useEffect(() => {
    const controller = new AbortController();
    setActivity(EMPTY);
    refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  if (!serverMode) return <section className="inbox-ops-delivery"><p className="inbox-ops-delivery-muted">서버 접수 모드에서 전송 내역을 조회할 수 있습니다.</p></section>;
  if (!session) return <section className="inbox-ops-delivery"><p className="inbox-ops-delivery-muted">로그인 후 전송 내역을 확인하세요.</p></section>;

  const logs = failureOnly ? activity.logs.filter((item) => ['failed', 'timeout', 'dead-letter', 'partial'].includes(item.status)) : activity.logs;

  return (
    <section className="inbox-ops-delivery" aria-label="외부 알림 전송 내역">
      <div className="inbox-ops-delivery-top">
        <h3>전송 내역</h3>
        <button type="button" disabled={activity.loading} onClick={() => refresh()}>{activity.loading ? '조회 중' : '새로고침'}</button>
      </div>
      {activity.error ? <p className="inbox-ops-delivery-alert" role="alert">{activity.error} · 이전 조회 결과가 표시될 수 있습니다.</p> : null}
      {activity.loaded ? (
        <>
          <div className="inbox-ops-delivery-summary" aria-label="서버 전송 현황">
            <span>재시도 대상 <strong>{activity.retryable}</strong></span>
            <span>재시도 종료 <strong>{activity.deadLetter}</strong></span>
            <span>전송 기록 <strong>{activity.totalLogs}</strong></span>
          </div>
          <div className="inbox-ops-delivery-top">
            <h4>최근 전송</h4>
            <label><input type="checkbox" checked={failureOnly} onChange={(event) => setFailureOnly(event.target.checked)} /> 실패만 보기</label>
          </div>
          <div className="inbox-ops-delivery-items">
            {logs.map((item) => (
              <div key={item.id} className="inbox-ops-delivery-entry">
                <div>
                  <b>{providerName(item.provider)} · 접수 {deliveryLeadRef(item.leadId)}</b>
                  <small>{deliveryTime(item.updatedAt || item.createdAt)}{['failed', 'timeout', 'dead-letter'].includes(item.status) ? ` · ${deliveryFailureHint(item)}` : ''}</small>
                </div>
                <em>{deliveryStatusText(item.status)}</em>
              </div>
            ))}
            {!logs.length ? <p className="inbox-ops-delivery-muted">{failureOnly ? '표시 중인 최근 25건에 실패 기록 없음' : '최근 전송 기록 없음'}</p> : null}
          </div>
          {activity.totalLogs > activity.logs.length ? <p className="inbox-ops-delivery-muted">최근 {activity.logs.length}건 표시 · 전체 기록은 서버에 보관됩니다.</p> : null}
          <h4>재시도 큐</h4>
          <div className="inbox-ops-delivery-items">
            {activity.entries.map((item, index) => (
              <div key={`${item.leadId}-${item.lastAttemptAt}-${index}`} className="inbox-ops-delivery-entry">
                <div>
                  <b>접수 {deliveryLeadRef(item.leadId)} · {deliveryQueueText(item)}</b>
                  <small>시도 {item.attempts || 0}회{item.nextRetryAt ? ` · 예정 ${deliveryTime(item.nextRetryAt)}` : ''}{item.summary ? ` · ${deliveryFailureHint(item)}` : ''}</small>
                </div>
                <em>{item.deadLetter ? '종료' : item.canRetry ? '대상' : '확인 필요'}</em>
              </div>
            ))}
            {!activity.entries.length ? <p className="inbox-ops-delivery-muted">재시도 대상 없음</p> : null}
          </div>
          <p className="inbox-ops-delivery-muted">서버 재시도 큐는 조회 전용입니다. 이 화면에서 문자·이메일·웹훅을 다시 보내지 않습니다.</p>
        </>
      ) : !activity.error ? <p className="inbox-ops-delivery-muted">{activity.loading ? '전송 상태 조회 중' : '조회 대기'}</p> : null}
    </section>
  );
}
