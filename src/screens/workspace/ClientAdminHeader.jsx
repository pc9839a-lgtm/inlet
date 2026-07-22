import React from 'react';
import { Save } from 'lucide-react';

const saveStateColors = {
  idle: '#64748b',
  ok: '#15803d',
  warning: '#b45309',
  error: '#dc2626',
};

export function ClientAdminHeader({ page, saved, saveStatus, onSave, onDashboard, onPreview, previewUrl }) {
  return (
    <header className="panel-header">
      <div className="panel-title">
        <p>{page.title}</p>
        <h1>관리자</h1>
        {saveStatus && (
          <div className="panel-save-status" title={saveStatus.detail || saveStatus.label} aria-live="polite">
            <strong style={{ color: saveStateColors[saveStatus.tone] || saveStateColors.idle }}>{saveStatus.label}</strong>
            {saveStatus.detail && <small>{saveStatus.detail}</small>}
          </div>
        )}
      </div>
      <div className="panel-actions">
        <button className="ghost-btn" type="button" onClick={onDashboard}>메인</button>
        <button className="ghost-btn" type="button" onClick={onPreview} title={previewUrl}>미리보기</button>
        <button className="primary-btn" type="button" onClick={onSave}>
          <Save size={15} />{saved ? '저장됨' : '저장'}
        </button>
      </div>
    </header>
  );
}