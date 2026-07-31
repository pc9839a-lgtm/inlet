import { Redo2, Save, Undo2 } from 'lucide-react';
import { usePageHistoryControls } from '../runtime/usePageHistoryControls.js';

const saveStateColors = {
  idle: '#64748b',
  ok: '#15803d',
  warning: '#b45309',
  error: '#dc2626',
};

export default function PanelHeader({ page, tab, saved, saveStatus, onSave, onPreview, onStartChoice, onDashboard, previewUrl }) {
  const titles = {
    edit: ['편집', ''],
    templates: ['템플릿', '예시 화면을 보고 페이지 구성을 선택합니다.'],
    style: ['스타일', ''],
    inbox: ['접수함', ''],
    stats: ['통계', ''],
    settings: ['설정', ''],
    admin: ['관리자', ''],
  };
  const [title, desc] = titles[tab] || titles.edit;
  const history = usePageHistoryControls(page, { enabled: tab !== 'templates' });

  return (
    <header className="panel-header">
      <div className="panel-title">
        <p>{page.title}</p>
        <h1>{title}</h1>
        {desc && <span>{desc}</span>}
        {saveStatus && (
          <div className="panel-save-status" title={saveStatus.detail || saveStatus.label} aria-live="polite">
            <strong style={{ color: saveStateColors[saveStatus.tone] || saveStateColors.idle }}>{saveStatus.label}</strong>
            {saveStatus.detail && <small>{saveStatus.detail}</small>}
          </div>
        )}
      </div>
      <div className="panel-actions">
        <button className="ghost-btn" type="button" onClick={onDashboard}>메인</button>
        <button className="ghost-btn start-choice-btn" type="button" onClick={onStartChoice}>시작 선택</button>
        <div className="panel-history-actions" role="group" aria-label="실행 취소와 다시 실행">
          <button
            className="ghost-btn panel-history-btn is-undo"
            type="button"
            disabled={!history.canUndo}
            onClick={history.undo}
            title={history.canUndo ? `실행 취소 · ${history.undoCount}단계 (Ctrl+Z)` : '실행 취소할 변경이 없습니다.'}
            aria-label="실행 취소"
          >
            <Undo2 size={16} aria-hidden="true" />
          </button>
          <button
            className="ghost-btn panel-history-btn is-redo"
            type="button"
            disabled={!history.canRedo}
            onClick={history.redo}
            title={history.canRedo ? `다시 실행 · ${history.redoCount}단계 (Ctrl+Shift+Z)` : '다시 실행할 변경이 없습니다.'}
            aria-label="다시 실행"
          >
            <Redo2 size={16} aria-hidden="true" />
          </button>
        </div>
        <button className="ghost-btn" type="button" onClick={onPreview} title={previewUrl}>미리보기</button>
        <button className="primary-btn" type="button" onClick={onSave}>
          <Save size={15} />{saved ? '저장됨' : '저장'}
        </button>
      </div>
    </header>
  );
}
