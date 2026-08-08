const ACTION_LABELS = {
  basic: ['페이지 저장', '페이지 수정'],
  managers: ['권한 저장', '권한 수정'],
  seo: ['SEO 저장', 'SEO 수정'],
  tracking: ['추적 코드 저장', '추적 코드 수정'],
  conversion: ['전환 설정 저장', '전환 설정 수정'],
};

export default function SettingsSection({
  id,
  badge = '',
  locked = false,
  onSave,
  onEdit,
  children,
  className = '',
  saveLabel,
  editLabel,
}) {
  const labels = ACTION_LABELS[id] || ['저장', '수정'];

  return (
    <section className={`settings-section ${className}`} data-settings-section={id}>
      <div className="settings-section-body">
        {badge && <span className="settings-section-badge">{badge}</span>}
        {children}
        {(onSave || onEdit) && (
          <footer className="settings-section-actions settings-action-bar">
            <span className="settings-action-bar-note">변경사항을 확인한 뒤 저장하세요.</span>
            <div className="settings-action-bar-buttons">
              {locked ? (
                <button className="settings-secondary-button" type="button" onClick={onEdit}>{editLabel || labels[1]}</button>
              ) : (
                <button className="settings-primary-button" type="button" onClick={onSave}>{saveLabel || labels[0]}</button>
              )}
            </div>
          </footer>
        )}
      </div>
    </section>
  );
}
