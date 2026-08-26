import SettingsActionBar from './SettingsActionBar.jsx';

const ACTION_LABELS = {
  basic: ['저장', '수정'],
  managers: ['저장', '수정'],
  seo: ['저장', '수정'],
  tracking: ['저장', '수정'],
  conversion: ['저장', '수정'],
};

export default function SettingsSection({
  id,
  badge = '',
  locked = false,
  onSave,
  onEdit,
  children,
  className = '',
  style,
  saveLabel,
  editLabel,
  actionNote = '',
}) {
  const labels = ACTION_LABELS[id] || ['저장', '수정'];

  return (
    <section className={`settings-section ${className}`} data-settings-section={id} style={style}>
      <div className="settings-section-body">
        {badge && <span className="settings-section-badge">{badge}</span>}
        {children}
        {(onSave || onEdit) && (
          <SettingsActionBar
            note={actionNote}
            primaryLabel={locked ? editLabel || labels[1] : saveLabel || labels[0]}
            onPrimary={locked ? onEdit : onSave}
          />
        )}
      </div>
    </section>
  );
}
