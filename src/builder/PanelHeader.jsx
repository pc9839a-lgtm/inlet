import { Save } from 'lucide-react';

const saveStateColors = {
  idle: '#6c727e',
  ok: '#147a50',
  warning: '#946100',
  error: '#b42318',
};

export default function PanelHeader({ page, tab, saved, saveStatus, onSave, onPreview, onDashboard, previewUrl }) {
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

  return (
    <header className="panel-header product-panel-header">
      <div className="panel-title product-panel-title">
        <p>{page.title}</p>
        <div className="operations-panel-title-row">
          <h1>{title}</h1>
          {saveStatus && (
            <div className="panel-save-status operations-save-status" title={saveStatus.detail || saveStatus.label} aria-live="polite">
              <strong style={{ color: saveStateColors[saveStatus.tone] || saveStateColors.idle }}>{saveStatus.label}</strong>
            </div>
          )}
        </div>
      </div>

      <div className="panel-actions">
        <button className="ghost-btn" type="button" onClick={onDashboard}>메인</button>
        <button className="ghost-btn" type="button" onClick={onPreview} title={previewUrl}>미리보기</button>
        <button className="primary-btn" type="button" onClick={onSave}>
          <Save size={14} />{saved ? '저장됨' : '저장'}
        </button>
      </div>
    </header>
  );
}
