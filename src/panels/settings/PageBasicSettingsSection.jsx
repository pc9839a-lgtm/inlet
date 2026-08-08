import { Field } from '../../editor/controls.jsx';
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
  return (
    <SettingsSection
      id="basic"
      badge="필수"
      locked={locked}
      onSave={onSave}
      onEdit={onEdit}
      className="page-basic-settings-card"
    >
      <div className="settings-stack">
        <section className="settings-surface settings-form-surface">
          <header className="settings-surface-head simple">
            <div>
              <strong>페이지 정보</strong>
              <small>페이지 이름과 공개 주소를 설정합니다.</small>
            </div>
          </header>

          <div className="settings-grid page-basic-settings-grid">
            <Field
              label="페이지명"
              value={basicDraft.title}
              disabled={locked || clientAdminMode}
              onChange={(value) => setBasicDraft((draft) => ({ ...draft, title: value }))}
            />
            <div className="settings-field-with-help">
              <Field
                label="페이지 주소"
                prefix="/"
                value={basicDraft.slug}
                disabled={locked || clientAdminMode}
                onChange={(value) => setBasicDraft((draft) => ({ ...draft, slug: value.replace(/[^a-zA-Z0-9-_]/g, '') }))}
              />
              <small className="settings-field-help">영문, 숫자, 하이픈(-), 밑줄(_)만 사용할 수 있습니다.</small>
            </div>
            {clientAdminMode && (
              <div className="settings-field-with-help settings-grid-span-2">
                <Field label="관리 계정" value={authUser?.email || ''} disabled onChange={() => {}} />
                <small className="settings-field-help">관리 계정은 이 화면에서 변경할 수 없습니다.</small>
              </div>
            )}
          </div>
        </section>
      </div>
    </SettingsSection>
  );
}
