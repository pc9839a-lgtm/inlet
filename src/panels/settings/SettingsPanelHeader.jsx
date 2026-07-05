export default function SettingsPanelHeader({ page }) {
  return (
    <div className="settings-compact-head">
      <div>
        <span>설정</span>
        <strong>{page.title || '현재 페이지'}</strong>
      </div>
      <em>/{page.slug || 'page'}</em>
    </div>
  );
}