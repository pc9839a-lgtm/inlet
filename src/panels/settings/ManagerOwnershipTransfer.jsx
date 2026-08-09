import { ownershipTransferBillingLabel, ownershipTransferStatusCopy, ownershipTransferStatusLabel } from '../../lib/ownershipTransfer.js';
import { managerLabel } from './managerSettingsModel.js';

export default function ManagerOwnershipTransfer({
  authUser,
  cancelOwnershipTransfer,
  eligibleTransferManagers,
  ownership,
  requestOwnershipTransferPersisted,
  setShowTransfer,
  setTransferManagerId,
  showTransfer,
  transferManagerId,
  transferRequest,
}) {
  return (
    <>
      <div className="manager-owner-summary">
        <div>
          <span>마스터</span>
          <strong>{ownership.ownerEmail || authUser?.email || '미지정'}</strong>
        </div>
        <div>
          <span>클라이언트</span>
          <strong>{ownership.clientEmail || '없음'}</strong>
        </div>
        <button type="button" className="manager-fold-btn" onClick={() => setShowTransfer(!showTransfer)}>
          {showTransfer ? '소유권 이전 닫기' : '소유권 이전'}
        </button>
      </div>

      {showTransfer && (
        <div className="ownership-transfer-box settings-danger-zone-lite">
          <div className="ownership-transfer-copy">
            <span>민감한 권한</span>
            <strong>소유권 이전</strong>
            <p>대상 매니저를 선택해 요청하면 내부 관리자의 최종 승인 후 소유권이 변경됩니다.</p>
          </div>
          <div className="ownership-transfer-controls">
            <select value={transferManagerId} onChange={(event) => setTransferManagerId(event.target.value)} disabled={!eligibleTransferManagers.length}>
              {!eligibleTransferManagers.length && <option value="">이메일이 입력된 매니저 없음</option>}
              {eligibleTransferManagers.map((manager) => (
                <option key={manager.id} value={manager.id}>{managerLabel(manager)} · {manager.email}</option>
              ))}
            </select>
            <button type="button" className="settings-danger-button" onClick={requestOwnershipTransferPersisted} disabled={!eligibleTransferManagers.length}>이전 요청</button>
          </div>
          {transferRequest?.status && (
            <div className={`ownership-transfer-status status-${transferRequest.status}`}>
              <div>
                <strong>{ownershipTransferStatusLabel(transferRequest.status)}</strong>
                <span>{transferRequest.managerName || transferRequest.managerEmail || '대상 미지정'} · {ownershipTransferStatusCopy(transferRequest.status)}</span>
                <small>{ownershipTransferBillingLabel(transferRequest.billingClearanceStatus)} · {transferRequest.requestedAt ? String(transferRequest.requestedAt).slice(0, 10) : '날짜 없음'}</small>
              </div>
              {['requested', 'pending-admin-approval'].includes(transferRequest.status) && (
                <button type="button" className="settings-secondary-button compact" onClick={cancelOwnershipTransfer}>요청 취소</button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
