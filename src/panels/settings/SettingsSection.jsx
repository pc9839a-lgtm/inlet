export default function SettingsSection({
  id,
  title,
  badge = '',
  openSection,
  setOpenSection,
  locked = false,
  onSave,
  onEdit,
  children,
  className = '',
}) {
  const open = openSection === id;
  const stateLabel = open ? '접기' : '열기';

  return (
    <section className={`card settings-section ${open ? 'open' : ''} ${className}`}>
      <button
        type="button"
        className="settings-section-head"
        aria-expanded={open}
        aria-label={`${title} ${stateLabel}`}
        onClick={() => setOpenSection(open ? '' : id)}
      >
        <span className="settings-section-copy">
          <span className="settings-section-title-row">
            <h2>{title}</h2>
            {badge && <em>{badge}</em>}
          </span>
        </span>
        <span className="settings-section-state" aria-hidden="true">{stateLabel}</span>
      </button>
      {open && (
        <div className="settings-section-body">
          {children}
          {(onSave || onEdit) && (
            <div className="settings-section-actions">
              {locked ? (
                <button type="button" onClick={onEdit}>수정</button>
              ) : (
                <button type="button" onClick={onSave}>저장</button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

