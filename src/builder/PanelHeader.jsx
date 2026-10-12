import { useEffect, useRef, useState } from 'react';
import { Redo2, Save, Undo2 } from 'lucide-react';
import {
  getPageEditHistoryState,
  redoPageEdit,
  subscribePageEditHistory,
  syncPageEditHistoryScope,
  undoPageEdit,
} from '../runtime/pageEditHistory.js';

const saveStateColors = {
  warning: '#946100',
  error: '#b42318',
};

export default function PanelHeader({ page, tab, saved, saveStatus, onSave, onPreview, onDashboard, previewUrl, backupEnabled = false, onBackup, onImportBackup }) {
  const [historyState, setHistoryState] = useState(() => getPageEditHistoryState());
  const backupFileInputRef = useRef(null);
  const backupMenuRef = useRef(null);

  const closeBackupMenu = () => {
    if (backupMenuRef.current) backupMenuRef.current.open = false;
  };
  const selectBackupFile = () => {
    closeBackupMenu();
    backupFileInputRef.current?.click();
  };
  const importBackupFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file && typeof onImportBackup === 'function') onImportBackup(file);
  };
  const titles = {
    edit: '편집',
    templates: '템플릿',
    style: '스타일',
    inbox: '접수함',
    stats: '통계',
    settings: '설정',
    admin: '관리자',
  };
  const title = titles[tab] || titles.edit;
  const showSaveAlert = saveStatus && (saveStatus.tone === 'warning' || saveStatus.tone === 'error');
  const historyEnabled = tab === 'edit' || tab === 'style' || tab === 'settings';

  useEffect(() => {
    syncPageEditHistoryScope(page);
  }, [page]);
  // A different unsaved page may have the same slug/project/owner as the
  // previous one; object-scoped identity must be checked on page replacement.

  useEffect(() => subscribePageEditHistory(() => setHistoryState(getPageEditHistoryState())), []);

  useEffect(() => {
    if (!historyEnabled || typeof window === 'undefined') return undefined;
    const onKeyDown = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = String(event.key || '').toLowerCase();
      if (key === 'z') {
        const handled = event.shiftKey ? redoPageEdit() : undoPageEdit();
        if (handled) event.preventDefault();
        return;
      }
      if (key === 'y' && !event.shiftKey) {
        const handled = redoPageEdit();
        if (handled) event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [historyEnabled]);

  return (
    <header className="panel-header product-panel-header">
      <div className="panel-title product-panel-title">
        <p>{page.title}</p>
        <div className="operations-panel-title-row">
          <h1>{title}</h1>
          {showSaveAlert && (
            <div className="panel-save-status operations-save-status" role="status" aria-atomic="true" title={saveStatus.detail || saveStatus.label} aria-live="polite">
              <strong style={{ color: saveStateColors[saveStatus.tone] }}>{saveStatus.label}</strong>
            </div>
          )}
        </div>
      </div>

      <div className="panel-actions">
        {historyEnabled && (
          <>
            <button className="ghost-btn panel-history-btn" type="button" onClick={undoPageEdit} disabled={!historyState.canUndo} title="실행 취소 (Ctrl/Cmd+Z)" aria-label="실행 취소">
              <Undo2 size={15} aria-hidden="true" />
            </button>
            <button className="ghost-btn panel-history-btn" type="button" onClick={redoPageEdit} disabled={!historyState.canRedo} title="다시 실행 (Ctrl/Cmd+Shift+Z)" aria-label="다시 실행">
              <Redo2 size={15} aria-hidden="true" />
            </button>
          </>
        )}
        {backupEnabled && historyEnabled && (
          <details className="panel-backup-action" ref={backupMenuRef} style={{ position: 'relative', flex: '0 0 auto' }}>
            <summary aria-label="편집본 백업 및 복원" style={{ display: 'flex', alignItems: 'center', minHeight: 36, padding: '0 10px', border: '1px solid var(--product-line)', borderRadius: 'var(--product-radius-control)', background: 'var(--product-panel)', color: '#30353d', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>백업</summary>
            <div className="panel-backup-dropdown" style={{ position: 'absolute', top: 'calc(100% + 5px)', right: 0, zIndex: 60, display: 'grid', gap: 4, minWidth: 118, padding: 6, border: '1px solid var(--product-line)', borderRadius: 'var(--product-radius-control)', background: 'var(--product-panel)', boxShadow: '0 8px 24px rgba(0,0,0,.14)' }}>
              <button className="ghost-btn" type="button" onClick={() => { closeBackupMenu(); onBackup?.(); }}>파일 저장</button>
              <button className="ghost-btn" type="button" onClick={selectBackupFile}>파일 복원</button>
            </div>
          </details>
        )}
        {backupEnabled && (
          <input
            ref={backupFileInputRef}
            type="file"
            hidden
            accept=".json,application/json"
            aria-label="PageRo 편집본 백업 파일"
            onChange={importBackupFile}
          />
        )}
        <button className="ghost-btn" type="button" onClick={onDashboard}>메인</button>
        <button className="ghost-btn" type="button" onClick={onPreview} title={previewUrl}>미리보기</button>
        <button
          className="primary-btn"
          type="button"
          onClick={onSave}
          title="편집 내용은 브라우저에 자동 임시보관됩니다. 발행하면 공개 페이지에 반영됩니다."
        >
          <Save size={14} aria-hidden="true" />{saved ? '발행됨' : '발행'}
        </button>
      </div>
    </header>
  );
}
