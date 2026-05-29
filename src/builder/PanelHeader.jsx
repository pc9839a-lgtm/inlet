import { Save } from 'lucide-react';

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
        <button className="ghost-btn" onClick={onDashboard}>메인</button>
        <button className="ghost-btn start-choice-btn" onClick={onStartChoice}>시작 선택</button>
        <button className="ghost-btn" onClick={onPreview} title={previewUrl}>미리보기</button>
        <button className="primary-btn" onClick={onSave}>
          <Save size={15}/>{saved ? '저장됨' : '저장'}
        </button>
      </div>
    </header>
  );
}
