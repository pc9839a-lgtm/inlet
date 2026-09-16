import { useEffect, useState } from 'react';
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

export default function PanelHeader({ page, tab, saved, saveStatus, onSave, onPreview, onDashboard, previewUrl }) {
  const [historyState, setHistoryState] = useState(() => getPageEditHistoryState());
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
  }, [page?.id, page?.pageId, page?.projectId, page?.ownerId, page?.ownerAccountId]);

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
            <div className="panel-save-status operations-save-status" title={saveStatus.detail || saveStatus.label} aria-live="polite">
              <strong style={{ color: saveStateColors[saveStatus.tone] }}>{saveStatus.label}</strong>
            </div>
          )}
        </div>
      </div>

      <div className="panel-actions">
        {historyEnabled && (
          <>
            <button className="ghost-btn panel-history-btn" type="button" onClick={undoPageEdit} disabled={!historyState.canUndo} title="실행 취소 (Ctrl/Cmd+Z)" aria-label="실행 취소">
              <Undo2 size={15} />
            </button>
            <button className="ghost-btn panel-history-btn" type="button" onClick={redoPageEdit} disabled={!historyState.canRedo} title="다시 실행 (Ctrl/Cmd+Shift+Z)" aria-label="다시 실행">
              <Redo2 size={15} />
            </button>
          </>
        )}
        <button className="ghost-btn" type="button" onClick={onDashboard}>메인</button>
        <button className="ghost-btn" type="button" onClick={onPreview} title={previewUrl}>미리보기</button>
        <button className="primary-btn" type="button" onClick={onSave}>
          <Save size={14} />{saved ? '저장됨' : '저장'}
        </button>
      </div>
    </header>
  );
}
