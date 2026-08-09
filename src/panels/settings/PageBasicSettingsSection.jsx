import SettingsField from './SettingsField.jsx';
import SettingsSection from './SettingsSection.jsx';

export default function PageBasicSettingsSection({
  authUser,
  basicDraft,
  clientAdminMode,
  locked,
  onEdit,
  onSave,
  setBasicDraft,
}) {
  const readOnly = locked || clientAdminMode;

  return (
    <SettingsSection
      id="basic"
      locked={locked}
      onSave={onSave}
      onEdit={onEdit}
      className="page-basic-settings-card settings-flat-form-section"
    >
      <div className="settings-form-grid page-basic-settings-grid">
        <SettingsField
          label="페이지명"
          value={basicDraft.title}
          disabled={readOnly}
          onChange={(value) => setBasicDraft((draft) => ({ ...draft, title: value }))}
          placeholder="페이지 이름"
        />
        <SettingsField
          label="페이지 주소"
          prefix="/"
          value={basicDraft.slug}
          disabled={readOnly}
          onChange={(value) => setBasicDraft((draft) => ({ ...draft, slug: value.replace(/[^a-zA-Z0-9-_]/g, '') }))}
          placeholder="page"
        />
        {clientAdminMode && (
          <SettingsField
            label="관리 계정"
            value={authUser?.email || ''}
            disabled
            className="settings-grid-span-2"
          />
        )}
      </div>
    </SettingsSection>
  );
}
