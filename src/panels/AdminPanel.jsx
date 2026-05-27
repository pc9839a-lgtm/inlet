import { useEffect, useMemo, useState } from 'react';
import { AiPanel } from '../ai/AiPanel.jsx';
import { START_MODE_KEY } from '../config/storageKeys.js';
import { Field } from '../editor/controls.jsx';
import { apiFetch, postJson, projectAuthHeaders } from '../lib/apiClient.js';
import { projectContext } from '../lib/projectContext.js';
import { notify } from '../lib/uiFeedback.js';
import './AdminPanel.css';

const TRANSFER_STATUS_LABELS = {
  requested: '승인 대기',
  waiting_billing_clearance: '결제 정리 대기',
  approved: '승인됨',
  rejected: '거절됨',
  completed: '완료',
  canceled: '취소됨',
};

export default function AdminPanel({ page, updatePage, updateAi, setPage, setStartMode, authUser = null, onExit }) {
  const context = useMemo(() => projectContext(page, authUser), [authUser, page]);
  const [transferQueue, setTransferQueue] = useState([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferBusyId, setTransferBusyId] = useState('');

  const loadTransferQueue = async () => {
    if (!context.projectId) return;
    setTransferLoading(true);
    try {
      const params = new URLSearchParams({
        projectId: context.projectId,
        ownerId: context.ownerId,
        slug: context.slug,
        limit: '20',
      });
      const res = await apiFetch(`/api/projects/ownership-transfer?${params.toString()}`, {
        headers: projectAuthHeaders(context),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTransferQueue(Array.isArray(data.requests) ? data.requests : []);
    } catch (error) {
      notify(`소유권이전 요청을 불러오지 못했습니다. ${String(error?.message || error)}`, 'error');
    } finally {
      setTransferLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!active) return;
      await loadTransferQueue();
    };
    run();
    return () => {
      active = false;
    };
  }, [context.projectId, context.ownerId, context.slug, context.session]);

  const updateTransferStatus = async (request, status, billingClearanceStatus = '') => {
    if (!request?.id) return;
    setTransferBusyId(request.id);
    try {
      const data = await postJson(`/api/admin/ownership-transfer/${encodeURIComponent(request.id)}`, {
        project: context,
        status,
        billingClearanceStatus,
      }, {
        method: 'PATCH',
        headers: projectAuthHeaders(context),
      });
      const nextRequest = data.request || { ...request, status, billingClearanceStatus };
      setTransferQueue((queue) => queue.map((item) => (item.id === request.id ? nextRequest : item)));
      notify('소유권이전 상태를 저장했습니다.', 'success');
    } catch (error) {
      notify(`소유권이전 상태 저장에 실패했습니다. ${String(error?.message || error)}`, 'error');
    } finally {
      setTransferBusyId('');
    }
  };

  return (
    <div className="simple-panel settings-panel admin-panel">
      <section className="card">
        <div className="section-title">
          <div>
            <h2>내부 관리자</h2>
            <p>공개 작업 메뉴가 아닌 로그인한 마스터 전용 관리 화면입니다.</p>
          </div>
          {onExit && <button type="button" onClick={onExit}>작업 화면으로</button>}
        </div>
        <div className="settings-grid">
          <Field label="프로젝트 ID" value={page.projectId || ''} onChange={(value) => updatePage({ projectId: value.replace(/[^a-zA-Z0-9-_]/g, '') })} />
          <Field label="관리자 계정" value={authUser?.email || ''} onChange={() => {}} />
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              localStorage.removeItem(START_MODE_KEY);
              setStartMode('');
              notify('시작 선택 화면을 다시 열도록 설정했습니다.', 'success');
            }}
          >
            시작 화면 다시 선택
          </button>
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <div>
            <h2>소유권이전 승인</h2>
            <p>요청은 결제 상태 확인 후 승인하거나 거절합니다. 실제 결제 이관은 결제 단계에서 처리합니다.</p>
          </div>
          <button type="button" onClick={loadTransferQueue} disabled={transferLoading}>
            {transferLoading ? '확인 중' : '새로고침'}
          </button>
        </div>
        <div className="admin-transfer-list">
          {!transferLoading && transferQueue.length === 0 && (
            <div className="admin-empty">대기 중인 소유권이전 요청이 없습니다.</div>
          )}
          {transferQueue.map((request) => {
            const busy = transferBusyId === request.id;
            return (
              <div className="admin-transfer-row" key={request.id}>
                <div>
                  <strong>{request.managerName || request.managerEmail || request.toAccountId || '대상 미지정'}</strong>
                  <span>{request.managerEmail || request.toAccountId} · {TRANSFER_STATUS_LABELS[request.status] || request.status}</span>
                  <small>{request.requestedAt ? request.requestedAt.slice(0, 10) : ''} · {request.billingClearanceStatus || 'not_checked'}</small>
                </div>
                <div className="admin-transfer-actions">
                  <button type="button" disabled={busy} onClick={() => updateTransferStatus(request, 'waiting_billing_clearance', 'active_subscription')}>결제대기</button>
                  <button type="button" disabled={busy} onClick={() => updateTransferStatus(request, 'approved', 'clear')}>승인</button>
                  <button type="button" disabled={busy || request.billingClearanceStatus !== 'clear'} onClick={() => updateTransferStatus(request, 'completed', 'clear')}>이전완료</button>
                  <button type="button" disabled={busy} onClick={() => updateTransferStatus(request, 'rejected', request.billingClearanceStatus || 'not_checked')}>거절</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <AiPanel page={page} updateAi={updateAi} setPage={setPage} authUser={authUser} />
    </div>
  );
}
