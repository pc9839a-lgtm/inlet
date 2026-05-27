import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const pageConflictErrorStyle = {
  margin: 0,
  padding: '10px 12px',
  border: '1px solid #fecaca',
  borderRadius: 14,
  background: '#fef2f2',
  color: '#b91c1c',
  fontSize: 12,
  fontWeight: 850,
  lineHeight: 1.45,
};

const previewCopyInputStyle = {
  width: '100%',
  marginTop: 12,
  padding: '12px 13px',
  border: '1px solid #cbd5e1',
  borderRadius: 14,
  background: '#f8fafc',
  color: '#111827',
  fontSize: 14,
  fontWeight: 850,
};

function useDialogKeyboard(onClose) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    const focusable = node?.querySelector?.('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusable?.focus?.();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return ref;
}

export function PageConflictModal({ conflict, onClose, onUseLatest, onKeepDraft, onForceSave }) {
  const diff = Array.isArray(conflict?.diff) ? conflict.diff : [];
  const hasServerPage = !!conflict?.serverPage;
  const updatedAt = conflict?.serverPage?.updatedAt || conflict?.serverPage?.savedAt || '';
  const dialogRef = useDialogKeyboard(onClose);

  return createPortal(
    <div className="create-modal-backdrop" role="presentation">
      <section ref={dialogRef} className="create-modal page-conflict-modal" role="dialog" aria-modal="true" aria-labelledby="page-conflict-title">
        <button type="button" className="create-modal-close" onClick={onClose} aria-label="닫기">×</button>
        <div className="create-modal-title">
          <span>저장 충돌</span>
          <h2 id="page-conflict-title">다른 곳에서 먼저 저장된 페이지가 있습니다.</h2>
          <p>현재 작업은 브라우저에 남아 있습니다. 최신 서버본을 확인한 뒤 덮어쓸지, 현재 작업을 임시 보관할지 선택하세요.</p>
        </div>
        <div className="page-revision-preview page-conflict-preview">
          <strong>{hasServerPage ? `최신 서버본: ${conflict.serverPage.title || '제목 없음'}` : '최신 서버본을 불러오지 못했습니다.'}</strong>
          <p>{updatedAt ? `서버 저장 시간: ${new Date(updatedAt).toLocaleString('ko-KR')}` : conflict?.errorMessage}</p>
          <ul className="page-revision-diff">
            {diff.map((item) => (
              <li key={item.key} className={`revision-diff-${item.tone}`}>
                <b>{item.label}</b>
                {item.detail && <span>{item.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
        {conflict?.draftSaved && <p className="page-conflict-saved">현재 작업을 임시 보관했습니다. 최신본을 불러와도 보관본은 브라우저 저장소에 남습니다.</p>}
        {conflict?.draftSaveError && <p style={pageConflictErrorStyle}>현재 작업 임시 보관에 실패했습니다. {conflict.draftSaveError}</p>}
        <div className="create-options page-conflict-actions">
          <button type="button" className="primary" onClick={onUseLatest} disabled={!hasServerPage}>
            <strong>최신본 불러오기</strong>
            <span>서버에 먼저 저장된 페이지로 편집 화면을 맞춥니다.</span>
          </button>
          <button type="button" onClick={onKeepDraft}>
            <strong>현재 작업 임시 보관</strong>
            <span>충돌 난 현재 편집본을 별도 로컬 초안으로 저장합니다.</span>
          </button>
          <button type="button" onClick={onForceSave} disabled={!hasServerPage}>
            <strong>현재 작업으로 덮어쓰기</strong>
            <span>최신 서버본을 확인한 뒤 현재 편집본을 서버에 다시 저장합니다.</span>
          </button>
          <button type="button" onClick={onClose}>
            <strong>현재 화면 유지</strong>
            <span>저장은 완료되지 않았고, 편집 화면은 그대로 둡니다.</span>
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function PreviewCopyModal({ issue, onClose, onRetry }) {
  const inputRef = useRef(null);
  const dialogRef = useDialogKeyboard(onClose);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [issue?.url]);

  const openPreview = () => {
    window.open(issue?.url || '', '_blank', 'noopener,noreferrer');
  };

  return createPortal(
    <div className="create-modal-backdrop" role="presentation">
      <section ref={dialogRef} className="create-modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="preview-copy-title">
        <button type="button" className="create-modal-close" onClick={onClose} aria-label="닫기">×</button>
        <div className="create-modal-title">
          <span>미리보기 주소</span>
          <h2 id="preview-copy-title">주소를 직접 복사해주세요.</h2>
          <p>{issue?.message || '브라우저 권한 또는 보안 설정 때문에 자동 복사가 막혔습니다. 아래 주소를 선택해서 복사할 수 있습니다.'}</p>
        </div>
        <input
          ref={inputRef}
          style={previewCopyInputStyle}
          value={issue?.url || ''}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
          onClick={(event) => event.currentTarget.select()}
          aria-label="미리보기 주소"
        />
        <div className="confirm-modal-actions">
          <button type="button" className="confirm-cancel" onClick={openPreview}>새 창으로 열기</button>
          <button type="button" className="confirm-cancel" onClick={onRetry}>다시 복사</button>
          <button type="button" className="confirm-primary" onClick={onClose}>확인</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function ConfirmModal({ dialog, onClose }) {
  const close = () => {
    dialog?.onCancel?.();
    onClose();
  };

  const runConfirm = async () => {
    const action = dialog?.onConfirm;
    onClose();
    await action?.();
  };
  const dialogRef = useDialogKeyboard(close);

  return createPortal(
    <div className="create-modal-backdrop" role="presentation">
      <section ref={dialogRef} className="create-modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
        <button type="button" className="create-modal-close" onClick={close} aria-label="닫기">×</button>
        <div className="create-modal-title">
          <span>{dialog?.danger ? '주의' : '확인'}</span>
          <h2 id="confirm-modal-title">{dialog?.title || '계속 진행할까요?'}</h2>
          {dialog?.message && <p>{dialog.message}</p>}
        </div>
        <div className="confirm-modal-actions">
          <button type="button" className="confirm-cancel" onClick={close}>취소</button>
          <button type="button" className={dialog?.danger ? 'confirm-danger' : 'confirm-primary'} onClick={runConfirm}>
            {dialog?.confirmLabel || '확인'}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function ToastNotice({ toast, onClose }) {
  return createPortal(
    <div className={`toast-notice toast-${toast?.tone || 'info'}`} role="status">
      <span>{toast?.message}</span>
      <button type="button" onClick={onClose} aria-label="닫기">×</button>
    </div>,
    document.body,
  );
}
