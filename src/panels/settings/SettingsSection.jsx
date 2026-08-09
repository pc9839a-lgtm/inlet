import SettingsActionBar from './SettingsActionBar.jsx';

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
  actionNote = '변경사항을 확인한 뒤 저장하세요.',
}) {
  const labels = ACTION_LABELS[id] || ['저장', '수정'];

  return (
    <section className={`settings-section ${className}`} data-settings-section={id}>
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
