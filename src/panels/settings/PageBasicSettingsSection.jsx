import { Field } from '../../editor/controls.jsx';
import SettingsSection from './SettingsSection.jsx';

export default function PageBasicSettingsSection({
  authUser,
  basicDraft,
  clientAdminMode,
  locked,
  onEdit,
  onSave,
  openSection,
  setBasicDraft,
  setOpenSection,
}) {
  return (
    <SettingsSection
      id="basic"
      title="페이지 기본"
      description="페이지명과 공개 주소"
      badge="필수"
      openSection={openSection}
      setOpenSection={setOpenSection}
      locked={locked}
      onSave={onSave}
      onEdit={onEdit}
      className="page-basic-settings-card"
    >
      <div className="settings-grid page-basic-settings-grid">
        <Field
          label="페이지명"
          value={basicDraft.title}
          disabled={locked || clientAdminMode}
          onChange={(value) => setBasicDraft((draft) => ({ ...draft, title: value }))}
        />
        <Field
          label="페이지 주소"
          prefix="/"
          value={basicDraft.slug}
          disabled={locked || clientAdminMode}
          onChange={(value) => setBasicDraft((draft) => ({ ...draft, slug: value.replace(/[^a-zA-Z0-9-_]/g, '') }))}
        />
        {clientAdminMode && <Field label="관리 계정" value={authUser?.email || ''} disabled onChange={() => {}} />}
      </div>
    </SettingsSection>
  );
}
