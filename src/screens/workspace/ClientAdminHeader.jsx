import React from 'react';

export function ClientAdminHeader({ page, onDashboard, onPreview, previewUrl }) {
  return (
    <header className="panel-header">
      <div className="panel-title">
        <p>{page.title}</p>
        <h1>관리자</h1>
      </div>
      <div className="panel-actions">
        <button className="ghost-btn" type="button" onClick={onDashboard}>메인</button>
        <button className="ghost-btn" type="button" onClick={onPreview} title={previewUrl}>미리보기</button>
      </div>
    </header>
  );
}