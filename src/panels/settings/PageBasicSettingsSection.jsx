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
      badge="필수"
      locked={locked}
      onSave={onSave}
      onEdit={onEdit}
      actionNote="페이지 이름과 공개 주소 변경사항을 저장합니다."
      className="page-basic-settings-card"
    >
      <div className="settings-stack">
        <section className="settings-surface settings-form-surface">
          <header className="settings-surface-head simple">
            <div>
              <strong>페이지 정보</strong>
              <small>방문자에게 표시되는 이름과 공개 주소를 관리합니다.</small>
            </div>
          </header>

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
              hint="영문, 숫자, 하이픈(-), 밑줄(_)만 사용할 수 있습니다."
            />
            {clientAdminMode && (
              <SettingsField
                label="관리 계정"
                value={authUser?.email || ''}
                disabled
                hint="관리 계정은 이 화면에서 변경할 수 없습니다."
                className="settings-grid-span-2"
              />
            )}
          </div>
        </section>
      </div>
    </SettingsSection>
  );
}
