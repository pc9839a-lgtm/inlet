export default function SettingsSection({
  id,
  badge = '',
  locked = false,
  onSave,
  onEdit,
  children,
  className = '',
}) {
  return (
    <section className={`settings-section ${className}`} data-settings-section={id}>
      <div className="settings-section-body">
        {badge && <span className="settings-section-badge">{badge}</span>}
        {children}
        {(onSave || onEdit) && (
          <footer className="settings-section-actions settings-action-bar">
            {locked ? (
              <button className="settings-secondary-button" type="button" onClick={onEdit}>수정</button>
            ) : (
              <button className="settings-primary-button" type="button" onClick={onSave}>저장</button>
            )}
          </footer>
        )}
      </div>
    </section>
  );
}
