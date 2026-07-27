import React from 'react';
import { Save } from 'lucide-react';

const saveStateColors = {
  idle: '#64748b',
  ok: '#15803d',
  warning: '#b45309',
  error: '#dc2626',
};

export function ClientAdminHeader({ page, saved, saving, saveStatus, onSave, onDashboard, onPreview, previewUrl }) {
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
        <button className="primary-btn" type="button" onClick={onSave} disabled={saving} aria-busy={saving}>
          <Save size={15} />{saving ? '\uC800\uC7A5 \uC911' : saved ? '\uC800\uC7A5\uB428' : '\uC800\uC7A5'}
        </button>
      </div>
    </header>
  );
}
