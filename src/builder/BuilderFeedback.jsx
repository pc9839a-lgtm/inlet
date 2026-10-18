import { useEffect, useRef, useState } from 'react';
import { useAccessibleDialog } from '../lib/useAccessibleDialog.js';
import { createPortal } from 'react-dom';
import PreviewRenderer from '../preview/LandingRenderer.jsx';

const pageConflictErrorStyle = {
  margin: '10px 0 0',
  padding: '9px 11px',
  border: '1px solid #fecaca',
  borderRadius: 12,
  background: '#fef2f2',
  color: '#b91c1c',
  fontSize: 12,
  fontWeight: 850,
  lineHeight: 1.4,
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

export function PageConflictModal({ conflict, onClose, onUseLatest, onForceSave }) {
  const diff = Array.isArray(conflict?.diff) ? conflict.diff : [];
  const hasServerPage = !!conflict?.serverPage;
  const updatedAt = conflict?.serverPage?.updatedAt || conflict?.serverPage?.savedAt || '';
  const dialogRef = useAccessibleDialog(onClose);

  return createPortal(
    <div className="create-modal-backdrop" role="presentation">
      <section ref={dialogRef} className="create-modal page-conflict-modal" role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="page-conflict-title">
        <button type="button" className="create-modal-close" onClick={onClose} aria-label="닫기">×</button>
        <div className="create-modal-title page-conflict-title">
          <span>저장 충돌</span>
          <h2 id="page-conflict-title">저장 내용이 겹쳤습니다.</h2>
          <p>{hasServerPage ? '내 작업으로 저장할지, 서버 최신본을 불러올지 선택하세요.' : '서버 최신본을 확인하지 못했습니다. 창을 닫고 다시 저장해주세요.'}</p>
        </div>

        <div className="page-conflict-status" aria-live="polite">
          {conflict?.draftSaved && <span className="page-conflict-safe">현재 작업 자동 보관됨</span>}
          {updatedAt && <span className="page-conflict-time">서버 최신본 · {new Date(updatedAt).toLocaleString('ko-KR')}</span>}
        </div>

        {hasServerPage && diff.length > 0 && (
          <details className="page-conflict-details">
            <summary>변경 내용 보기</summary>
            <ul className="page-revision-diff">
              {diff.map((item) => (
                <li key={item.key} className={`revision-diff-${item.tone}`}>
                  <b>{item.label}</b>
                  {item.detail && <span>{item.detail}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}

        {conflict?.draftSaveError && <p style={pageConflictErrorStyle}>자동 보관 실패 · {conflict.draftSaveError}</p>}

        {hasServerPage ? (
          <div className="page-conflict-actions">
            <button type="button" className="page-conflict-primary" onClick={onForceSave} aria-label="현재 작업으로 서버 최신본 덮어쓰기">
              내 작업으로 저장
            </button>
            <button type="button" className="page-conflict-secondary" onClick={onUseLatest}>
              최신본 불러오기
            </button>
          </div>
        ) : (
          <div className="page-conflict-actions page-conflict-actions-single">
            <button type="button" className="page-conflict-primary" onClick={onClose}>닫기</button>
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}

export function PreviewCopyModal({ issue, onClose }) {
  const inputRef = useRef(null);
  const dialogRef = useAccessibleDialog(onClose);
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    if (issue?.kind === 'draft') return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [issue?.kind, issue?.url]);

  // This action copies the URL; it must never retry window.open().
  const copyPreviewUrl = async () => {
    const url = String(issue?.url || '');
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        copied = true;
      }
    } catch {
      // Clipboard permissions can be denied in a secure context.
    }
    if (!copied) {
      try {
        inputRef.current?.focus();
        inputRef.current?.select();
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      }
    }
    setCopyStatus(copied ? '주소가 복사되었습니다.' : '복사할 수 없습니다. 주소를 선택해 직접 복사해주세요.');
  };

  if (issue?.kind === 'draft') {
    return createPortal(
      <div className="create-modal-backdrop editor-draft-preview-backdrop" role="presentation">
        <section ref={dialogRef} className="create-modal editor-draft-preview-dialog" role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="editor-draft-preview-title">
          <header className="editor-draft-preview-header">
            <div>
              <h2 id="editor-draft-preview-title">현재 초안 미리보기</h2>
              <p>발행하지 않은 변경 사항도 표시됩니다. 문의·추적·외부 코드는 실행되지 않습니다.</p>
            </div>
            <div className="editor-draft-preview-actions">
              {issue.publishedUrl && <a href={issue.publishedUrl} target="_blank" rel="noopener noreferrer" title="현재 발행 주소를 새 창으로 열기 (미발행 페이지는 표시되지 않을 수 있음)">발행본 보기</a>}
              <button type="button" onClick={onClose}>닫기</button>
            </div>
          </header>
          <div className="editor-draft-preview-stage">
            <div className="phone-frame editor-draft-preview-phone">
              <PreviewRenderer page={issue.page} leads={[]} editorPreview />
            </div>
          </div>
        </section>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="create-modal-backdrop" role="presentation">
      <section ref={dialogRef} className="create-modal confirm-modal" role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="preview-copy-title">
        <button type="button" className="create-modal-close" onClick={onClose} aria-label="닫기">×</button>
        <div className="create-modal-title">
          <span>발행 주소</span>
          <h2 id="preview-copy-title">주소를 직접 복사해주세요.</h2>
          <p>{issue?.message || '아래 발행 주소를 선택하거나 복사할 수 있습니다.'}</p>
        </div>
        <input
          ref={inputRef}
          style={previewCopyInputStyle}
          value={issue?.url || ''}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
          onClick={(event) => event.currentTarget.select()}
          aria-label="발행 주소"
        />
        {copyStatus && <p role="status">{copyStatus}</p>}
        <div className="confirm-modal-actions">
          {issue?.url && <a className="confirm-cancel" href={issue.url} target="_blank" rel="noopener noreferrer">발행본 보기</a>}
          <button type="button" className="confirm-cancel" onClick={copyPreviewUrl}>다시 복사</button>
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
  const dialogRef = useAccessibleDialog(close);

  return createPortal(
    <div className="create-modal-backdrop" role="presentation">
      <section ref={dialogRef} className="create-modal confirm-modal" role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="confirm-modal-title">
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
